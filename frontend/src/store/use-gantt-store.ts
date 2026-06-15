/**
 * Zustand store for Gantt chart UI state.
 * Manages client-only state that doesn't need to persist to the server.
 */
import { create } from "zustand";
import type { ZoomMode } from "@/types";

interface GanttStore {
  /* ── View State ──────────────────────────────────────── */
  zoomMode: ZoomMode;
  setZoomMode: (mode: ZoomMode) => void;

  workspaceView: "timeline" | "analytics" | "dependencies";
  setWorkspaceView: (view: "timeline" | "analytics" | "dependencies") => void;

  showDependencies: boolean;
  toggleDependencies: () => void;

  showInsights: boolean;
  toggleInsights: () => void;

  /* ── Selection ───────────────────────────────────────── */
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;

  hoveredTaskId: string | null;
  setHoveredTaskId: (id: string | null) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  /* ── Side Panel ──────────────────────────────────────── */
  isSidePanelOpen: boolean;
  openSidePanel: (taskId: string) => void;
  closeSidePanel: () => void;

  /* ── Tree Expansion ──────────────────────────────────── */
  expandedTaskIds: Set<string>;
  toggleExpanded: (taskId: string) => void;
  expandAll: (ids: string[]) => void;

  /* ── New Task Modal ──────────────────────────────────── */
  isNewTaskModalOpen: boolean;
  setNewTaskModalOpen: (open: boolean) => void;
}

export const useGanttStore = create<GanttStore>((set) => ({
  zoomMode: "day",
  setZoomMode: (mode) => set({ zoomMode: mode }),

  workspaceView: "timeline",
  setWorkspaceView: (view) => set({ workspaceView: view }),

  showDependencies: true,
  toggleDependencies: () =>
    set((state) => ({ showDependencies: !state.showDependencies })),

  showInsights: true,
  toggleInsights: () =>
    set((state) => ({ showInsights: !state.showInsights })),

  selectedTaskId: null,
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),

  hoveredTaskId: null,
  setHoveredTaskId: (id) => set({ hoveredTaskId: id }),

  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),

  isSidePanelOpen: false,
  openSidePanel: (taskId) =>
    set({ isSidePanelOpen: true, selectedTaskId: taskId }),
  closeSidePanel: () => set({ isSidePanelOpen: false }),

  expandedTaskIds: new Set<string>(),
  toggleExpanded: (taskId) =>
    set((state) => {
      const next = new Set(state.expandedTaskIds);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return { expandedTaskIds: next };
    }),
  expandAll: (ids) => set({ expandedTaskIds: new Set(ids) }),

  isNewTaskModalOpen: false,
  setNewTaskModalOpen: (open) => set({ isNewTaskModalOpen: open }),
}));
