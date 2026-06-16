"""
Database engine and session factory.
Auto-detects SQLite vs PostgreSQL from DATABASE_URL.
"""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

from app.config import settings

# ── Engine Configuration ───────────────────────────────────────────────
_engine_kwargs: dict = {}

if settings.is_sqlite:
    # SQLite needs check_same_thread=False for async
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
    _engine_kwargs["echo"] = settings.DEBUG
else:
    # PostgreSQL pool settings
    # statement_cache_size=0 required for Supabase/PgBouncer in transaction mode
    _engine_kwargs["connect_args"] = {"statement_cache_size": 0}
    _engine_kwargs["pool_size"] = 20
    _engine_kwargs["max_overflow"] = 10
    _engine_kwargs["pool_pre_ping"] = True
    _engine_kwargs["echo"] = settings.DEBUG

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all models."""
    pass


async def get_db():
    """FastAPI dependency: yields an async DB session and ensures cleanup."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables (for dev/testing). Use Alembic in production."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
        await conn.execute(
            text(
                """
                UPDATE projects
                SET user_id = (
                    SELECT id FROM users
                    WHERE role = 'admin'
                    ORDER BY created_at
                    LIMIT 1
                )
                WHERE user_id IS NULL
                  AND EXISTS (SELECT 1 FROM users WHERE role = 'admin')
                """
            )
        )
        if settings.is_sqlite:
            await conn.execute(
                text(
                    """
                    INSERT OR IGNORE INTO project_templates (id, slug, name, category, description, template_json, created_at)
                    VALUES
                    (:roadmap_id, :roadmap_slug, :roadmap_name, :roadmap_category, :roadmap_description, :roadmap_json, CURRENT_TIMESTAMP),
                    (:sprint_id, :sprint_slug, :sprint_name, :sprint_category, :sprint_description, :sprint_json, CURRENT_TIMESTAMP),
                    (:release_id, :release_slug, :release_name, :release_category, :release_description, :release_json, CURRENT_TIMESTAMP)
                    """
                ),
                {
                    "roadmap_id": "tpl-roadmap-q3",
                    "roadmap_slug": "q3-roadmap",
                    "roadmap_name": "Quarterly Product Roadmap",
                    "roadmap_category": "Roadmap",
                    "roadmap_description": "Discovery, design, development, QA, and release phases for a quarterly product roadmap.",
                    "roadmap_json": '{"phases":["Discovery","Design","Development","QA","Release"],"default_duration_days":90}',
                    "sprint_id": "tpl-sprint-plan",
                    "sprint_slug": "sprint-plan",
                    "sprint_name": "Two-week Sprint Plan",
                    "sprint_category": "Sprint",
                    "sprint_description": "Backlog grooming, implementation, review, testing, and retrospective workflow.",
                    "sprint_json": '{"phases":["Planning","Build","Review","Test","Retro"],"default_duration_days":14}',
                    "release_id": "tpl-release-plan",
                    "release_slug": "release-plan",
                    "release_name": "Production Release Plan",
                    "release_category": "Release",
                    "release_description": "Release readiness, dependency freeze, QA signoff, deployment, monitoring, and rollback plan.",
                    "release_json": '{"phases":["Readiness","Freeze","QA Signoff","Deploy","Monitor"],"default_duration_days":30}',
                },
            )
            columns = await conn.execute(text("PRAGMA table_info(tasks)"))
            column_names = {row[1] for row in columns}
            if "is_locked" not in column_names:
                await conn.execute(
                    text("ALTER TABLE tasks ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT 1")
                )


async def close_db():
    """Dispose engine connections."""
    await engine.dispose()
