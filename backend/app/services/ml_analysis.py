"""Lightweight task intelligence helpers.

These deterministic heuristics stand in for a future small NLP classifier
(PhoBERT / multi-label classifier). They are fast enough to run inline and keep
the heavy LLM path reserved for explicit AI jobs.
"""
from __future__ import annotations

from datetime import date

from app.models import Dependency, Task


TAG_RULES = {
    "DevOps": ["server", "ci", "cd", "deploy", "docker", "kubernetes", "pipeline"],
    "Frontend": ["ui", "ux", "frontend", "react", "next", "css", "design"],
    "Backend": ["api", "fastapi", "database", "postgres", "redis", "worker"],
    "QA": ["test", "qa", "lint", "smoke", "verify"],
    "AI": ["ai", "qwen", "model", "inference", "prompt", "nlp"],
}


def classify_task(task: Task) -> list[str]:
    text = f"{task.name} {task.description or ''}".lower()
    tags = [tag for tag, words in TAG_RULES.items() if any(word in text for word in words)]
    if task.priority == "H":
        tags.append("High Priority")
    return tags or ["General"]


def analyze_project(tasks: list[Task], dependencies: list[Dependency]) -> dict:
    today = date.today()
    blocked_ids = {dep.successor_id for dep in dependencies}
    at_risk = []
    tag_counts: dict[str, int] = {}

    for task in tasks:
        tags = classify_task(task)
        for tag in tags:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
        days_left = (task.end_date - today).days
        if task.status != "DONE" and (days_left < 0 or (days_left <= 3 and task.progress < 80) or task.id in blocked_ids):
            at_risk.append(
                {
                    "task_id": task.id,
                    "name": task.name,
                    "progress": task.progress,
                    "days_left": days_left,
                    "reason": "blocked" if task.id in blocked_ids else "schedule",
                    "tags": tags,
                }
            )

    done = sum(1 for task in tasks if task.status == "DONE")
    completion = round((done / len(tasks)) * 100) if tasks else 0
    health = "healthy"
    if len(at_risk) >= 5:
        health = "critical"
    elif at_risk:
        health = "watch"

    return {
        "health": health,
        "completion": completion,
        "task_count": len(tasks),
        "dependency_count": len(dependencies),
        "at_risk": at_risk[:8],
        "tag_counts": tag_counts,
        "recommendations": [
            "Prioritize blocked high-impact tasks." if at_risk else "Keep current execution rhythm.",
            "Use AI assistant to draft WBS, then review before applying.",
            "Split tasks longer than 7 days into reviewable checkpoints.",
        ],
    }
