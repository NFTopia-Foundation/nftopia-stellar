# AI chat spend cap enforcement (#529)

`AiUsageService` tracks and bounds each user's spend on `POST /ai/chat` and `POST /ai/chat/stream` (the SSE route). This documents the decisions behind how it's enforced, configured, and overridden.

## Enforcement point

The check (`AiUsageService.assertWithinCap`) is called from inside `AiAgentService.chat` and `AiAgentService.chatStream`, immediately before the Anthropic API call — **not** as a guard.

A guard only sees the HTTP layer. `POST /ai/chat` and the SSE `POST /ai/chat/stream` route are two separate controller methods; a guard would have to be applied to both independently, with nothing stopping a future third entry point (a batch/background job, a GraphQL resolver, ...) from being added without the guard and silently bypassing the cap. Calling `assertWithinCap` from inside the one service method both HTTP routes already funnel through means there is exactly one place this can be forgotten, and it's the same place `recordUsage` (which persists the tokens that feed the *next* check) already lives.

`AiChatRateLimitGuard` remains a guard, and stays separate: it bounds *request frequency* (a 429, `Retry-After` in seconds), which is a different failure mode from *budget exhausted* (a 403, resets at a specific calendar boundary). A user hitting one is not necessarily anywhere near the other.

## What's capped

Two independent dimensions, both checked on every call:

- **Token count** (`AI_CHAT_DAILY_TOKEN_CAP` / `AI_CHAT_MONTHLY_TOKEN_CAP`) — always enforced; defaults to 200,000/day and 2,000,000/month.
- **Estimated USD spend** (`AI_CHAT_DAILY_SPEND_CAP_USD` / `AI_CHAT_MONTHLY_SPEND_CAP_USD`) — **optional**. Unset by default, in which case only the token caps apply (estimated cost is still computed and returned by `GET /ai/usage` either way — see `ai-usage-pricing.ts`). Set one or both if a mix of models makes the token count alone a poor proxy for actual dollars (a user hitting only the most expensive model spends far more per token than one hitting only the cheapest).

Both are calendar windows in UTC (since midnight / since the 1st of the month), not rolling windows.

## The error

A capped user gets a `403 ForbiddenException`, not `AiChatRateLimitGuard`'s `429`, with a JSON body carrying a machine-readable `code` and an ISO `resetsAt`, not just a prose message:

```json
{
  "statusCode": 403,
  "code": "AI_DAILY_TOKEN_CAP_REACHED",
  "message": "Daily AI usage cap reached (200000 tokens). Please try again tomorrow.",
  "resetsAt": "2026-09-29T00:00:00.000Z"
}
```

`code` is one of `AI_DAILY_TOKEN_CAP_REACHED`, `AI_MONTHLY_TOKEN_CAP_REACHED`, `AI_DAILY_SPEND_CAP_REACHED`, `AI_MONTHLY_SPEND_CAP_REACHED` — a client can branch on this instead of parsing the message, and show a countdown to `resetsAt` instead of a generic "try again later".

## Approaching-cap warning

`GET /ai/usage` returns, per window (`daily`/`monthly`):

- `percentUsed` (0–100, the higher of the token-cap and — if configured — spend-cap percentage)
- `approachingCap` (`true` once `percentUsed` crosses `AI_CHAT_CAP_WARNING_THRESHOLD`, default 80%, and before the cap is actually reached)
- `resetsAt`

so a client can show "you're close to your daily limit" before the user is actually blocked, not just discover the cap when a request is abruptly rejected.

## Admin override

There is no separate "reset" that erases usage history — `AiUsageRecord` rows are never deleted or modified by this mechanism, since they're the cost-audit trail. "Resetting" a capped user means **raising their ceiling** via an override, which an admin manages through:

- `GET /ai/admin/usage/:userId` — inspect a user's current usage/cap standing.
- `POST /ai/admin/usage/:userId/override` — set (replacing any existing) an override. Every field is optional; an omitted field falls back to the env default for that specific cap, so you can raise just the daily token cap without restating the others:
  ```json
  { "dailyTokenCap": 1000000, "reason": "Verified power user, ticket #1234" }
  ```
  Add `"expiresAt": "2026-12-31T00:00:00.000Z"` for a time-limited override; omit it for one that lasts until explicitly cleared.
- `DELETE /ai/admin/usage/:userId/override` — clear it, reverting the user to the env-configured default caps.

All three require `JwtAuthGuard` + `RolesGuard` with `@Roles(UserRole.ADMIN)` — see the note in `ai-agent.controller.ts` about `admin/tool-logs` previously missing `RolesGuard` in `@UseGuards(...)`, which made its own `@Roles` decorator inert; fixed alongside these new routes, which use the same (correct) pairing.

An override's cap fields are consulted in `assertWithinCap`/`getUsageSummary` in place of the env defaults; an expired override (`expiresAt` in the past) is treated as absent automatically, without an admin needing to clean it up.

## Per-tier caps: deliberately not built as a separate concept

The problem this issue described included "no notion of different spend limits for different user tiers". There is no subscription/billing-tier concept anywhere in this codebase today — only `UserRole` (`USER`/`ADMIN`/`MODERATOR`), which is an *authorization* role, not a billing tier. Automatically deriving spend caps from that role would conflate the two, and baking a fake tier system on top of it would likely need undoing once a real subscription concept exists.

The admin-override mechanism above already covers the practical need (a specific user needs a different cap than the default) without inventing tiering. If/when this codebase gains real subscription tiers, mapping a tier to a default cap is a small, additive change to `getEffectiveCaps` in `ai-usage.service.ts` — the override mechanism, error shape, and warning threshold all stay as they are.

## Tests

`ai-usage.service.spec.ts` covers boundary conditions (just under / exactly at / just over both the token and USD caps), the approaching-cap threshold, override precedence and expiry, and the structured error body. `ai-agent.controller.spec.ts` covers the new admin routes' guards and delegation.
