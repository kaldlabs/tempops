"""
Pydantic v2 schemas for request/response validation.
"""
from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ── Enums ──────────────────────────────────────────────────────────────

class TaskStatus(str, Enum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"
    OVERDUE = "OVERDUE"


class TaskPriority(str, Enum):
    HIGH = "H"
    MEDIUM = "M"
    LOW = "L"


class DependencyType(str, Enum):
    FS = "FS"  # Finish-to-Start
    SS = "SS"  # Start-to-Start
    FF = "FF"  # Finish-to-Finish
    SF = "SF"  # Start-to-Finish


# ── Project Schemas ────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    description: str | None = Field(None, max_length=5000)


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=5000)


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class ProjectListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    task_count: int = 0
    progress: int = 0


# ── Task Schemas ───────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    project_id: str = Field(..., description="Parent project ID")
    parent_id: str | None = Field(None, description="Parent task ID (for WBS hierarchy)")
    name: str = Field(..., min_length=1, max_length=255, description="Task name")
    description: str | None = Field(None, max_length=5000)
    start_date: date
    end_date: date
    progress: int = Field(0, ge=0, le=100)
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    assignee_id: str | None = Field(None, max_length=100)
    sort_order: int = 0
    is_locked: bool = True

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v: date, info) -> date:
        start = info.data.get("start_date")
        if start and v < start:
            raise ValueError("end_date must be >= start_date")
        return v


class TaskUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=5000)
    parent_id: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    progress: int | None = Field(None, ge=0, le=100)
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    assignee_id: str | None = Field(None, max_length=100)
    sort_order: int | None = None
    is_locked: bool | None = None


class ProgressUpdate(BaseModel):
    progress: int = Field(..., ge=0, le=100)


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    parent_id: str | None
    name: str
    description: str | None
    start_date: date
    end_date: date
    progress: int
    status: str
    priority: str
    assignee_id: str | None
    sort_order: int
    is_locked: bool
    created_at: datetime
    updated_at: datetime


class TaskTreeResponse(TaskResponse):
    """Task with nested children for tree rendering."""
    children: list["TaskTreeResponse"] = []


# ── Dependency Schemas ─────────────────────────────────────────────────

class DependencyCreate(BaseModel):
    project_id: str
    predecessor_id: str
    successor_id: str
    dependency_type: DependencyType = DependencyType.FS

    @field_validator("successor_id")
    @classmethod
    def no_self_dependency(cls, v: str, info) -> str:
        pred = info.data.get("predecessor_id")
        if pred and v == pred:
            raise ValueError("A task cannot depend on itself")
        return v


class DependencyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    predecessor_id: str
    successor_id: str
    dependency_type: str
    created_at: datetime


# ── Gantt Data (composite) ─────────────────────────────────────────────

class GanttDataResponse(BaseModel):
    """Full Gantt data: task tree + dependencies in a single response."""
    project: ProjectResponse
    tasks: list[TaskTreeResponse]
    dependencies: list[DependencyResponse]


# ── AI Stub Schemas ────────────────────────────────────────────────────

class AIBreakdownRequest(BaseModel):
    task_name: str = Field(..., min_length=1, max_length=500)
    context: str | None = Field(None, max_length=2000)


class AINLToGanttRequest(BaseModel):
    command: str = Field(..., min_length=1, max_length=1000)
    project_id: str


class AIStubResponse(BaseModel):
    status: str = "not_implemented"
    message: str = "AI integration coming soon. See ai_model_it.md for roadmap."


class AIJobRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    project_id: str | None = None


class AIJobResponse(BaseModel):
    job_id: str
    status: str
    message: str
    project_id: str | None = None
    created_at: str


class ProjectMLAnalysisResponse(BaseModel):
    health: str
    completion: int
    task_count: int
    dependency_count: int
    at_risk: list[dict]
    tag_counts: dict[str, int]
    recommendations: list[str]


# ── Health ─────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "healthy"
    version: str
    database: str


# ── User & Auth Schemas ──────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)


class UserUpdate(BaseModel):
    username: str | None = Field(None, min_length=3, max_length=50)
    email: str | None = Field(None, min_length=3, max_length=255)
    password: str | None = Field(None, min_length=8, max_length=128)
    role: str | None = Field(None, description="admin or user")


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    email: str
    role: str
    created_at: datetime
    updated_at: datetime


class AdminProjectSummaryResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    task_count: int = 0
    progress: int = 0
    updated_at: datetime


class UserAdminSummaryResponse(UserResponse):
    project_count: int = 0
    task_count: int = 0
    notification_count: int = 0
    latest_project_at: datetime | None = None
    projects: list[AdminProjectSummaryResponse] = Field(default_factory=list)


class LoginRequest(BaseModel):
    username: str
    password: str


class CurrentUserResponse(BaseModel):
    user: UserResponse


# ── Integration Schemas ────────────────────────────────────────────────

class IntegrationProviderResponse(BaseModel):
    provider: str
    name: str
    category: str
    description: str
    strengths: list[str]
    tempops_advantage: str
    auth_type: str
    supported_actions: list[str]
    status: str = "available"


class IntegrationConnectionCreate(BaseModel):
    provider: str = Field(..., min_length=2, max_length=50)
    source_url: str | None = Field(None, max_length=1000)
    external_workspace: str | None = Field(None, max_length=255)
    sync_mode: str = Field("manual", max_length=30)


class IntegrationConnectionUpdate(BaseModel):
    source_url: str | None = Field(None, max_length=1000)
    external_workspace: str | None = Field(None, max_length=255)
    sync_mode: str | None = Field(None, max_length=30)
    status: str | None = Field(None, max_length=30)


class IntegrationConnectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    provider: str
    status: str
    sync_mode: str
    source_url: str | None
    external_workspace: str | None
    last_sync_summary: str | None
    last_synced_at: datetime | None
    created_at: datetime
    updated_at: datetime


class IntegrationOverviewResponse(BaseModel):
    providers: list[IntegrationProviderResponse]
    connections: list[IntegrationConnectionResponse]


class IntegrationSyncResponse(BaseModel):
    provider: str
    status: str
    message: str
    imported_projects: int = 0
    imported_tasks: int = 0
    next_step: str


# ── Commercial Workflow Schemas ───────────────────────────────────────

class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str | None
    project_id: str | None
    task_id: str | None
    action: str
    entity_type: str
    entity_id: str | None
    summary: str
    before_json: str | None
    after_json: str | None
    created_at: datetime


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str | None
    task_id: str | None
    type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime


class AutomationRuleCreate(BaseModel):
    project_id: str | None = None
    name: str = Field(..., min_length=1, max_length=255)
    trigger: str = Field(..., min_length=1, max_length=80)
    action: str = Field(..., min_length=1, max_length=80)
    is_enabled: bool = True
    config_json: str | None = None


class AutomationRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str | None
    name: str
    trigger: str
    action: str
    is_enabled: bool
    config_json: str | None
    last_run_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ProjectTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    name: str
    category: str
    description: str
    template_json: str
    created_at: datetime


class SearchResultResponse(BaseModel):
    id: str
    type: str
    title: str
    subtitle: str | None = None
    href: str
    project_id: str | None = None
    score: int = 0


class GlobalSearchResponse(BaseModel):
    query: str
    results: list[SearchResultResponse]
