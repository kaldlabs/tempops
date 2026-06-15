"""
Integration hub endpoints.
Stores connector state now and provides stable contracts for OAuth/import adapters later.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import IntegrationConnection, User
from app.routers.auth_deps import get_current_user
from app.schemas import (
    IntegrationConnectionCreate,
    IntegrationConnectionResponse,
    IntegrationConnectionUpdate,
    IntegrationOverviewResponse,
    IntegrationProviderResponse,
    IntegrationSyncResponse,
)

router = APIRouter(prefix="/integrations", tags=["Integrations"])


PROVIDERS: dict[str, IntegrationProviderResponse] = {
    "notion": IntegrationProviderResponse(
        provider="notion",
        name="Notion",
        category="Knowledge + lightweight project docs",
        description="Import project briefs, meeting notes, decision logs, and task tables into tempops planning context.",
        strengths=["Docs", "Databases", "Decision logs"],
        tempops_advantage="Turns notes and tables into locked Gantt tasks, dependency checks, risk signals, and delivery reports.",
        auth_type="oauth",
        supported_actions=["import_docs", "import_task_database", "link_project_context"],
        status="adapter_ready",
    ),
    "trello": IntegrationProviderResponse(
        provider="trello",
        name="Trello",
        category="Kanban execution",
        description="Map boards, lists, labels, cards, and due dates into a timeline-driven delivery plan.",
        strengths=["Cards", "Lists", "Labels", "Due dates"],
        tempops_advantage="Keeps Kanban execution but adds Gantt dependencies, task locks, schedule drift, and workload analysis.",
        auth_type="oauth",
        supported_actions=["import_board", "sync_cards", "map_labels_to_tags"],
        status="adapter_ready",
    ),
    "confluence": IntegrationProviderResponse(
        provider="confluence",
        name="Confluence",
        category="Enterprise documentation",
        description="Connect specs, requirements, release notes, and runbooks to project tasks.",
        strengths=["Requirements", "Runbooks", "Release docs"],
        tempops_advantage="Links documentation to timeline decisions so execution risk is visible beside the Gantt chart.",
        auth_type="oauth",
        supported_actions=["import_pages", "link_requirements", "sync_release_notes"],
        status="adapter_ready",
    ),
    "jira": IntegrationProviderResponse(
        provider="jira",
        name="Jira",
        category="Issue tracking",
        description="Connect epics, stories, sprints, blockers, and assignees to tempops schedule analysis.",
        strengths=["Epics", "Sprints", "Issues", "Assignees"],
        tempops_advantage="Adds executive timeline, cross-project dependency flow, and ML health on top of issue execution.",
        auth_type="oauth",
        supported_actions=["import_epics", "sync_issues", "track_blockers"],
        status="adapter_ready",
    ),
    "google_calendar": IntegrationProviderResponse(
        provider="google_calendar",
        name="Google Calendar",
        category="Calendar",
        description="Publish milestones, due dates, and release windows to team calendars.",
        strengths=["Milestones", "Deadlines", "Availability"],
        tempops_advantage="Keeps dates synchronized from the Gantt source of truth instead of manually copying deadlines.",
        auth_type="oauth",
        supported_actions=["publish_milestones", "sync_deadlines", "read_availability"],
        status="adapter_ready",
    ),
    "github": IntegrationProviderResponse(
        provider="github",
        name="GitHub",
        category="Engineering delivery",
        description="Map issues, pull requests, releases, and deployment signals to execution risk.",
        strengths=["Issues", "Pull requests", "Releases"],
        tempops_advantage="Combines code delivery signals with schedule dependencies and release readiness reporting.",
        auth_type="oauth",
        supported_actions=["sync_issues", "sync_pr_signals", "link_releases"],
        status="adapter_ready",
    ),
}


async def _get_connection(
    provider: str,
    db: AsyncSession,
    current_user: User,
) -> IntegrationConnection:
    stmt = select(IntegrationConnection).where(
        IntegrationConnection.user_id == current_user.id,
        IntegrationConnection.provider == provider,
    )
    result = await db.execute(stmt)
    connection = result.scalars().first()
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration not connected")
    return connection


@router.get("", response_model=IntegrationOverviewResponse)
async def list_integrations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(IntegrationConnection)
        .where(IntegrationConnection.user_id == current_user.id)
        .order_by(IntegrationConnection.updated_at.desc())
    )
    result = await db.execute(stmt)
    return IntegrationOverviewResponse(
        providers=list(PROVIDERS.values()),
        connections=list(result.scalars().all()),
    )


@router.post("/connections", response_model=IntegrationConnectionResponse, status_code=status.HTTP_201_CREATED)
async def connect_integration(
    data: IntegrationConnectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    provider = data.provider.lower()
    if provider not in PROVIDERS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported integration provider")

    stmt = select(IntegrationConnection).where(
        IntegrationConnection.user_id == current_user.id,
        IntegrationConnection.provider == provider,
    )
    result = await db.execute(stmt)
    connection = result.scalars().first()
    if connection:
        connection.source_url = data.source_url
        connection.external_workspace = data.external_workspace
        connection.sync_mode = data.sync_mode
        connection.status = "configured" if data.source_url or data.external_workspace else "needs_oauth"
    else:
        connection = IntegrationConnection(
            user_id=current_user.id,
            provider=provider,
            source_url=data.source_url,
            external_workspace=data.external_workspace,
            sync_mode=data.sync_mode,
            status="configured" if data.source_url or data.external_workspace else "needs_oauth",
        )
        db.add(connection)

    await db.flush()
    await db.refresh(connection)
    return connection


@router.put("/connections/{provider}", response_model=IntegrationConnectionResponse)
async def update_integration(
    provider: str,
    data: IntegrationConnectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    connection = await _get_connection(provider.lower(), db, current_user)
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(connection, key, value)
    await db.flush()
    await db.refresh(connection)
    return connection


@router.post("/connections/{provider}/sync", response_model=IntegrationSyncResponse)
async def sync_integration(
    provider: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    provider_key = provider.lower()
    if provider_key not in PROVIDERS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported integration provider")

    connection = await _get_connection(provider_key, db, current_user)
    provider_meta = PROVIDERS[provider_key]
    now = datetime.now(timezone.utc)
    connection.last_synced_at = now
    connection.status = "ready"
    connection.last_sync_summary = (
        f"{provider_meta.name} adapter contract verified. OAuth/API credentials are required for live import."
    )
    await db.flush()
    await db.refresh(connection)

    return IntegrationSyncResponse(
        provider=provider_key,
        status="ready_for_live_adapter",
        message=connection.last_sync_summary,
        next_step=(
            "Add OAuth credentials and map external fields to Project, Task, Dependency, "
            "DocumentContext, and RiskSignal records."
        ),
    )


@router.delete("/connections/{provider}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_integration(
    provider: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    connection = await _get_connection(provider.lower(), db, current_user)
    await db.delete(connection)
