# AI chat streaming reconnect (#644)

`POST /ai/chat/stream` (SSE) previously had no way to recover from a dropped
connection: a client that lost its network mid-reply had to restart the
whole exchange, discarding (and re-billing) everything already generated.
This documents the reconnect contract `GET /ai/chat/stream/:streamId/resume`
adds, for frontend/mobile client implementers.

This is a different mechanism from the existing `pause_turn` handling inside
`AiAgentService.chatStream` — that resumes a long-running *server-tool* turn
within the same open connection. This is about the *client's own connection*
dropping and coming back.

## How it works

`AiAgentService.chatStream()` now runs the Anthropic generation detached
from any single HTTP connection: it registers itself with
`AiChatStreamRegistryService` under a fresh `streamId`, and every event it
produces is both broadcast to whoever is currently listening *and* appended
to an in-memory, sequence-numbered buffer for that stream. The original
caller is just the first listener attached to that buffer — a reconnecting
client calling the resume endpoint is attached the exact same way, just
starting from a later sequence number. Dropping a connection only tears down
that one listener; the generation itself keeps running and keeps buffering
regardless of whether anyone is currently attached.

## Event protocol

The **first** event on every new (non-resumed) stream is now:

```json
{ "type": "stream_start", "data": { "streamId": "…", "sessionId": "…" } }
```

A client must capture `streamId` as soon as this event arrives — before any
`text` starts flowing — since that's the only way to resume if the
connection drops moments later. Every event after it (`tool_call`, `text`,
`done`) is unchanged from before.

## Resuming

```
GET /ai/chat/stream/:streamId/resume?afterSeq=<n>
Authorization: Bearer <jwt>
```

- `streamId` — from the `stream_start` event of the original stream.
- `afterSeq` (optional, default resumes from the start) — the sequence
  number of the **last event the client actually received** before the
  connection dropped. Events are numbered from 0 in emission order
  (`stream_start` is seq 0); the response replays everything *after*
  `afterSeq`, then continues live until the stream completes. Supplying the
  exact last-seen seq is what prevents re-delivering content the client
  already has — there is no dedup based on event content, only on this
  cursor, so get it from what you actually received, not from an assumed
  count.
- Same SSE response shape as `/ai/chat/stream` otherwise: `text`/`tool_call`
  events, then a terminal `done` (or an `error` channel event if the
  generation itself failed).
- No `AiChatRateLimitGuard` on this route: resuming replays an
  already-in-flight (already-paid-for) generation rather than starting a
  new one, so it doesn't draw on the chat rate-limit or spend-cap budget.
- `404` if `streamId` is unknown or its resume window has elapsed (see
  below). `403` if the authenticated user isn't the one who started it.

## Resume window

A stream stays resumable for `STREAM_RESUME_WINDOW_MS` (10 minutes) after it
**completes or fails** — not from when it started — so a client has a real
window to notice the drop, reconnect, and catch up even after the reply had
already finished generating. A stream that somehow never completes (a bug,
a hung Anthropic call) is evicted after `MAX_STREAM_LIFETIME_MS` (10 minutes)
regardless, as a safety net against an unbounded registry.

Resuming an **already-completed** stream still works within that window: the
buffered events (including the terminal `done`) are replayed immediately, no
different from catching up on a still-in-flight one.

## Known limitation: single backend instance

The stream registry is in-memory, per backend process — intentionally, to
keep this change scoped to the actual problem (a client's connection
dropping), not a distributed-systems rewrite. A stream can only be resumed
against the **same backend instance** that started it. Behind a load
balancer without sticky sessions, a resume request routed to a different
instance gets a `404` (the instance it lands on has never heard of that
`streamId`), indistinguishable from a genuinely expired stream.

If that gap matters for a given deployment, the two realistic options are:
sticky sessions keyed on `streamId` at the load balancer, or moving the
registry's buffer/broadcast onto a shared store (e.g. Redis pub/sub) — not
attempted here. A client should treat a `404` resume the same way it already
treats "the stream is just gone": fall back to starting a new `chatStream()`
call rather than treating it as a different error class.

## Client implementation sketch

```text
1. POST /ai/chat/stream, open the SSE connection.
2. On the first event, if type === "stream_start": store data.streamId and
   reset a local event counter to 0.
3. For every event received after that (in order), increment the counter —
   this is the seq of the event just received.
4. On a dropped connection (before a terminal `done`/error event):
   GET /ai/chat/stream/{streamId}/resume?afterSeq={last counter value}
   and keep appending to the same UI state as if the original connection
   had never dropped.
5. On a 404/403 from the resume call: give up resuming and start a fresh
   POST /ai/chat/stream instead.
```

## Deferred: cross-instance resume

Not attempted here — see "Known limitation" above. Worth revisiting if this
backend runs multiple replicas behind a non-sticky load balancer and the gap
turns out to matter in practice.
