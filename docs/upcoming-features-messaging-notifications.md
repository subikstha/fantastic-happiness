# Upcoming features: direct messaging and in-app notifications

**Status:** backlog — not implemented. Aligns with the Next.js + FastAPI + PostgreSQL architecture (`Router → Service → DB`). When shipped, update [`docs/context.md`](context.md) and trim this file as needed.

---

## Goals

- Allow **one user to message another** (start with **1:1** threads; group chat is a later extension).
- Provide **in-app notifications** (bell / badge) so recipients know about new messages (and later: mentions, replies, moderation, etc.).
- Prefer **simple HTTP first**, then optional **real-time** layers only when product needs them.

---

## Data model (PostgreSQL)

### Messaging (minimum viable)

| Table / concept | Purpose |
|-----------------|--------|
| **`conversations`** | Represents a thread between two users (e.g. unique pair `(user_a_id, user_b_id)` with canonical ordering, or a surrogate `conversation_id`). |
| **`messages`** | `id`, `conversation_id`, `sender_id`, `body`, `created_at`; optional `read_at`, `edited_at`. |

**Later / optional:** `message_attachments`, `user_blocks` / `user_mutes`, `message_reports` for moderation.

### Notifications (separate from raw messages)

Keep **notifications** as their own table so the same pipeline can cover DMs, @mentions, “new answer on your question,” etc.

| Column (conceptual) | Purpose |
|---------------------|--------|
| `id`, `user_id` (recipient) | Who should see the alert. |
| `type` | e.g. `new_message`, `mention`, `answer_on_question`. |
| `payload` (JSON) | `conversation_id`, `message_id`, preview snippet, deep-link keys. |
| `read_at` | Null = unread; supports “mark read” and badge counts. |
| `created_at` | Ordering and retention policies. |

**On each new message:** insert `messages` row, then insert **`notifications`** for the recipient (unless you intentionally skip in edge cases, e.g. user is actively viewing that thread—optional optimization).

---

## Recommended delivery approach (transport)

### Messaging

| Phase | Transport | When to use |
|-------|-----------|-------------|
| **v1** | **REST only** + **polling** or refresh-on-focus | `POST` send, `GET` list messages / conversations. Poll every 10–30s or on navigation. Easiest behind normal proxies; JWT matches existing API patterns. |
| **v2** | **Server-Sent Events (SSE)** | One long-lived `GET` stream pushes “new message” (and optionally notification) events; sending still `POST`. Good **server → client** updates without WebSocket complexity. |
| **v3** | **WebSockets** | When you need **duplex** real-time: typing indicators, presence, very chat-heavy UX, or unified socket for many event types. Adds: auth on connect, reconnect, multi-worker **pub/sub** (e.g. Redis) if you scale past one API process. |

**Recommendation:** **Do not start with WebSockets.** Ship **REST + polling** (or manual refresh), add **SSE** when latency feels insufficient, add **WebSockets** only when the product clearly needs bidirectional live behavior.

### Notifications (how the UI “gets” them)

| Phase | How |
|-------|-----|
| **v1** | **REST** `GET /notifications?unread=1&limit=20` for bell + badge; poll or refetch on route change. |
| **v2** | **SSE** `GET /notifications/stream` (or a single combined SSE) to push `new_notification` without aggressive polling. |
| **v3** | WebSockets *can* carry notifications, but **SSE is enough** for many apps if you only need server → client. |

**Principle:** **Persist notifications in Postgres first**; polling / SSE / WebSocket only **deliver awareness** of new rows to the client.

---

## API sketch (FastAPI)

Illustrative routes (names can vary):

- `GET /conversations` — inbox for current user.
- `POST /conversations` — open or resume a 1:1 thread with `recipient_id`.
- `GET /conversations/{id}/messages?cursor=` — paginated history.
- `POST /conversations/{id}/messages` — send; server writes `messages` + `notifications`.
- `GET /notifications` — list; query params for unread-only, pagination.
- `PATCH /notifications/{id}/read` or `POST /notifications/mark-all-read`.

All protected with **`get_current_user`** (JWT), same as answers create.

---

## Frontend (Next.js)

- Pages: e.g. `/messages`, `/messages/[conversationId]`.
- Global shell: **notification bell** (server component or client fetch to FastAPI with session token).
- Prefer **server actions or `api` client** calling FastAPI with `Authorization: Bearer` (consistent with migration direction).

---

## Product and safety (decide early)

- **Who can message whom:** open DMs vs followers-only vs “only after interaction” — reduces spam.
- **Rate limits** per user (messages per minute).
- **Blocks / opt-out** from DMs from strangers.
- **Moderation:** report flow, retention, optional automated screening later (see AI backlog docs).

---

## Related docs

- Project context and other backlog: [`docs/context.md`](context.md)
- AI / quality backlog (optional future: automated screening of message content): [`docs/upcoming-features-ai-quality.md`](upcoming-features-ai-quality.md)
- Broader AI/NLP product notes: [`docs/ai-nlp-future-integrations.md`](ai-nlp-future-integrations.md)
