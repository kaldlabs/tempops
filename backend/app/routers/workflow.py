"""
Workflow layer: audit logs, notifications, automation rules, templates, and search.
"""
from datetime import date, datetime, timedelta, timezone
import json

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ActivityLog, AutomationRule, Dependency, Notification, Project, ProjectTemplate, Task, User
from app.routers.auth_deps import get_current_user
from app.schemas import (
    ActivityLogResponse,
    AutomationRuleCreate,
    AutomationRuleResponse,
    GlobalSearchResponse,
    NotificationResponse,
    ProjectResponse,
    ProjectTemplateResponse,
    SearchResultResponse,
)

router = APIRouter(tags=["Workflow"])


async def create_activity(
    db: AsyncSession,
    *,
    user_id: str | None,
    project_id: str | None,
    task_id: str | None = None,
    action: str,
    entity_type: str,
    entity_id: str | None,
    summary: str,
    before: dict | None = None,
    after: dict | None = None,
) -> ActivityLog:
    log = ActivityLog(
        user_id=user_id,
        project_id=project_id,
        task_id=task_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        summary=summary,
        before_json=json.dumps(before, default=str) if before else None,
        after_json=json.dumps(after, default=str) if after else None,
    )
    db.add(log)
    return log


async def create_notification(
    db: AsyncSession,
    *,
    user_id: str,
    project_id: str | None,
    task_id: str | None,
    type: str,
    title: str,
    message: str,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        project_id=project_id,
        task_id=task_id,
        type=type,
        title=title,
        message=message,
    )
    db.add(notification)
    return notification


@router.get("/activity", response_model=list[ActivityLogResponse])
async def list_activity(
    project_id: str | None = None,
    limit: int = Query(40, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(ActivityLog)
        .outerjoin(Project, ActivityLog.project_id == Project.id)
        .where(or_(ActivityLog.user_id == current_user.id, Project.user_id == current_user.id))
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
    )
    if project_id:
        stmt = stmt.where(ActivityLog.project_id == project_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    unread_only: bool = False,
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    if unread_only:
        stmt = stmt.where(Notification.is_read == False)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = await db.get(Notification, notification_id)
    if not notification or notification.user_id != current_user.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    await db.flush()
    await db.refresh(notification)
    return notification


@router.get("/automation/rules", response_model=list[AutomationRuleResponse])
async def list_automation_rules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AutomationRule)
        .where(AutomationRule.user_id == current_user.id)
        .order_by(AutomationRule.created_at.desc())
    )
    return result.scalars().all()


@router.post("/automation/rules", response_model=AutomationRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_automation_rule(
    data: AutomationRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rule = AutomationRule(
        user_id=current_user.id,
        project_id=data.project_id,
        name=data.name,
        trigger=data.trigger,
        action=data.action,
        is_enabled=data.is_enabled,
        config_json=data.config_json,
    )
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return rule


@router.post("/automation/run")
async def run_automation(
    project_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    stmt = (
        select(Task)
        .join(Project, Task.project_id == Project.id)
        .where(Project.user_id == current_user.id)
        .where(Task.status != "DONE")
        .where(Task.end_date < today)
    )
    if project_id:
        stmt = stmt.where(Task.project_id == project_id)
    result = await db.execute(stmt)
    overdue_tasks = result.scalars().all()
    for task in overdue_tasks:
        task.status = "OVERDUE"
        await create_notification(
            db,
            user_id=current_user.id,
            project_id=task.project_id,
            task_id=task.id,
            type="task_overdue",
            title="Task overdue",
            message=f"{task.name} is past its planned end date.",
        )
    now = datetime.now(timezone.utc)
    rules = await db.execute(select(AutomationRule).where(AutomationRule.user_id == current_user.id))
    for rule in rules.scalars().all():
        rule.last_run_at = now
    return {"status": "ok", "overdue_marked": len(overdue_tasks)}


@router.get("/templates", response_model=list[ProjectTemplateResponse])
async def list_templates(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(ProjectTemplate).order_by(ProjectTemplate.category, ProjectTemplate.name))
    return result.scalars().all()


@router.post("/templates/{template_id}/instantiate", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def instantiate_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    template = await db.get(ProjectTemplate, template_id)
    if not template:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Template not found")

    payload = json.loads(template.template_json)
    phases = payload.get("phases") or [template.category]
    total_days = max(int(payload.get("default_duration_days") or 14), len(phases))
    phase_days = max(total_days // max(len(phases), 1), 1)
    start = date.today()

    project = Project(
        user_id=current_user.id,
        name=f"{template.name} · {start.strftime('%b %d')}",
        description=f"Generated from {template.name}. {template.description}",
    )
    db.add(project)
    await db.flush()

    previous_phase: Task | None = None
    for index, phase in enumerate(phases):
        phase_start = start + timedelta(days=index * phase_days)
        phase_end = phase_start + timedelta(days=phase_days - 1)
        task = Task(
            project_id=project.id,
            name=str(phase),
            description=f"{template.category} phase generated from template.",
            start_date=phase_start,
            end_date=phase_end,
            progress=0,
            status="TODO",
            priority="M",
            sort_order=index,
            is_locked=True,
        )
        db.add(task)
        await db.flush()
        if previous_phase:
            db.add(
                Dependency(
                    project_id=project.id,
                    predecessor_id=previous_phase.id,
                    successor_id=task.id,
                    dependency_type="FS",
                )
            )
        previous_phase = task

    await create_activity(
        db,
        user_id=current_user.id,
        project_id=project.id,
        action="template_instantiated",
        entity_type="project",
        entity_id=project.id,
        summary=f"Created project from template {template.name}",
        after={"template_id": template.id, "phases": phases},
    )
    await db.flush()
    await db.refresh(project)
    return project


@router.get("/search", response_model=GlobalSearchResponse)
async def global_search(
    q: str = Query(..., min_length=1, max_length=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = f"%{q.lower()}%"
    results: list[SearchResultResponse] = []

    projects = await db.execute(
        select(Project)
        .where(Project.user_id == current_user.id)
        .where(or_(Project.name.ilike(query), Project.description.ilike(query)))
        .limit(8)
    )
    for project in projects.scalars().all():
        results.append(SearchResultResponse(id=project.id, type="project", title=project.name, subtitle=project.description, href=f"/projects/{project.id}", project_id=project.id, score=90))

    tasks = await db.execute(
        select(Task)
        .join(Project, Task.project_id == Project.id)
        .where(Project.user_id == current_user.id)
        .where(or_(Task.name.ilike(query), Task.description.ilike(query), Task.status.ilike(query), Task.priority.ilike(query)))
        .limit(12)
    )
    for task in tasks.scalars().all():
        results.append(SearchResultResponse(id=task.id, type="task", title=task.name, subtitle=f"{task.status} · {task.progress}%", href=f"/projects/{task.project_id}", project_id=task.project_id, score=80))

    templates = await db.execute(
        select(ProjectTemplate)
        .where(or_(ProjectTemplate.name.ilike(query), ProjectTemplate.description.ilike(query), ProjectTemplate.category.ilike(query)))
        .limit(6)
    )
    for template in templates.scalars().all():
        results.append(SearchResultResponse(id=template.id, type="template", title=template.name, subtitle=template.category, href="/templates", score=60))

    return GlobalSearchResponse(query=q, results=results)
