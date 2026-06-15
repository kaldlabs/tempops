"""Lightweight project intelligence endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Dependency, Project, Task, User
from app.routers.auth_deps import get_current_user
from app.schemas import ProjectMLAnalysisResponse
from app.services.ml_analysis import analyze_project

router = APIRouter(prefix="/ml", tags=["Machine Learning"])


@router.get("/projects/{project_id}/analysis", response_model=ProjectMLAnalysisResponse)
async def project_analysis(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await db.get(Project, project_id)
    if not project or (project.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    task_result = await db.execute(
        select(Task).where(Task.project_id == project_id).order_by(Task.sort_order, Task.created_at)
    )
    dep_result = await db.execute(select(Dependency).where(Dependency.project_id == project_id))
    return analyze_project(list(task_result.scalars().all()), list(dep_result.scalars().all()))
