"""
AI stub endpoints - placeholder for future Qwen3.5-27B-Opus integration.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.models import User
from app.routers.auth_deps import get_current_user
from app.services.ai_jobs import create_ai_job, get_ai_job

from app.schemas import AIBreakdownRequest, AIJobRequest, AIJobResponse, AINLToGanttRequest, AIStubResponse

router = APIRouter(prefix="/ai", tags=["AI (Coming Soon)"])


@router.post("/jobs", response_model=AIJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_ai_placeholder_job(
    data: AIJobRequest,
    current_user: User = Depends(get_current_user)
):
    """Queue an AI job placeholder.

    Production path: replace `create_ai_job` with Celery `delay`, have the
    worker call Qdrant + vLLM, then persist results and publish a WebSocket
    event to `project_{id}`.
    """
    job = create_ai_job(data.prompt, data.project_id, current_user.id)
    return AIJobResponse(**job)


@router.get("/jobs/{job_id}", response_model=AIJobResponse)
async def get_ai_placeholder_job(
    job_id: str,
    current_user: User = Depends(get_current_user)
):
    job = get_ai_job(job_id)
    if not job or job["user_id"] != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI job not found")
    return AIJobResponse(**job)


@router.post("/breakdown", response_model=AIStubResponse)
async def ai_breakdown(
    data: AIBreakdownRequest,
    current_user: User = Depends(get_current_user)
):
    """
    AI Task Breakdown (WBS) - Not yet implemented.

    Will decompose a high-level task into sub-tasks using Qwen3.5-27B-Opus.
    See ai_model_it.md Section 2 for full specification.
    """
    return AIStubResponse(
        status="not_implemented",
        message=(
            f"AI Breakdown for '{data.task_name}' is not yet available. "
            "This endpoint will integrate with Qwen3.5-27B-Opus for automated "
            "Work Breakdown Structure generation."
        ),
    )


@router.post("/nl-to-gantt", response_model=AIStubResponse)
async def ai_nl_to_gantt(
    data: AINLToGanttRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Natural Language to Gantt - Not yet implemented.

    Will convert natural language commands to structured Gantt operations
    using Qwen3.5-27B-Opus + Qdrant semantic search.
    See ai_model_it.md Section 3 for full specification.
    """
    return AIStubResponse(
        status="not_implemented",
        message=(
            f"NL-to-Gantt command '{data.command}' is not yet available. "
            "This endpoint will use semantic search (Qdrant) + Qwen3.5-27B-Opus "
            "to create/modify tasks from natural language instructions."
        ),
    )
