"""Async AI job placeholder.

This intentionally does not run inference. It mirrors the Celery contract:
FastAPI returns 202 + job_id immediately, a worker later writes results and
emits a WebSocket event.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone


_jobs: dict[str, dict] = {}


def create_ai_job(prompt: str, project_id: str | None, user_id: str) -> dict:
    job_id = str(uuid.uuid4())
    job = {
        "job_id": job_id,
        "status": "queued",
        "project_id": project_id,
        "prompt": prompt,
        "result": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "message": "AI job queued. Worker integration is intentionally empty.",
        "user_id": user_id,
    }
    _jobs[job_id] = job
    return job


def get_ai_job(job_id: str) -> dict | None:
    return _jobs.get(job_id)
