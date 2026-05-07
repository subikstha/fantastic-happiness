# API Design

## Auth
POST /auth/login
POST /auth/register

## Questions
GET /questions
POST /questions

## AI/NLP MVP (Short Version)

### Scope (first release only)
1. Question quality assistant (pre-post suggestions)
2. Duplicate question suggestions (top similar threads)
3. Auto-tagging suggestions (top 3-5 tags)

### Why these three first
- They improve content quality at creation time.
- They reduce duplicate/noisy content early.
- They are lower risk than fully automated moderation actions.

### Implementation order
1. Auto-tagging
2. Question quality assistant
3. Duplicate suggestions

### MVP guardrails
- AI should suggest, not auto-publish or auto-delete.
- Keep all decisions user-confirmed in UI.
- Log model outputs and user acceptance for later tuning.