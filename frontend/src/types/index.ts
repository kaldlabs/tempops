/* TypeScript interfaces matching backend Pydantic schemas */

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectListItem extends Project {
  task_count: number;
  progress: number;
}

export interface Task {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  progress: number;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  sort_order: number;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskTreeNode extends Task {
  children: TaskTreeNode[];
}

export interface Dependency {
  id: string;
  project_id: string;
  predecessor_id: string;
  successor_id: string;
  dependency_type: DependencyType;
  created_at: string;
}

export interface GanttData {
  project: Project;
  tasks: TaskTreeNode[];
  dependencies: Dependency[];
}

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "OVERDUE";
export type TaskPriority = "H" | "M" | "L";
export type DependencyType = "FS" | "SS" | "FF" | "SF";

export interface TaskCreate {
  project_id: string;
  parent_id?: string | null;
  name: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  progress?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string | null;
  sort_order?: number;
  is_locked?: boolean;
}

export interface TaskUpdate {
  name?: string;
  description?: string | null;
  parent_id?: string | null;
  start_date?: string;
  end_date?: string;
  progress?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string | null;
  sort_order?: number;
  is_locked?: boolean;
}

export interface ProjectCreate {
  name: string;
  description?: string | null;
}

export interface DependencyCreate {
  project_id: string;
  predecessor_id: string;
  successor_id: string;
  dependency_type?: DependencyType;
}

/* Flat task list for rendering (with depth for tree indent) */
export interface FlatTask extends Task {
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
}

/* Zoom modes for Gantt timeline */
export type ZoomMode = "quarter" | "month" | "week" | "day" | "detail" | "max";

export interface User {
  id: string;
  username: string;
  email: string;
  role: "admin" | "user";
  created_at: string;
  updated_at: string;
}

export interface UserAdminSummary extends User {
  project_count: number;
  task_count: number;
  notification_count: number;
  latest_project_at: string | null;
  projects: AdminProjectSummary[];
}

export interface AdminProjectSummary {
  id: string;
  name: string;
  description: string | null;
  task_count: number;
  progress: number;
  updated_at: string;
}

export interface UserCreate {
  username: string;
  email: string;
  password?: string;
}

export interface UserUpdate {
  username?: string;
  email?: string;
  password?: string;
  role?: "admin" | "user";
}

export interface AIJobResponse {
  job_id: string;
  status: string;
  message: string;
  project_id: string | null;
  created_at: string;
}

export interface MLAtRiskTask {
  task_id: string;
  name: string;
  progress: number;
  days_left: number;
  reason: string;
  tags: string[];
}

export interface ProjectMLAnalysis {
  health: "healthy" | "watch" | "critical" | string;
  completion: number;
  task_count: number;
  dependency_count: number;
  at_risk: MLAtRiskTask[];
  tag_counts: Record<string, number>;
  recommendations: string[];
}

export interface IntegrationProvider {
  provider: string;
  name: string;
  category: string;
  description: string;
  strengths: string[];
  tempops_advantage: string;
  auth_type: string;
  supported_actions: string[];
  status: string;
}

export interface IntegrationConnection {
  id: string;
  provider: string;
  status: string;
  sync_mode: string;
  source_url: string | null;
  external_workspace: string | null;
  last_sync_summary: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationOverview {
  providers: IntegrationProvider[];
  connections: IntegrationConnection[];
}

export interface IntegrationConnectionCreate {
  provider: string;
  source_url?: string | null;
  external_workspace?: string | null;
  sync_mode?: string;
}

export interface IntegrationSyncResponse {
  provider: string;
  status: string;
  message: string;
  imported_projects: number;
  imported_tasks: number;
  next_step: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  project_id: string | null;
  task_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  project_id: string | null;
  task_id: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AutomationRule {
  id: string;
  project_id: string | null;
  name: string;
  trigger: string;
  action: string;
  is_enabled: boolean;
  config_json: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectTemplate {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  template_json: string;
  created_at: string;
}

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  href: string;
  project_id: string | null;
  score: number;
}

export interface GlobalSearchResponse {
  query: string;
  results: SearchResult[];
}
