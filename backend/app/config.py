"""
Application configuration.
Supports SQLite (local dev) and PostgreSQL (production) via DATABASE_URL.
"""
import os
import secrets
import logging
from functools import cached_property

from pydantic_settings import BaseSettings
from pydantic import field_validator

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ── Project ────────────────────────────────────────────────────────
    PROJECT_NAME: str = "tempops API"
    PROJECT_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug_flag(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production", "false", "0", "off"}:
                return False
            if normalized in {"debug", "dev", "development", "true", "1", "on"}:
                return True
        return value

    # ── Database ───────────────────────────────────────────────────────
    # SQLite for local dev:  sqlite+aiosqlite:///./tempops.db
    # PostgreSQL for prod:   postgresql+asyncpg://user:pass@host:5432/tempops
    DATABASE_URL: str = "sqlite+aiosqlite:///./tempops.db"

    # ── CORS ───────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    
    # Frontend URL for OAuth redirects
    FRONTEND_URL: str = "http://localhost:3000"

    # ── Server ─────────────────────────────────────────────────────────
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # ── Security ───────────────────────────────────────────────────────
    # TODO(security): Replace with proper secret management (KMS) in production
    SECRET_KEY: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    @cached_property
    def resolved_secret_key(self) -> str:
        """Resolve secret key: env -> file -> ephemeral random."""
        if self.SECRET_KEY:
            return self.SECRET_KEY
        secret_file = os.path.join(os.path.dirname(__file__), "..", "secret_key.txt")
        if os.path.exists(secret_file):
            with open(secret_file, encoding="utf-8") as f:
                return f.read().strip()
        logger.warning(
            "Generating ephemeral secret key. Instance-isolated! "
            "Set SECRET_KEY env var for production."
        )
        return secrets.token_hex(32)

    # ── Rate Limiting ──────────────────────────────────────────────────
    RATE_LIMIT: str = "100/minute"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def is_sqlite(self) -> bool:
        return "sqlite" in self.DATABASE_URL


settings = Settings()
