"""
Task CRUD endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Project, Task, User
from app.schemas import ProgressUpdate, TaskCreate, TaskResponse, TaskUpdate
from app.routers.auth_deps import get_current_user
from app.services.realtime import project_ws_manager
from app.routers.workflow import create_activity, create_notification

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    project_id: str = Query(..., description="Filter tasks by project ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all tasks for a project, ordered by sort_order (owner check)."""
    # Verify project exists and is owned by user
    project = await db.get(Project, project_id)
    if not project or (project.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    stmt = (
        select(Task)
        .where(Task.project_id == project_id)
        .order_by(Task.sort_order, Task.created_at)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new task (owner check)."""
    # Verify project exists and is owned by user
    project = await db.get(Project, data.project_id)
    if not project or (project.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    # Verify parent task if specified
    if data.parent_id:
        parent = await db.get(Task, data.parent_id)
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Parent task not found"
            )
        if parent.project_id != data.project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent task must belong to the same project",
            )

    task = Task(
        project_id=data.project_id,
        parent_id=data.parent_id,
        name=data.name,
        description=data.description,
        start_date=data.start_date,
        end_date=data.end_date,
        progress=data.progress,
        status=data.status.value,
        priority=data.priority.value,
        assignee_id=data.assignee_id,
        sort_order=data.sort_order,
        is_locked=data.is_locked,
    )
    db.add(task)
    await db.flush()
    await create_activity(
        db,
        user_id=current_user.id,
        project_id=task.project_id,
        task_id=task.id,
        action="task_created",
        entity_type="task",
        entity_id=task.id,
        summary=f"Created task {task.name}",
        after={"name": task.name, "start_date": task.start_date, "end_date": task.end_date},
    )
    await db.refresh(task)
    await project_ws_manager.broadcast_project(
        task.project_id,
        {"type": "TASK_CREATED", "project_id": task.project_id, "task_id": task.id},
    )
    return task


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single task by ID (owner check)."""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    # Check project owner
    project = await db.get(Project, task.project_id)
    if not project or (project.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    return task


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    data: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a task (owner check)."""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    # Check project owner
    project = await db.get(Project, task.project_id)
    if not project or (project.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )

    update_data = data.model_dump(exclude_unset=True)
    before = {
        "name": task.name,
        "start_date": task.start_date,
        "end_date": task.end_date,
        "status": task.status,
        "progress": task.progress,
        "is_locked": task.is_locked,
    }

    # Validate dates if both are provided or one is being updated
    new_start = update_data.get("start_date", task.start_date)
    new_end = update_data.get("end_date", task.end_date)
    if new_end < new_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must be >= start_date",
        )

    # Convert enums to values
    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = update_data["status"].value
    if "priority" in update_data and update_data["priority"] is not None:
        update_data["priority"] = update_data["priority"].value

    for key, value in update_data.items():
        setattr(task, key, value)

    await db.flush()
    after = {
        "name": task.name,
        "start_date": task.start_date,
        "end_date": task.end_date,
        "status": task.status,
        "progress": task.progress,
        "is_locked": task.is_locked,
    }
    changed_fields = [key for key in before if before[key] != after[key]]
    if changed_fields:
        await create_activity(
            db,
            user_id=current_user.id,
            project_id=task.project_id,
            task_id=task.id,
            action="task_updated",
            entity_type="task",
            entity_id=task.id,
            summary=f"Updated {task.name}: {', '.join(changed_fields)}",
            before=before,
            after=after,
        )
    if {"start_date", "end_date", "status"} & set(changed_fields):
        await create_notification(
            db,
            user_id=current_user.id,
            project_id=task.project_id,
            task_id=task.id,
            type="timeline_changed",
            title="Timeline changed",
            message=f"{task.name} changed: {', '.join(changed_fields)}.",
        )
    await db.refresh(task)
    await project_ws_manager.broadcast_project(
        task.project_id,
        {"type": "TASK_UPDATED", "project_id": task.project_id, "task_id": task.id},
    )
    return task


@router.patch("/{task_id}/progress", response_model=TaskResponse)
async def update_progress(
    task_id: str,
    data: ProgressUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Quick progress update for a task (owner check)."""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    # Check project owner
    project = await db.get(Project, task.project_id)
    if not project or (project.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    
    task.progress = data.progress
    # Auto-update status based on progress
    if data.progress == 100:
        task.status = "DONE"
    elif data.progress > 0:
        task.status = "IN_PROGRESS"
    await db.flush()
    await create_activity(
        db,
        user_id=current_user.id,
        project_id=task.project_id,
        task_id=task.id,
        action="progress_updated",
        entity_type="task",
        entity_id=task.id,
        summary=f"Updated progress for {task.name} to {task.progress}%",
        after={"progress": task.progress, "status": task.status},
    )
    await db.refresh(task)
    await project_ws_manager.broadcast_project(
        task.project_id,
        {"type": "TASK_PROGRESS_UPDATED", "project_id": task.project_id, "task_id": task.id},
    )
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a task (children cascade, owner check)."""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    # Check project owner
    project = await db.get(Project, task.project_id)
    if not project or (project.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    project_id = task.project_id
    await create_activity(
        db,
        user_id=current_user.id,
        project_id=project_id,
        task_id=task.id,
        action="task_deleted",
        entity_type="task",
        entity_id=task.id,
        summary=f"Deleted task {task.name}",
        before={"name": task.name, "start_date": task.start_date, "end_date": task.end_date},
    )
    await db.delete(task)
    await project_ws_manager.broadcast_project(
        project_id,
        {"type": "TASK_DELETED", "project_id": project_id, "task_id": task_id},
    )
