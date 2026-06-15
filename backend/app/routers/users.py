"""
Admin-only User Management Router.
Provides CRUD access to user database.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.database import get_db
from app.models import Notification, Project, Task, User
from app.schemas import AdminProjectSummaryResponse, UserAdminSummaryResponse, UserResponse, UserCreate, UserUpdate
from app.utils.security import hash_password
from app.routers.auth_deps import get_admin_user

router = APIRouter(prefix="/users", tags=["Admin User Management"])

@router.get("", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """List all registered users (Admin only)."""
    stmt = select(User).order_by(User.username)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/summary", response_model=List[UserAdminSummaryResponse])
async def list_user_summaries(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """List users with isolated project/task environment stats (Admin only)."""
    users_result = await db.execute(select(User).order_by(User.username))
    users = users_result.scalars().all()
    summaries: list[UserAdminSummaryResponse] = []
    for user in users:
        project_count = (
            await db.execute(select(func.count(Project.id)).where(Project.user_id == user.id))
        ).scalar() or 0
        task_count = (
            await db.execute(
                select(func.count(Task.id))
                .join(Project, Task.project_id == Project.id)
                .where(Project.user_id == user.id)
            )
        ).scalar() or 0
        notification_count = (
            await db.execute(select(func.count(Notification.id)).where(Notification.user_id == user.id))
        ).scalar() or 0
        latest_project_at = (
            await db.execute(select(func.max(Project.updated_at)).where(Project.user_id == user.id))
        ).scalar()
        projects_result = await db.execute(
            select(Project)
            .where(Project.user_id == user.id)
            .order_by(Project.updated_at.desc())
        )
        project_summaries: list[AdminProjectSummaryResponse] = []
        for project in projects_result.scalars().all():
            project_task_count = (
                await db.execute(select(func.count(Task.id)).where(Task.project_id == project.id))
            ).scalar() or 0
            project_progress = (
                await db.execute(select(func.avg(Task.progress)).where(Task.project_id == project.id))
            ).scalar() or 0
            project_summaries.append(
                AdminProjectSummaryResponse(
                    id=project.id,
                    name=project.name,
                    description=project.description,
                    task_count=project_task_count,
                    progress=int(project_progress),
                    updated_at=project.updated_at,
                )
            )
        summaries.append(
            UserAdminSummaryResponse(
                id=user.id,
                username=user.username,
                email=user.email,
                role=user.role,
                created_at=user.created_at,
                updated_at=user.updated_at,
                project_count=project_count,
                task_count=task_count,
                notification_count=notification_count,
                latest_project_at=latest_project_at,
                projects=project_summaries,
            )
        )
    return summaries

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user_by_admin(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """Create a new user directly (Admin only)."""
    stmt_username = select(User).where(User.username == data.username)
    res_username = await db.execute(stmt_username)
    if res_username.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already taken.",
        )

    stmt_email = select(User).where(User.email == data.email)
    res_email = await db.execute(stmt_email)
    if res_email.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered.",
        )

    hashed = hash_password(data.password)
    new_user = User(
        username=data.username,
        email=data.email,
        hashed_password=hashed,
        role="user"  # defaults to user
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.put("/{user_id}", response_model=UserResponse)
async def update_user_by_admin(
    user_id: str,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """Update user role, email, username, or password (Admin only)."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    # Prevent admin from changing their own role to prevent lockout
    if user.id == admin_user.id and data.role and data.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot revoke their own admin permissions."
        )

    if data.username is not None:
        user.username = data.username
    if data.email is not None:
        user.email = data.email
    if data.role is not None:
        if data.role not in ["admin", "user"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role must be 'admin' or 'user'."
            )
        user.role = data.role
    if data.password is not None:
        user.hashed_password = hash_password(data.password)

    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_by_admin(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """Delete a user from the system (Admin only)."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    # Prevent self-deletion
    if user.id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own admin account."
        )

    await db.delete(user)
    await db.commit()
