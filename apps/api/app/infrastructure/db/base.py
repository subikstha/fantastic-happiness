# apps/api/app/infrastructure/db/base.py
"""
Purpose: Defines the single declarative base that all SQLAlchemy model classes inherit from
 - When you define class user(Base): __tablename__ = "users" ..., SQLAlchemy registers that table on Base.metadata
 - Base.metadata is what Alembic uses for autogenerat migrations. it compares this metadata to the real database and emits CREATE TABLE / ALTER TABLE scripts
 - It does not connect to the database by itself, but only describes the schema in Python
 One sentence: base.py is the shared blueprint for your ORM models and migration metadata.
"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass