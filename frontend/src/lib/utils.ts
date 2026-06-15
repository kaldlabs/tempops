/**
 * Utility functions: date helpers, formatters, color mapping.
 */
import type { TaskStatus, TaskPriority, TaskTreeNode, FlatTask } from "@/types";

/* ── Date Helpers ──────────────────────────────────────────────── */

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function generateDateRange(start: Date, days: number): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/* ── Status/Priority Helpers ───────────────────────────────────── */

export function statusLabel(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    TODO: "To Do",
    IN_PROGRESS: "Doing",
    DONE: "Done",
    OVERDUE: "Overdue",
  };
  return map[status] || status;
}

export function statusClass(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    TODO: "badge--todo",
    IN_PROGRESS: "badge--in-progress",
    DONE: "badge--done",
    OVERDUE: "badge--overdue",
  };
  return map[status] || "";
}

export function taskBarClass(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    TODO: "task-bar--todo",
    IN_PROGRESS: "task-bar--in-progress",
    DONE: "task-bar--done",
    OVERDUE: "task-bar--overdue",
  };
  return map[status] || "task-bar--todo";
}

export function priorityLabel(priority: TaskPriority): string {
  const map: Record<TaskPriority, string> = { H: "High", M: "Medium", L: "Low" };
  return map[priority] || priority;
}

/* ── Assignee Avatar Colors ────────────────────────────────────── */

const AVATAR_COLORS = ["avatar--blue", "avatar--green", "avatar--purple", "avatar--orange", "avatar--pink"];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function avatarInitials(name: string): string {
  return name.replace("@", "").slice(0, 2).toUpperCase();
}

/* ── Tree Flattening ───────────────────────────────────────────── */

export function flattenTaskTree(
  nodes: TaskTreeNode[],
  depth: number = 0,
  expandedIds: Set<string>
): FlatTask[] {
  const result: FlatTask[] = [];
  for (const node of nodes) {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    result.push({
      ...node,
      depth,
      isExpanded,
      hasChildren,
    });
    if (hasChildren && isExpanded) {
      result.push(...flattenTaskTree(node.children, depth + 1, expandedIds));
    }
  }
  return result;
}
