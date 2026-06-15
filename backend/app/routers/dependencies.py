"""
Dependency endpoints with cycle detection.
"""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Dependency, Project, Task, User
from app.schemas import DependencyCreate, DependencyResponse
from app.services.dependency_service import (
    DependencyServiceError,
    validate_and_create_dependency,
)
from app.routers.auth_deps import get_current_user
from app.routers.workflow import create_activity, create_notification
from app.services.realtime import project_ws_manager

router = APIRouter(prefix="/dependencies", tags=["Dependencies"])


@router.post("", response_model=DependencyResponse, status_code=status.HTTP_201_CREATED)
async def create_dependency(
    data: DependencyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a task dependency with validation (owner check).
    Checks: tasks exist, same project, no duplicates, no cycles.
    """
    # Verify project exists and belongs to user
    project = await db.get(Project, data.project_id)
    if not project or (project.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    try:
        dep = await validate_and_create_dependency(db, data)
        predecessor = await db.get(Task, dep.predecessor_id)
        successor = await db.get(Task, dep.successor_id)
        shifted = False
        if predecessor and successor and successor.start_date <= predecessor.end_date:
            duration = successor.end_date - successor.start_date
            successor.start_date = predecessor.end_date + timedelta(days=1)
            successor.end_date = successor.start_date + duration
            shifted = True
        await create_activity(
            db,
            user_id=current_user.id,
            project_id=dep.project_id,
            task_id=dep.successor_id,
            action="dependency_created",
            entity_type="dependency",
            entity_id=dep.id,
            summary="Created dependency and checked downstream schedule",
            after={
                "predecessor_id": dep.predecessor_id,
                "successor_id": dep.successor_id,
                "dependency_type": dep.dependency_type,
                "successor_shifted": shifted,
            },
        )
        await create_notification(
            db,
            user_id=current_user.id,
            project_id=dep.project_id,
            task_id=dep.successor_id,
            type="dependency_changed",
            title="Dependency updated",
            message=(
                "Dependency created. Downstream task was rescheduled."
                if shifted
                else "Dependency created and downstream schedule is valid."
            ),
        )
        await db.flush()
        await project_ws_manager.broadcast_project(
            dep.project_id,
            {"type": "DEPENDENCY_CREATED", "project_id": dep.project_id, "dependency_id": dep.id},
        )
        return dep
    except DependencyServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.delete("/{dependency_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dependency(
    dependency_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a dependency (owner check)."""
    dep = await db.get(Dependency, dependency_id)
    if not dep:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dependency not found"
        )
    
    # Check project ownership
    project = await db.get(Project, dep.project_id)
    if not project or (project.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dependency not found"
        )
    await db.delete(dep)
    await create_activity(
        db,
        user_id=current_user.id,
        project_id=dep.project_id,
        task_id=dep.successor_id,
        action="dependency_deleted",
        entity_type="dependency",
        entity_id=dep.id,
        summary="Removed dependency",
        before={"predecessor_id": dep.predecessor_id, "successor_id": dep.successor_id},
    )
