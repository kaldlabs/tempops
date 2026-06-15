/**
 * TanStack Query hooks for Gantt data mutations.
 * Implements optimistic updates with automatic rollback.
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { GanttData, ProjectCreate, TaskCreate, TaskUpdate, DependencyCreate } from "@/types";

/* ── Query Keys ────────────────────────────────────────────────── */
export const queryKeys = {
  projects: ["projects"] as const,
  project: (id: string) => ["project", id] as const,
  gantt: (projectId: string) => ["gantt", projectId] as const,
  integrations: ["integrations"] as const,
  notifications: ["notifications"] as const,
  activity: (projectId?: string) => ["activity", projectId || "all"] as const,
  templates: ["templates"] as const,
  automationRules: ["automation-rules"] as const,
  search: (query: string) => ["global-search", query] as const,
};

/* ── Queries ───────────────────────────────────────────────────── */

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: api.projects.list,
  });
}

export function useGanttData(projectId: string) {
  return useQuery({
    queryKey: queryKeys.gantt(projectId),
    queryFn: () => api.gantt.getData(projectId),
    enabled: !!projectId,
  });
}

export function useProjectAnalysis(projectId: string) {
  return useQuery({
    queryKey: ["project-analysis", projectId],
    queryFn: () => api.ml.projectAnalysis(projectId),
    enabled: !!projectId,
  });
}

export function useIntegrations() {
  return useQuery({
    queryKey: queryKeys.integrations,
    queryFn: api.integrations.overview,
  });
}

export function useConnectIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.integrations.connect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations });
    },
  });
}

export function useSyncIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => api.integrations.sync(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations });
    },
  });
}

export function useDisconnectIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => api.integrations.disconnect(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations });
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: api.workflow.notifications,
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.workflow.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useActivity(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.activity(projectId),
    queryFn: () => api.workflow.activity(projectId),
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: queryKeys.templates,
    queryFn: api.workflow.templates,
  });
}

export function useInstantiateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.workflow.instantiateTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.search("") });
    },
  });
}

export function useAutomationRules() {
  return useQuery({
    queryKey: queryKeys.automationRules,
    queryFn: api.workflow.automationRules,
  });
}

export function useRunAutomation(projectId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.workflow.runAutomation(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      queryClient.invalidateQueries({ queryKey: queryKeys.gantt(projectId || "") });
    },
  });
}

export function useGlobalSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.search(query),
    queryFn: () => api.workflow.search(query),
    enabled: query.trim().length >= 2,
  });
}

/* ── Project Mutations ─────────────────────────────────────────── */

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectCreate) => api.projects.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.projects.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

/* ── Task Mutations ────────────────────────────────────────────── */

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TaskCreate) => api.tasks.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gantt(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TaskUpdate }) =>
      api.tasks.update(id, data),
    // Optimistic update
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.gantt(projectId) });
      const previous = queryClient.getQueryData<GanttData>(
        queryKeys.gantt(projectId)
      );
      if (previous) {
        queryClient.setQueryData<GanttData>(queryKeys.gantt(projectId), {
          ...previous,
          tasks: updateTaskInTree(previous.tasks, id, data),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.gantt(projectId), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gantt(projectId) });
    },
  });
}

export function useUpdateProgress(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, progress }: { id: string; progress: number }) =>
      api.tasks.updateProgress(id, progress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gantt(projectId) });
    },
  });
}

export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tasks.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gantt(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

/* ── Dependency Mutations ──────────────────────────────────────── */

export function useCreateDependency(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DependencyCreate) => api.dependencies.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gantt(projectId) });
    },
  });
}

export function useDeleteDependency(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.dependencies.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gantt(projectId) });
    },
  });
}

/* ── Helpers ───────────────────────────────────────────────────── */

function updateTaskInTree(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: any[],
  taskId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updates: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  return tasks.map((task) => {
    if (task.id === taskId) {
      return { ...task, ...updates };
    }
    if (task.children?.length) {
      return {
        ...task,
        children: updateTaskInTree(task.children, taskId, updates),
      };
    }
    return task;
  });
}
