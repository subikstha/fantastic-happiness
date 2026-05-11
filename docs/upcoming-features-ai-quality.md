# Upcoming features: AI, quality, and discovery

This document captures **ideas discussed for the product** that are **not implemented yet**. Use it for planning and prioritization. When something ships, move it to `docs/context.md` (Current Progress / devlog) and trim or archive this file.

**See also:** a longer rollout narrative lives in [`docs/ai-nlp-future-integrations.md`](ai-nlp-future-integrations.md). This file is a **compact backlog** (tiers + Ollama + heuristics) for quick scanning.

---

## Tier 1 — Small / low dependency (good first slices)

### Rule-based question clarity (“is this answerable?”)

- Run **heuristics** on `title` + `content` at question create (or a preview endpoint): min lengths, link-only body, obvious empty patterns.
- Return **non-blocking** `warnings: string[]` in the API response (or store on `questions` for moderation UI).
- **Why first:** no external APIs, fast, explainable; same hook can later call an LLM instead.

### Ollama (local LLM) — single integration path

- **Config:** `OLLAMA_BASE_URL` (e.g. `http://127.0.0.1:11434`), `OLLAMA_MODEL` (e.g. `llama3.2`, `mistral`, `qwen2.5`).
- **Backend:** FastAPI calls Ollama via `httpx` / `httpx.AsyncClient` (`/api/chat` or `/api/generate`), long timeouts, optional `format: "json"` + **Pydantic validation** of model output.
- **First concrete feature:** e.g. `POST /questions/{id}/ai-review` or enrich create response with `{ is_answerable, issues[], suggested_title? }`.
- **Fallback:** if Ollama is unreachable, return heuristic-only warnings or skip AI fields.

---

## Tier 2 — Medium effort (strong user value)

### Duplicate / similar question detection

- **Retrieval:** embeddings + `pgvector` (or BM25 / Postgres full-text) to find top-k similar titles.
- **Optional rerank:** small local LLM compares new post to candidates → “likely duplicate of id …”.
- **UX:** show “Possible duplicates” before submit or after draft save.

### Tag suggestion

- Multi-label classifier on existing tag set, **or** embedding similarity to tag centroids, **or** LLM with a **closed list** of allowed tags in the prompt.
- Attach suggested tags to ask form; user confirms before post.

### Answer quality hints (author-only at first)

- Rules: e.g. very short answer on a “how-to” question → soft hint.
- **Or** LLM: structured JSON comparing answer to question (no public auto-downvote until policy is clear).

---

## Tier 3 — Heavier / platform-level

### Toxicity, harassment, PII screening

- Dedicated moderation APIs or open models; threshold + appeal flow; queue for moderators.

### Semantic search

- Chunk questions/answers, embeddings, hybrid with keyword search (`pgvector` + FTS or external search engine).

### “Expertise” / difficulty routing

- LLM or classifier outputs difficulty + skills; later tie to notifications or bounties.

---

## Cross-cutting implementation notes

- **Placement:** keep LLM calls in **FastAPI** (secrets, timeouts, logging), not directly from the browser—unless you intentionally add a small local-only experiment.
- **Async:** never block the event loop; use async HTTP clients and sensible timeouts.
- **Trust:** never execute model output as code; validate all structured output; rate-limit per user.
- **Privacy:** Ollama keeps text on your infra; document data retention if you later add cloud models.

---

## Related docs

- Product / migration context: [`docs/context.md`](context.md)
- Answers API and “empty list” troubleshooting: [`docs/devlog-answers-api-parity.md`](devlog-answers-api-parity.md)
- Extended AI/NLP narrative: [`docs/ai-nlp-future-integrations.md`](ai-nlp-future-integrations.md)
- Messaging / notifications backlog: [`docs/upcoming-features-messaging-notifications.md`](upcoming-features-messaging-notifications.md)
