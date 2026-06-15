"""
Gantt data endpoint - returns full project data in a single API call.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Dependency, Project, Task, User
from app.schemas import (
    DependencyResponse,
    GanttDataResponse,
    ProjectResponse,
    TaskTreeResponse,
)
from app.routers.auth_deps import get_current_user

router = APIRouter(prefix="/projects", tags=["Gantt"])


def _build_task_tree(tasks: list, parent_id: str | None = None) -> list[dict]:
    """Recursively build a tree structure from flat task list."""
    tree = []
    for task in tasks:
        if task.parent_id == parent_id:
            children = _build_task_tree(tasks, task.id)
            tree.append(
                {
                    "id": task.id,
                    "project_id": task.project_id,
                    "parent_id": task.parent_id,
                    "name": task.name,
                    "description": task.description,
                    "start_date": task.start_date,
                    "end_date": task.end_date,
                    "progress": task.progress,
                    "status": task.status,
                    "priority": task.priority,
                    "assignee_id": task.assignee_id,
                    "sort_order": task.sort_order,
                    "is_locked": task.is_locked,
                    "created_at": task.created_at,
                    "updated_at": task.updated_at,
                    "children": children,
                }
            )
    return tree


@router.get("/{project_id}/gantt", response_model=GanttDataResponse)
async def get_gantt_data(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Return full Gantt data: project info, task tree, and dependencies.
    Single API call for complete chart rendering.
    """
    # Get project
    project = await db.get(Project, project_id)
    if not project or (project.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    # Get all tasks for this project
    task_stmt = (
        select(Task)
        .where(Task.project_id == project_id)
        .order_by(Task.sort_order, Task.created_at)
    )
    task_result = await db.execute(task_stmt)
    tasks = task_result.scalars().all()

    # Get all dependencies for this project
    dep_stmt = select(Dependency).where(Dependency.project_id == project_id)
    dep_result = await db.execute(dep_stmt)
    dependencies = dep_result.scalars().all()

    # Build tree
    task_tree = _build_task_tree(list(tasks), None)

    return GanttDataResponse(
        project=ProjectResponse.model_validate(project),
        tasks=[TaskTreeResponse(**t) for t in task_tree],
        dependencies=[DependencyResponse.model_validate(d) for d in dependencies],
    )
