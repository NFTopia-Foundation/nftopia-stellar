# Chat Session Retention & Pruning Architecture

This document describes the retention, lifecycle management, database pruning, and history summarization policies implemented for AI chat sessions in `nftopia-backend`.

---

## 1. Overview & Problem Statement

Prior to this implementation:
- Chat messages were persisted to PostgreSQL without an eviction policy, causing tables (`chat_sessions`, `chat_messages`, `ai_tool_call_logs`) to grow indefinitely.
- Inactive chat sessions were never purged.
- Long-running conversations sent their entire history to Anthropic Claude on every exchange, inflating token consumption and prematurely burning through users' daily/monthly token limits.
- No formal data retention policy was documented for user privacy and compliance.

---

## 2. Retention & Pruning Strategy

### Inactive Session Cleanup
- **Default Retention Window:** `30` days of inactivity.
- **Config Key:** `AI_CHAT_SESSION_RETENTION_DAYS`
- **Execution Mechanism:**
  - Automated daily cron task at midnight (`@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)` in `ChatSessionService.handleScheduledCleanup`).
  - Programmatic / manual execution via `chatSessionService.pruneInactiveSessions(retentionDays?)`.
- **Cascading Deletion:** Deleting a `ChatSession` automatically removes all associated `chat_messages` and `ai_tool_call_logs` via foreign key `ON DELETE CASCADE`.

### In-Session Database Message Capping
- **Default Limit:** `50` messages per session.
- **Config Key:** `AI_CHAT_MAX_SESSION_MESSAGES`
- **Behavior:** Upon appending new message exchanges (`appendExchange`), if the message count for that session exceeds the cap, the oldest excess records are pruned from the database.

### In-Context History Summarization & Truncation
- **Summarization Message Threshold:** `10` messages (`AI_CHAT_SUMMARIZATION_THRESHOLD`).
- **Summarization Token Threshold:** `4000` tokens (`AI_CHAT_MAX_HISTORY_TOKENS`).
- **Verbatim Recent Messages Window:** `6` messages / 3 turns (`AI_CHAT_RECENT_MESSAGES_COUNT`).
- **Mechanism:**
  - When loading conversation history for model execution in `loadOrCreateSession`, if the session exceeds message count or token thresholds, older messages are summarized into structured topic synopses.
  - Returns a user summary turn and assistant acknowledgement, followed by the latest recent turns.
  - Maintains strict Anthropic role alternation (`user` -> `assistant` -> `user` -> `assistant`).

---

## 3. Configuration Reference

| Environment Variable | Default | Description |
|---|---|---|
| `AI_CHAT_SESSION_RETENTION_DAYS` | `30` | Inactivity window (in days) after which chat sessions are pruned. |
| `AI_CHAT_MAX_SESSION_MESSAGES` | `50` | Maximum messages stored per session in the database. |
| `AI_CHAT_SUMMARIZATION_THRESHOLD` | `10` | Message count threshold triggering LLM context summarization. |
| `AI_CHAT_MAX_HISTORY_TOKENS` | `4000` | Estimated token threshold triggering LLM context summarization. |
| `AI_CHAT_RECENT_MESSAGES_COUNT` | `6` | Number of recent messages preserved verbatim in summarized history. |
