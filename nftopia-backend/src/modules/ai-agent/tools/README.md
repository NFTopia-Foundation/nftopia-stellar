# AI agent tool sets

Every tool the assistant can call belongs to exactly one **tool set**, and
every AI agent endpoint requests exactly one tool set by name. There is no
"give me everything" option — see `tool-set.registry.ts`.

```
endpoint            --> ToolSetName ("marketplace-assistant", ...)
                             |
                             v
                    tool-set.registry.ts  --> resolveToolSet(name, deps)
                             |
                             v
              registered builder (e.g. marketplace.tools.ts)
                             |
                             v
              tools, checked against that set's ownedToolNames
```

## Why

`AiAgentService.chat` used to call `buildMarketplaceTools` unconditionally,
so any tool added to that file — or to a new tools file someone forgot to
gate — was implicitly reachable from every caller, including
`AiAgentController.chat`, a plain authenticated-user endpoint. As
write-capable or admin-only tool sets are added (creator co-pilot,
moderation, trading — see below), a mistake in that spot stops being "an
extra read-only NFT lookup" and starts being "a user-facing chat endpoint
that can flag content or draft a listing on someone else's behalf."

## How a tool set is declared

1. A tools file (e.g. `marketplace.tools.ts`) exports a builder function and
   the exact list of tool names it's allowed to return.
2. `tool-set.registry.ts` calls `registerToolSet(name, builder, ownedToolNames)`
   once, at module load, for that tools file.
3. Callers get tools only through `resolveToolSet(name, deps)`, which calls
   the registered builder and then verifies every tool it returned is in
   `ownedToolNames`. A builder that starts returning a tool it didn't
   declare — a rename, a copy-pasted tool from another set, anything —
   makes `resolveToolSet` throw instead of silently widening what that
   tool set exposes.

`AiAgentService.chat(userId, toolSet, message, history)` (and
`chatStream`) take `toolSet: ToolSetName` as a required parameter — there
is no default, so a new endpoint-specific method cannot forget to pick one.

## Tool set → endpoint mapping

| Tool set               | Endpoint(s)                              | Access      | Capability   | Status      |
| ----------------------- | ---------------------------------------- | ----------- | ------------ | ----------- |
| `marketplace-assistant` | `POST /ai/chat`, `POST /ai/chat/stream`  | Any authenticated user | Read-only    | Implemented (`marketplace.tools.ts`) |
| `creator-copilot`       | `POST /ai/copilot/draft-listing`         | NFT creator/owner (ownership verified before the model is ever called) | Write-capable (drafts, but never publishes, a listing for the caller's own NFT) | Implemented (`creator-copilot.tools.ts`, #528) |
| `moderation`            | Not chat-driven — the `ListingCreatedListener` enqueues a job on the `ai-moderation` Bull queue, consumed by `AiModerationProcessor`. Findings surface via `GET /admin/ai/flags` / `PATCH /admin/ai/flags/:id`. | System (queue worker) only | Write-capable (`flag_content` persists to `content_flags`) | Implemented (`moderation.tools.ts` + `ai-moderation.processor.ts`, #527) |
| `trading`               | Trade proposal endpoints & chat trading interactions | Any authenticated user, strictly scoped to their own orders/offers | Write-capable (proposes, accepts, and cancels trade proposals) | Implemented (`trading.tools.ts`, #641) |

`marketplace-assistant`, `moderation`, `creator-copilot`, and `trading` are
all registered tool sets with implemented builders today. Calling
`resolveToolSet` for any of these tool set names resolves successfully and
enforces that only tools declared in their respective allowlists are returned.

### `trading` (#641)

The `trading` tool set provides write-capable operations for proposing,
accepting, and cancelling trade proposals (`propose_trade`, `accept_trade`,
`cancel_trade`), backed by strict caller and order scoping guards:

- **Strict caller scoping**: The authenticated caller identity (`deps.userId`)
  is closed over at build time from the JWT or session context. If the model
  attempts to supply or echo a different `proposerId`, `acceptorId`, or
  `cancellerId`, the scoping guard rejects the tool call immediately before any
  business logic runs.
- **Own orders/offers boundary**: `accept_trade` and `cancel_trade` verify
  that the action targets the caller's own orders or offers. When `OrderService`
  is available, ownership is checked via `findOneForUser(userId, id)` so users
  can never inspect, accept, or cancel another user's trades. Additionally,
  `allowedOrderIds` can be closed over at build time to restrict the session's
  actions to a specific subset of orders/offers.
- **Write-capable actions**:
  - `propose_trade`: Creates a structured trade proposal between an offered
    NFT and requested NFT with an optional sweetener amount/currency (XLM/USDC).
  - `accept_trade`: Accepts an incoming trade proposal, transitioning it to
    completed status.
  - `cancel_trade`: Cancels a pending trade proposal with an optional reason.
- **Audit logging and observability**: All invocations (arguments, outcome
  summary, execution time, and errors) are monitored and logged via
  `toolLogger`.

### `creator-copilot` (#528)

`POST /ai/copilot/draft-listing` (`{ nftId }` in the body) drafts a
title/description/suggested-price for one of the caller's own NFTs via a
single forced-tool-choice call to `draft_listing` — never the open-ended
`chat`/`chatStream` loop, since this is one-shot structured output for a
known NFT rather than a conversation.

- **Ownership is checked twice**: `AiAgentService.draftListing` verifies
  `nft.ownerId === userId` *before* the model is ever called (fast-fail,
  no wasted spend); `draft_listing` itself then rejects a model-returned
  `nftId` that doesn't match the NFT it was asked to draft for, in case the
  model drifts — the same "never trust identity from tool input" pattern as
  `userId` in `marketplace.tools.ts`'s `search_orders`/`get_order`.
- **Never auto-published**: the tool only returns the drafted fields as
  JSON for the creator to review and edit; creating the actual listing is
  a separate, explicit call to the existing listing-creation endpoint.
- **Rate-limited independently of `/ai/chat`**: `CopilotRateLimitGuard`
  (`copilot-rate-limit.guard.ts`) uses its own Redis key prefix and points
  budget (`AI_COPILOT_RATE_LIMIT_POINTS`/`AI_COPILOT_RATE_LIMIT_TTL`) so
  drafting listings can't starve, or be starved by, chat usage.

### `moderation` (#527)

`ListingCreatedListener` (`listeners/listing-created.listener.ts`) reacts
to the `listing.created` event by enqueuing a job on the `ai-moderation`
Bull queue — deliberately off the request path, so a slow or unavailable
moderation agent never delays listing creation.
`AiModerationProcessor` (`ai-moderation.processor.ts`) consumes that
queue: it fetches the listing's NFT content (name/description/attributes),
makes a single non-agentic call to Anthropic with `flag_content`
available but **not forced** (`tool_choice: 'auto'`) — unlike
`draftListing`'s forced call, moderation must be free to conclude "no
violation" and call nothing — and persists a `ContentFlag` only if the
model actually calls `flag_content`.

- **Idempotent under redelivery**: before ever calling Anthropic, the
  processor checks `ContentFlagService.findExistingFlag('listing',
  listingId)` and skips (no duplicate flag, no wasted API call) if the
  listing has already been flagged.
- **Never trusts the model's echoed entity**: same pattern as
  `creator-copilot`'s `expectedNftId` — `flag_content` is built with
  `expectedEntity: { entityType: 'listing', entityId: listingId }` closed
  over server-side, and rejects a flag for any other entity the model
  might echo.
- **Bounded retry/backoff**: the enqueued job carries `attempts: 3` with
  exponential backoff (`listing-created.listener.ts`'s
  `MODERATION_JOB_OPTIONS`) — a transient Anthropic failure (rate limit,
  timeout) retries rather than failing permanently on the first attempt;
  the processor rethrows on failure so Bull drives the retry.
- **Observability**: structured `Logger` output per job (attempt count,
  outcome) plus the `ai_moderation_jobs_processed_total` Prometheus
  counter, labeled by outcome (`flagged`/`clean`/`skipped`/`error`).
- **On-chain-only listings**: a listing created via the
  `ENABLE_ONCHAIN_SETTLEMENT` path has no persisted `listings` row (its
  id is an on-chain sale id, not a UUID). `flag_content`'s schema requires
  a UUID `entityId`, so if the agent would flag such a listing, the
  processor logs a warning and skips recording the flag rather than
  forcing an invalid id through — a pre-existing gap in that settlement
  path's data model, not something this processor can resolve on its own.

## Adding a new tool set

1. Create `<name>.tools.ts` next to `marketplace.tools.ts`, following the
   same shape: a `build<Name>Tools(deps)` function plus an exported
   `<NAME>_TOOL_NAMES` array kept in sync with the `name` on every tool it
   builds.
2. Register it in `tool-set.registry.ts`:
   `registerToolSet('your-set-name', buildYourTools, YOUR_TOOL_NAMES)`.
3. Add a row to the table above.
4. Have the new endpoint call `chat`/`chatStream` (or a new
   endpoint-specific method) with that exact `ToolSetName` — never reuse
   `'marketplace-assistant'` for a different endpoint's capability.
5. Add or extend the tests in `tool-set.registry.spec.ts` covering the new
   set's ownership boundary.

---

## Rate limiting (#645)

Two independently-configured, independently-tracked rate limits apply to
the chat-shaped/tool-set endpoints, both enforced server-side via Redis
(`rate-limiter-flexible`), keyed by the authenticated user id (falling back
to IP only if a user id is unexpectedly missing):

| Guard | Routes | Keying | Why separate |
| --- | --- | --- | --- |
| `AiChatRateLimitGuard` | `POST /ai/chat`, `POST /ai/chat/stream` | Per user **and** per AI tool set — see below | One request can trigger several Anthropic calls inside the tool-calling loop, so this is tuned independently of the generic per-IP `RedisRateGuard`. |
| `CopilotRateLimitGuard` | `POST /ai/copilot/draft-listing` | Per user, its own bucket | Pre-existing, separate from the above (#528) — drafting a listing is a single forced-tool-choice call, not an open-ended loop, so it's tracked in its own bucket entirely rather than as another `AiChatRateLimitGuard` tool set. |

### Per-tool-set buckets on `AiChatRateLimitGuard`

`AiChatRateLimitGuard` keys its Redis bucket by **both** the user and the AI
tool set the route targets, read from the route's `@ToolSet(...)` decorator
(`common/decorators/tool-set.decorator.ts`) — defaulting to
`marketplace-assistant` for a route carrying no decorator, which both chat
routes are tagged with explicitly. Each tool set has its own
`RateLimiterRedis` instance (own Redis key prefix, own configured points),
so **exhausting one tool set's budget never blocks a different tool set for
the same user** — the mechanism that made `CopilotRateLimitGuard` a
separate class in the first place, generalized so a future tool set reachable
through `/ai/chat`/`/ai/chat/stream` (e.g. `trading`) gets the same
independent-bucket guarantee without a new guard class.

| Tool set | Points (default) | TTL (default) | Config |
| --- | --- | --- | --- |
| `marketplace-assistant` | 20 | 600s | `AI_CHAT_RATE_LIMIT_POINTS` / `AI_CHAT_RATE_LIMIT_TTL` |
| `creator-copilot` | 5 (stricter — write-capable) | 600s (shared `AI_CHAT_RATE_LIMIT_TTL`) | `AI_CHAT_RATE_LIMIT_POINTS_CREATOR_COPILOT` |

A tool set with no entry in `AiChatRateLimitGuard`'s limiter map falls back
to the `marketplace-assistant` limiter/budget — see
`DEFAULT_RATE_LIMITED_TOOL_SET` in `ai-chat-rate-limit.guard.ts`.

---

## Prompt-injection / jailbreak detection (#569)

`PromptInjectionService` (`prompt-injection.service.ts`) runs a lightweight
heuristic pre-screening step **before** any user message reaches the Anthropic
API — in both `AiAgentService.chat()` and `AiAgentService.chatStream()`.

### How it works

The service holds a prioritised list of compiled `RegExp` rules, each tagged
with a coarse **category** name. `screen(message)` tests the rules in order
and returns on the first match (short-circuit evaluation). A match causes
`AiAgentService` to throw a `BadRequestException` and write a `WARN`-level
log entry via `logFlagged()` — the raw message text is never forwarded to the
model.

### Detection categories

| Category                | What it catches                                        |
|-------------------------|--------------------------------------------------------|
| `system-prompt-override`| Attempts to view, replace, or reveal the system prompt |
| `instruction-override`  | "Ignore all previous instructions" and close variants  |
| `role-play-jailbreak`   | "DAN", "you are now unrestricted", mode-switch framing |
| `tool-exfiltration`     | Requests to enumerate or describe available tools      |
| `delimiter-injection`   | Raw XML/JSON/markdown structural delimiters in input   |
| `context-manipulation`  | Injected fake `System:`/`Assistant:`/`Human:` turns    |

### Logging

Flagged attempts are logged at `WARN` level with:
- `userId`
- `sessionId` (or `pre-session` if no session exists yet)
- `category`
- The first 80 characters of the message (truncated to avoid retaining full
  injection payloads in the log stream)

No raw message content beyond the 80-character preview is written to any
persistent store.

### Limitations — this is a mitigation, not a guarantee

- **Pattern evasion**: A sufficiently obfuscated or multilingual payload may
  not match these regex patterns. Adversaries who know the exact ruleset can
  craft inputs that slip through.
- **False positives**: The patterns are anchored to structural injection
  markers rather than topic words, keeping the false-positive rate low on
  ordinary marketplace queries — but novel phrasing can still hit them. If a
  legitimate use-case is blocked, add a regression test and refine the
  offending pattern in `prompt-injection.service.ts`.
- **Complementary layers still required**: This service is a first-line
  defence that complements — and does not replace — the model-level system
  prompt, the tool-set allowlist (#492), and the content-flag review pipeline.
  A message that clears the pre-screener is still constrained by all those
  other controls.

### Adding or tuning patterns

1. Edit the `rules` array in `prompt-injection.service.ts`.
2. Add a test case in `prompt-injection.service.spec.ts` covering the new
   pattern (adversarial) **and** at least one legitimate message that is
   structurally similar but should pass (to guard against regressions).
3. Run `pnpm test --filter nftopia-backend` and confirm all tests pass.

---

## Chat Session Lifecycle, Pruning & Retention Policy

Chat sessions and messages are persisted in PostgreSQL (`chat_sessions`, `chat_messages`) with automatic lifecycle management:

### 1. Inactive Session Pruning & Retention Window
- **Retention Period:** Default `30` days, configurable via `AI_CHAT_SESSION_RETENTION_DAYS`.
- **Cleanup Trigger:** Automatic scheduled cron job (`handleScheduledCleanup` running daily at midnight via `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)`), or programmatically via `chatSessionService.pruneInactiveSessions()`.
- **Cascading:** Stale sessions older than the retention window based on `updatedAt` are deleted along with their corresponding `chat_messages` and `ai_tool_call_logs` (`ON DELETE CASCADE`).
- **Data Privacy & Compliance:** Inactive conversations are permanently removed to minimize PII surface area and control long-term storage overhead.

### 2. Per-Session Message Count Cap
- **Per-Session Limit:** Default `50` messages, configurable via `AI_CHAT_MAX_SESSION_MESSAGES`.
- **Eviction Behavior:** When a session accumulates more messages than the cap, the oldest messages are pruned from the database during `appendExchange`, preventing unbounded table growth for long conversations.

### 3. In-Context History Summarization & Truncation
- **Summarization Threshold:** Default `10` messages, configurable via `AI_CHAT_SUMMARIZATION_THRESHOLD`.
- **Token Estimation Limit:** Default `4000` tokens, configurable via `AI_CHAT_MAX_HISTORY_TOKENS`.
- **Recent Messages Kept:** Default `6` messages (3 turns), configurable via `AI_CHAT_RECENT_MESSAGES_COUNT`.
- **Mechanism:** When loaded for model context, long histories are summarized into concise conversational context turns (`[Summary of earlier conversation in this session]`), drastically reducing per-turn token spend against user token caps while preserving prompt context and alternating user/assistant message roles.

