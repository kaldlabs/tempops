"""
Project CRUD endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Project, Task, User
from app.schemas import ProjectCreate, ProjectListResponse, ProjectResponse, ProjectUpdate
from app.routers.auth_deps import get_current_user

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=list[ProjectListResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List projects visible to the current user."""
    stmt = (
        select(Project)
        .order_by(Project.updated_at.desc())
    )
    if current_user.role != "admin":
        stmt = stmt.where(Project.user_id == current_user.id)
    result = await db.execute(stmt)
    projects = result.scalars().all()

    response = []
    for proj in projects:
        # Calculate aggregates
        task_stmt = select(func.count(Task.id)).where(Task.project_id == proj.id)
        task_count = (await db.execute(task_stmt)).scalar() or 0

        avg_stmt = select(func.avg(Task.progress)).where(Task.project_id == proj.id)
        avg_progress = (await db.execute(avg_stmt)).scalar() or 0

        response.append(
            ProjectListResponse(
                id=proj.id,
                name=proj.name,
                description=proj.description,
                created_at=proj.created_at,
                updated_at=proj.updated_at,
                task_count=task_count,
                progress=int(avg_progress),
            )
        )
    return response


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new project associated with the logged-in user."""
    project = Project(
        name=data.name,
        description=data.description,
        user_id=current_user.id
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single project by ID."""
    project = await db.get(Project, project_id)
    if not project or (project.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a project."""
    project = await db.get(Project, project_id)
    if not project or (project.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    await db.flush()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a project and all its tasks/dependencies."""
    project = await db.get(Project, project_id)
    if not project or (project.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    await db.delete(project)
