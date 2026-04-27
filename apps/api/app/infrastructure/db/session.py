""" 
Purpose: Creates the engine (connection pool) and session factory, and exposes get_db for FastAPI.
- create_async_engine(settings.DATABASE_URL, ...) — opens the pool to PostgreSQL (via asyncpg in your URL).
- async_sessionmaker — builds AsyncSession instances per request (or per unit of work).
- get_db — FastAPI dependency that yields a session so route handlers can run queries/commits; when the request ends, the session is cleaned up.
One sentence: session.py is the live database connection and request-scoped session your API uses when handling HTTP requests.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session
