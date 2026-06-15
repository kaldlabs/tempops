/**
 * API client for tempops backend.
 * Typed fetch wrapper with error handling.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const WS_BASE = API_BASE.replace(/^http/, "ws").replace(/\/api\/v1$/, "");

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (options.headers) {
    Object.entries(options.headers).forEach(([k, v]) => {
      headers[k] = String(v);
    });
  }

  const method = options.method?.toUpperCase() || "GET";
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrfToken = getCookie("csrf_token");
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
  }

  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Projects ────────────────────────────────────────────────────
import type {
  DependencyCreate,
  Dependency,
  GanttData,
  Project,
  ProjectCreate,
  ProjectListItem,
  Task,
  TaskCreate,
  TaskUpdate,
  User,
  UserAdminSummary,
  UserCreate,
  UserUpdate,
  AIJobResponse,
  ProjectMLAnalysis,
  IntegrationConnection,
  IntegrationConnectionCreate,
  IntegrationOverview,
  IntegrationSyncResponse,
  ActivityLog,
  AutomationRule,
  GlobalSearchResponse,
  NotificationItem,
  ProjectTemplate,
} from "@/types";

export const api = {
  projects: {
    list: () => request<ProjectListItem[]>("/projects"),
    get: (id: string) => request<Project>(`/projects/${encodeURIComponent(id)}`),
    create: (data: ProjectCreate) =>
      request<Project>("/projects", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<ProjectCreate>) =>
      request<Project>(`/projects/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/projects/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  tasks: {
    list: (projectId: string) =>
      request<Task[]>(`/tasks?project_id=${encodeURIComponent(projectId)}`),
    get: (id: string) => request<Task>(`/tasks/${encodeURIComponent(id)}`),
    create: (data: TaskCreate) =>
      request<Task>("/tasks", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: TaskUpdate) =>
      request<Task>(`/tasks/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    updateProgress: (id: string, progress: number) =>
      request<Task>(`/tasks/${encodeURIComponent(id)}/progress`, {
        method: "PATCH",
        body: JSON.stringify({ progress }),
      }),
    delete: (id: string) =>
      request<void>(`/tasks/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  dependencies: {
    create: (data: DependencyCreate) =>
      request<Dependency>("/dependencies", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/dependencies/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  gantt: {
    getData: (projectId: string) =>
      request<GanttData>(`/projects/${encodeURIComponent(projectId)}/gantt`),
  },

  auth: {
    register: (data: UserCreate & { password?: string }) =>
      request<User>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    login: (data: Record<string, string>) =>
      request<{ status: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    logout: () =>
      request<{ status: string; message: string }>("/auth/logout", {
        method: "POST",
      }),
    me: () => request<{ user: User }>("/auth/me"),
  },

  users: {
    list: () => request<User[]>("/users"),
    summary: () => request<UserAdminSummary[]>("/users/summary"),
    create: (data: UserCreate & { password?: string }) =>
      request<User>("/users", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UserUpdate) =>
      request<User>(`/users/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/users/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  ai: {
    createJob: (data: { prompt: string; project_id?: string | null }) =>
      request<AIJobResponse>("/ai/jobs", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getJob: (id: string) => request<AIJobResponse>(`/ai/jobs/${encodeURIComponent(id)}`),
  },

  ml: {
    projectAnalysis: (projectId: string) =>
      request<ProjectMLAnalysis>(`/ml/projects/${encodeURIComponent(projectId)}/analysis`),
  },

  integrations: {
    overview: () => request<IntegrationOverview>("/integrations"),
    connect: (data: IntegrationConnectionCreate) =>
      request<IntegrationConnection>("/integrations/connections", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    sync: (provider: string) =>
      request<IntegrationSyncResponse>(`/integrations/connections/${encodeURIComponent(provider)}/sync`, {
        method: "POST",
      }),
    disconnect: (provider: string) =>
      request<void>(`/integrations/connections/${encodeURIComponent(provider)}`, {
        method: "DELETE",
      }),
  },

  workflow: {
    activity: (projectId?: string) =>
      request<ActivityLog[]>(`/activity${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ""}`),
    notifications: () => request<NotificationItem[]>("/notifications"),
    markNotificationRead: (id: string) =>
      request<NotificationItem>(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST" }),
    automationRules: () => request<AutomationRule[]>("/automation/rules"),
    createAutomationRule: (data: Pick<AutomationRule, "name" | "trigger" | "action" | "project_id" | "is_enabled" | "config_json">) =>
      request<AutomationRule>("/automation/rules", { method: "POST", body: JSON.stringify(data) }),
    runAutomation: (projectId?: string) =>
      request<{ status: string; overdue_marked: number }>(`/automation/run${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ""}`, { method: "POST" }),
    templates: () => request<ProjectTemplate[]>("/templates"),
    instantiateTemplate: (id: string) =>
      request<Project>(`/templates/${encodeURIComponent(id)}/instantiate`, { method: "POST" }),
    search: (query: string) => request<GlobalSearchResponse>(`/search?q=${encodeURIComponent(query)}`),
  },

  health: () => request<{ status: string; version: string; database: string }>("/health"),
};

export function projectSocketUrl(projectId: string) {
  return `${WS_BASE}/ws/projects/${encodeURIComponent(projectId)}`;
}
