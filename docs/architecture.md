# Architecture

## Backend Structure
FastAPI backend is organized as a modular monolith:

`apps/api/app/`
- `api/`: HTTP layer (routers, endpoint handlers, dependencies)
- `application/services/`: business logic (services call SQLAlchemy directly)
- `schemas/`: Pydantic request/response DTOs
- `infrastructure/db/`: SQLAlchemy models + session + DB utilities
- `core/`: cross-cutting concerns (config, security, OAuth helpers)

## Flow
Request → Router (FastAPI endpoints) → Service (business logic) → DB (SQLAlchemy via `AsyncSession`)

## Design Decisions
- Modular monolith
- Service-layer pattern
- No separate repository/DAO layer right now (queries live in services)
- DTOs with Pydantic for request/response contracts