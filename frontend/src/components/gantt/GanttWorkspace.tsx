"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useGanttStore } from "@/store/use-gantt-store";
import { queryKeys, useGanttData, useProjectAnalysis } from "@/hooks/use-gantt-mutations";
import { useProjectRealtime } from "@/hooks/use-project-realtime";
import { api } from "@/lib/api";
import { flattenTaskTree } from "@/lib/utils";
import DataGrid from "@/components/gantt/DataGrid";
import GanttAnalyticsPanel from "@/components/gantt/GanttAnalyticsPanel";
import GanttCanvas from "@/components/gantt/GanttCanvas";
import NewTaskModal from "@/components/gantt/NewTaskModal";
import TaskSidePanel from "@/components/gantt/TaskSidePanel";
import TopNav from "@/components/layout/TopNav";
import { useT } from "@/lib/i18n";
import type { Dependency, FlatTask, TaskCreate, TaskPriority, TaskStatus } from "@/types";

interface GanttWorkspaceProps {
  projectId: string;
}

type ImportedTask = Partial<Omit<FlatTask, "progress" | "status" | "priority" | "is_locked">> & {
  id?: string;
  progress?: unknown;
  status?: unknown;
  priority?: unknown;
  is_locked?: unknown;
};

export default function GanttWorkspace({ projectId }: GanttWorkspaceProps) {
  useProjectRealtime(projectId);
  const { locale } = useT();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useGanttData(projectId);
  const { data: analysis } = useProjectAnalysis(projectId);
  const {
    expandedTaskIds,
    expandAll,
    searchQuery,
    zoomMode,
    setZoomMode,
    workspaceView,
    setWorkspaceView,
    showDependencies,
    toggleDependencies,
    openSidePanel,
  } = useGanttStore();
  const [showTaskTable, setShowTaskTable] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [transferStatus, setTransferStatus] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const dataGridScrollRef = useRef<HTMLDivElement | null>(null);
  const ganttScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncFrameRef = useRef<number | null>(null);
  const isSyncingScrollRef = useRef(false);
  const taskTree = data?.tasks;

  const syncVerticalScroll = useCallback((source: "grid" | "chart", top: number) => {
    if (isSyncingScrollRef.current) return;
    const target = source === "grid" ? ganttScrollRef.current : dataGridScrollRef.current;
    if (!target || Math.abs(target.scrollTop - top) < 1) return;
    isSyncingScrollRef.current = true;
    if (scrollSyncFrameRef.current !== null) window.cancelAnimationFrame(scrollSyncFrameRef.current);
    scrollSyncFrameRef.current = window.requestAnimationFrame(() => {
      target.scrollTop = top;
      scrollSyncFrameRef.current = null;
      window.setTimeout(() => {
        isSyncingScrollRef.current = false;
      }, 0);
    });
  }, []);

  const setTimelineScrollTop = useCallback((top: number) => {
    const chart = ganttScrollRef.current;
    const grid = dataGridScrollRef.current;
    const maxScroll = Math.max(
      chart ? chart.scrollHeight - chart.clientHeight : 0,
      grid ? grid.scrollHeight - grid.clientHeight : 0,
      0
    );
    const nextTop = Math.max(0, Math.min(top, maxScroll));
    isSyncingScrollRef.current = true;
    if (grid) grid.scrollTop = nextTop;
    if (chart) chart.scrollTop = nextTop;
    if (scrollSyncFrameRef.current !== null) window.cancelAnimationFrame(scrollSyncFrameRef.current);
    scrollSyncFrameRef.current = window.requestAnimationFrame(() => {
      scrollSyncFrameRef.current = null;
      window.setTimeout(() => {
        isSyncingScrollRef.current = false;
      }, 0);
    });
  }, []);

  const zoomSteps = useMemo(() => ["quarter", "month", "week", "day", "detail", "max"] as const, []);
  const zoomIndex = zoomSteps.indexOf(zoomMode);
  const setZoomByIndex = useCallback((index: number) => {
    setZoomMode(zoomSteps[Math.max(0, Math.min(zoomSteps.length - 1, index))]);
  }, [setZoomMode, zoomSteps]);
  const zoomOut = useCallback(() => setZoomByIndex(zoomIndex - 1), [setZoomByIndex, zoomIndex]);
  const zoomIn = useCallback(() => setZoomByIndex(zoomIndex + 1), [setZoomByIndex, zoomIndex]);
  const resetZoom = useCallback(() => setZoomMode("day"), [setZoomMode]);
  const zoomPercent = [25, 50, 75, 100, 150, 200][Math.max(0, zoomIndex)] || 100;

  const handleTimelineWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      if (event.deltaY < 0) zoomIn();
      else if (event.deltaY > 0) zoomOut();
      return;
    }
    if (!showTaskTable) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const chart = ganttScrollRef.current;
    const grid = dataGridScrollRef.current;
    const active = chart && event.currentTarget.contains(event.target as Node) ? chart : grid;
    const currentTop = active?.scrollTop || grid?.scrollTop || chart?.scrollTop || 0;
    event.preventDefault();
    setTimelineScrollTop(currentTop + event.deltaY);
  }, [setTimelineScrollTop, showTaskTable, zoomIn, zoomOut]);

  useEffect(() => {
    if (workspaceView !== "timeline") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomIn();
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomOut();
      } else if (event.key === "0") {
        event.preventDefault();
        resetZoom();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resetZoom, workspaceView, zoomIn, zoomOut]);

  // Expand all parent tasks on first load
  useEffect(() => {
    if (taskTree) {
      const parentIds: string[] = [];
      const collectParents = (nodes: NonNullable<typeof taskTree>) => {
        for (const node of nodes) {
          if (node.children?.length) {
            parentIds.push(node.id);
            collectParents(node.children);
          }
        }
      };
      collectParents(taskTree);
      expandAll(parentIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskTree]);

  const flatTasks = useMemo(() => {
    if (!taskTree) return [];
    return flattenTaskTree(taskTree, 0, expandedTaskIds);
  }, [taskTree, expandedTaskIds]);

  const allFlatTasks = useMemo(() => {
    if (!taskTree) return [];
    const collectIds = (nodes: NonNullable<typeof taskTree>, ids: string[] = []) => {
      for (const node of nodes) {
        ids.push(node.id);
        if (node.children?.length) collectIds(node.children, ids);
      }
      return ids;
    };
    return flattenTaskTree(taskTree, 0, new Set(collectIds(taskTree)));
  }, [taskTree]);

  const expandableTaskIds = useMemo(() => {
    if (!taskTree) return [];
    const ids: string[] = [];
    const collect = (nodes: NonNullable<typeof taskTree>) => {
      for (const node of nodes) {
        if (node.children?.length) {
          ids.push(node.id);
          collect(node.children);
        }
      }
    };
    collect(taskTree);
    return ids;
  }, [taskTree]);

  const visibleTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return flatTasks;
    return flatTasks.filter((task) => {
      return [
        task.name,
        task.description || "",
        task.assignee_id || "",
        task.status,
        task.priority,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [flatTasks, searchQuery]);

  const downloadTextFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const projectSlug = data?.project.name.replace(/\s+/g, "-").toLowerCase() || "tempops";

  const escapeMarkup = (value: unknown) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const exportJson = () => {
    if (!data) return;
    downloadTextFile(
      `${projectSlug}-gantt.json`,
      JSON.stringify(
        {
          version: 1,
          exported_at: new Date().toISOString(),
          project: data.project,
          tasks: allFlatTasks,
          dependencies: data.dependencies,
        },
        null,
        2
      ),
      "application/json"
    );
  };

  const csvEscape = (value: unknown) => {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  };

  const exportCsv = () => {
    if (!data) return;
    const headers = [
      "name",
      "description",
      "start_date",
      "end_date",
      "progress",
      "status",
      "priority",
      "assignee_id",
      "parent_id",
      "is_locked",
    ];
    const rows = allFlatTasks.map((task) =>
      [
        task.name,
        task.description,
        task.start_date,
        task.end_date,
        task.progress,
        task.status,
        task.priority,
        task.assignee_id,
        task.parent_id,
        task.is_locked,
      ]
        .map(csvEscape)
        .join(",")
    );
    downloadTextFile(
      `${projectSlug}-tasks.csv`,
      [headers.join(","), ...rows].join("\n"),
      "text/csv;charset=utf-8"
    );
  };

  const createGanttSvg = () => {
    if (!data || !allFlatTasks.length) return null;
    const rowHeight = 38;
    const headerHeight = 94;
    const labelWidth = 320;
    const dayWidth = 22;
    const minStart = new Date(Math.min(...allFlatTasks.map((task) => new Date(task.start_date).getTime())));
    const maxEnd = new Date(Math.max(...allFlatTasks.map((task) => new Date(task.end_date).getTime())));
    minStart.setDate(1);
    minStart.setMonth(minStart.getMonth() - 1);
    maxEnd.setMonth(maxEnd.getMonth() + 2);
    maxEnd.setDate(0);
    const dayCount = Math.max(14, Math.ceil((maxEnd.getTime() - minStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const width = labelWidth + dayCount * dayWidth + 36;
    const height = headerHeight + allFlatTasks.length * rowHeight + 76;
    const dates = Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(minStart);
      date.setDate(minStart.getDate() + index);
      return date;
    });
    const monthLabels = dates
      .map((date, index) => ({ date, index }))
      .filter(({ date, index }) => index === 0 || date.getDate() === 1)
      .map(({ date, index }) => {
        return `<text x="${labelWidth + index * dayWidth + 8}" y="62" font-size="12" font-weight="700" fill="#17201d">${escapeMarkup(date.toLocaleDateString("en-US", { month: "short", year: "numeric" }))}</text><line x1="${labelWidth + index * dayWidth}" y1="46" x2="${labelWidth + index * dayWidth}" y2="${height - 54}" stroke="#c9d6cf" stroke-width="1"/>`;
      })
      .join("");
    const dayCells = dates
      .map((date, index) => {
        const x = labelWidth + index * dayWidth;
        const isWeekendDay = date.getDay() === 0 || date.getDay() === 6;
        return `<rect x="${x}" y="72" width="${dayWidth}" height="${height - 126}" fill="${isWeekendDay ? "#e8f0eb" : "#f8fbf8"}"/><text x="${x + dayWidth / 2}" y="88" text-anchor="middle" font-size="10" fill="#51605a">${date.getDate()}</text>`;
      })
      .join("");
    const bars = allFlatTasks
      .map((task, index) => {
        const startOffset = Math.floor((new Date(task.start_date).getTime() - minStart.getTime()) / (1000 * 60 * 60 * 24));
        const duration = Math.max(1, Math.ceil((new Date(task.end_date).getTime() - new Date(task.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const y = headerHeight + index * rowHeight;
        const x = labelWidth + startOffset * dayWidth;
        const barWidth = Math.max(dayWidth, duration * dayWidth);
        const color = task.status === "DONE" ? "#31956a" : task.status === "IN_PROGRESS" ? "#0f8b7d" : task.status === "OVERDUE" ? "#d65f4a" : "#8fa199";
        const progressWidth = Math.max(6, (barWidth * task.progress) / 100);
        const label = `${task.is_locked ? "LOCKED · " : ""}${task.name}`;
        return `<line x1="18" y1="${y + rowHeight}" x2="${width - 18}" y2="${y + rowHeight}" stroke="#dce5df"/><text x="${28 + task.depth * 16}" y="${y + 24}" font-size="12" font-weight="${task.depth === 0 ? 700 : 500}" fill="#17201d">${escapeMarkup(label)}</text><text x="246" y="${y + 24}" font-size="10" fill="#51605a">${escapeMarkup(task.status)} · ${task.progress}%</text><rect x="${x}" y="${y + 8}" width="${barWidth}" height="22" rx="5" fill="${color}" opacity="0.25"/><rect x="${x}" y="${y + 8}" width="${progressWidth}" height="22" rx="5" fill="${color}"/><text x="${x + 8}" y="${y + 23}" font-size="10" font-weight="700" fill="#ffffff">${escapeMarkup(task.name)}</text>`;
      })
      .join("");
    const legendY = height - 30;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeMarkup(data.project.name)} Gantt chart"><rect width="100%" height="100%" fill="#f4f7f5"/><text x="24" y="34" font-size="22" font-weight="800" fill="#17201d">${escapeMarkup(data.project.name)}</text><text x="${labelWidth}" y="34" font-size="12" fill="#51605a">${minStart.toISOString().slice(0, 10)} to ${maxEnd.toISOString().slice(0, 10)} · ${allFlatTasks.length} tasks · ${data.dependencies.length} links</text><rect x="18" y="50" width="${width - 36}" height="${height - 104}" rx="8" fill="#fffefd" stroke="#c9d6cf"/><text x="28" y="88" font-size="11" font-weight="800" fill="#51605a">TASK / STATUS</text>${monthLabels}${dayCells}${bars}<rect x="24" y="${legendY - 12}" width="12" height="12" rx="3" fill="#0f8b7d"/><text x="42" y="${legendY - 2}" font-size="11" fill="#51605a">In progress</text><rect x="128" y="${legendY - 12}" width="12" height="12" rx="3" fill="#31956a"/><text x="146" y="${legendY - 2}" font-size="11" fill="#51605a">Done</text><rect x="210" y="${legendY - 12}" width="12" height="12" rx="3" fill="#d65f4a"/><text x="228" y="${legendY - 2}" font-size="11" fill="#51605a">Overdue</text><text x="${width - 24}" y="${legendY - 2}" text-anchor="end" font-size="11" fill="#51605a">Exported from tempops · ${new Date().toISOString().slice(0, 10)}</text></svg>`;
  };

  const exportSvg = () => {
    if (!data) return;
    if (!allFlatTasks.length) {
      setTransferStatus(locale === "vi" ? "Chưa có công việc để xuất SVG." : "No tasks to export as SVG.");
      window.setTimeout(() => setTransferStatus(null), 3000);
      return;
    }
    const svg = createGanttSvg();
    if (!svg) return;
    downloadTextFile(
      `${projectSlug}-gantt.svg`,
      svg,
      "image/svg+xml"
    );
  };

  const exportGanttHtml = () => {
    if (!data) return;
    const svg = createGanttSvg();
    if (!svg) {
      setTransferStatus(locale === "vi" ? "Chưa có công việc để xuất file Gantt." : "No tasks to export.");
      window.setTimeout(() => setTransferStatus(null), 3000);
      return;
    }
    const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeMarkup(data.project.name)} · tempops Gantt</title><style>body{margin:0;background:#f4f7f5;color:#17201d;font-family:Inter,Arial,sans-serif}.shell{padding:28px}.toolbar{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:18px}.toolbar h1{margin:0;font-size:24px}.toolbar p{margin:4px 0 0;color:#51605a}.print{border:1px solid #c9d6cf;background:#fffefd;border-radius:6px;padding:8px 12px;cursor:pointer}.canvas{overflow:auto;border:1px solid #c9d6cf;border-radius:10px;background:#fffefd;box-shadow:0 24px 60px -42px rgba(23,32,29,.45)}svg{display:block}@media print{.shell{padding:0}.toolbar{display:none}.canvas{border:0;box-shadow:none;overflow:visible}}</style></head><body><main class="shell"><header class="toolbar"><div><h1>${escapeMarkup(data.project.name)}</h1><p>${allFlatTasks.length} tasks · ${data.dependencies.length} dependencies · exported ${new Date().toLocaleString()}</p></div><button class="print" onclick="window.print()">Print / Save PDF</button></header><section class="canvas">${svg}</section></main></body></html>`;
    downloadTextFile(`${projectSlug}-gantt.html`, html, "text/html;charset=utf-8");
  };

  const parseCsvLine = (line: string) => {
    const values: string[] = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  };

  const importTasks = async (tasks: ImportedTask[], dependencies: Dependency[] = []) => {
    const idMap = new Map<string, string>();
    const createdTasks = [];
    for (const [index, task] of tasks.entries()) {
      const statusValue = String(task.status || "TODO");
      const priorityValue = String(task.priority || "M");
      const lockedValue = task.is_locked;
      const isLocked =
        typeof lockedValue === "boolean"
          ? lockedValue
          : String(lockedValue ?? "true").toLowerCase() !== "false";
      const payload: TaskCreate = {
        project_id: projectId,
        name: task.name || `Imported task ${index + 1}`,
        description: task.description || null,
        start_date: task.start_date || new Date().toISOString().slice(0, 10),
        end_date: task.end_date || task.start_date || new Date().toISOString().slice(0, 10),
        progress: Number(task.progress || 0),
        status: ["TODO", "IN_PROGRESS", "DONE", "OVERDUE"].includes(statusValue)
          ? (statusValue as TaskStatus)
          : "TODO",
        priority: ["H", "M", "L"].includes(priorityValue) ? (priorityValue as TaskPriority) : "M",
        assignee_id: task.assignee_id || null,
        parent_id: task.parent_id && idMap.has(task.parent_id) ? idMap.get(task.parent_id) || null : null,
        sort_order: allFlatTasks.length + index,
        is_locked: isLocked,
      };
      const created = await api.tasks.create(payload);
      if (task.id) idMap.set(task.id, created.id);
      createdTasks.push(created);
    }

    for (const dep of dependencies) {
      const predecessorId = idMap.get(dep.predecessor_id);
      const successorId = idMap.get(dep.successor_id);
      if (predecessorId && successorId) {
        await api.dependencies.create({
          project_id: projectId,
          predecessor_id: predecessorId,
          successor_id: successorId,
          dependency_type: dep.dependency_type,
        });
      }
    }
    return createdTasks.length;
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTransferStatus(locale === "vi" ? "Đang nhập dữ liệu..." : "Importing...");
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) {
        const payload = JSON.parse(text);
        const count = await importTasks(payload.tasks || [], payload.dependencies || []);
        setTransferStatus(locale === "vi" ? `Đã nhập ${count} công việc.` : `Imported ${count} tasks.`);
      } else {
        const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
        const headers = parseCsvLine(headerLine);
        const tasks = lines.map((line) => {
          const values = parseCsvLine(line);
          return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
        });
        const count = await importTasks(tasks);
        setTransferStatus(locale === "vi" ? `Đã nhập ${count} công việc từ CSV.` : `Imported ${count} CSV tasks.`);
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.gantt(projectId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    } catch {
      setTransferStatus(locale === "vi" ? "Không thể nhập file. Vui lòng kiểm tra định dạng." : "Import failed. Please check the file format.");
    } finally {
      event.target.value = "";
      window.setTimeout(() => setTransferStatus(null), 4500);
    }
  };

  if (isLoading) {
    return (
      <>
        <TopNav projectName="Loading..." projectId={projectId} />
        <div className="main-content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div className="skeleton" style={{ width: 200, height: 24, margin: "0 auto 12px" }} />
            <div className="skeleton" style={{ width: 140, height: 16, margin: "0 auto" }} />
          </div>
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <TopNav />
        <div className="main-content">
          <div className="empty-state">
            <span className="empty-state__icon material-symbols-outlined">error</span>
            <h3 className="empty-state__title">Project not found</h3>
            <p className="empty-state__description">
              The project you&apos;re looking for doesn&apos;t exist or has been deleted.
            </p>
            <Link href="/projects" className="btn btn--primary" style={{ marginTop: 16 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>folder_open</span>
              Back to Projects
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopNav projectName={data.project.name} projectId={projectId} />
      <div className={`main-content gantt-page ${focusMode ? "gantt-page--focus" : ""}`} style={{ padding: 0, overflow: "hidden" }}>
        {analysis && !focusMode && (
          <div className={`ml-strip ml-strip--${analysis.health}`}>
            <span className="material-symbols-outlined">model_training</span>
            <strong>
              {locale === "vi" ? "Trạng thái phân tích" : "ML Health"}: {analysis.health}
            </strong>
            <span>
              {analysis.at_risk.length} {locale === "vi" ? "tín hiệu rủi ro" : "risk signals"}
            </span>
            <span>{Object.keys(analysis.tag_counts).slice(0, 4).join(" · ")}</span>
          </div>
        )}
        <div className="gantt-command-bar">
          <div className="segmented-control">
            {[
              { id: "timeline", icon: "view_timeline", label: locale === "vi" ? "Timeline" : "Timeline" },
              { id: "analytics", icon: "monitoring", label: locale === "vi" ? "Biểu đồ" : "Charts" },
              { id: "dependencies", icon: "account_tree", label: locale === "vi" ? "Phụ thuộc" : "Flow" },
            ].map((item) => (
              <button
                key={item.id}
                className={`segmented-control__button ${
                  workspaceView === item.id ? "segmented-control__button--active" : ""
                }`}
                onClick={() => setWorkspaceView(item.id as "timeline" | "analytics" | "dependencies")}
                type="button"
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          <div className="gantt-command-bar__tools">
            {workspaceView === "timeline" && (
              <>
                <div className="zoom-control" aria-label={locale === "vi" ? "Thu phóng Gantt" : "Gantt zoom controls"}>
                  <button
                    className="btn btn--outline btn--square"
                    onClick={zoomOut}
                    type="button"
                    disabled={zoomIndex === 0}
                    title={locale === "vi" ? "Thu nhỏ timeline" : "Zoom out"}
                    aria-label={locale === "vi" ? "Thu nhỏ timeline" : "Zoom out"}
                  >
                    <span className="material-symbols-outlined">zoom_out</span>
                  </button>
                  <button
                    className="btn btn--outline btn--square"
                    onClick={resetZoom}
                    type="button"
                    disabled={zoomMode === "day"}
                    title={locale === "vi" ? "Đưa zoom về mặc định" : "Reset zoom"}
                    aria-label={locale === "vi" ? "Đưa zoom về mặc định" : "Reset zoom"}
                  >
                    <span className="material-symbols-outlined">center_focus_strong</span>
                  </button>
                  <button
                    className="btn btn--outline btn--square"
                    onClick={zoomIn}
                    type="button"
                    disabled={zoomIndex === zoomSteps.length - 1}
                    title={locale === "vi" ? "Phóng to timeline" : "Zoom in"}
                    aria-label={locale === "vi" ? "Phóng to timeline" : "Zoom in"}
                  >
                    <span className="material-symbols-outlined">zoom_in</span>
                  </button>
                  <span className="zoom-control__value">{zoomPercent}%</span>
                </div>
                <div className="segmented-control segmented-control--compact">
                  {(["day", "week", "month"] as const).map((mode) => (
                    <button
                      key={mode}
                      className={`segmented-control__button ${
                        zoomMode === mode ? "segmented-control__button--active" : ""
                      }`}
                      onClick={() => setZoomMode(mode)}
                      type="button"
                    >
                      {locale === "vi"
                        ? mode === "day"
                          ? "Ngày"
                          : mode === "week"
                          ? "Tuần"
                          : "Tháng"
                        : mode}
                    </button>
                  ))}
                </div>
                <button className="btn btn--outline btn--icon-text" onClick={toggleDependencies} type="button">
                  <span className="material-symbols-outlined">conversion_path</span>
                  {showDependencies ? (locale === "vi" ? "Ẩn liên kết" : "Hide links") : locale === "vi" ? "Hiện liên kết" : "Show links"}
                </button>
                <button className="btn btn--outline btn--icon-text" onClick={() => setShowTaskTable((value) => !value)} type="button">
                  <span className="material-symbols-outlined">{showTaskTable ? "view_sidebar" : "table_chart"}</span>
                  {showTaskTable ? (locale === "vi" ? "Ẩn bảng" : "Hide table") : locale === "vi" ? "Hiện bảng" : "Show table"}
                </button>
                <button className="btn btn--outline btn--icon-text" onClick={() => setFocusMode((value) => !value)} type="button">
                  <span className="material-symbols-outlined">{focusMode ? "close_fullscreen" : "open_in_full"}</span>
                  {focusMode ? (locale === "vi" ? "Thoát tập trung" : "Exit focus") : locale === "vi" ? "Tập trung" : "Focus"}
                </button>
              </>
            )}
            <button className="btn btn--outline btn--icon-text" onClick={() => expandAll(expandableTaskIds)} type="button">
              <span className="material-symbols-outlined">unfold_more</span>
              {locale === "vi" ? "Mở cấu trúc" : "Expand"}
            </button>
            <button className="btn btn--outline btn--icon-text" onClick={() => expandAll([])} type="button">
              <span className="material-symbols-outlined">unfold_less</span>
              {locale === "vi" ? "Thu gọn" : "Collapse"}
            </button>
            <div className="gantt-transfer-group">
              <button className="btn btn--primary btn--icon-text" onClick={exportGanttHtml} type="button">
                <span className="material-symbols-outlined">file_save</span>
                {locale === "vi" ? "Gantt file" : "Gantt file"}
              </button>
              <button className="btn btn--outline btn--icon-text" onClick={exportSvg} type="button">
                <span className="material-symbols-outlined">image</span>
                SVG
              </button>
              <button className="btn btn--outline btn--icon-text" onClick={exportJson} type="button">
                <span className="material-symbols-outlined">data_object</span>
                JSON
              </button>
              <button className="btn btn--outline btn--icon-text" onClick={exportCsv} type="button">
                <span className="material-symbols-outlined">table_view</span>
                CSV
              </button>
              <button className="btn btn--outline btn--icon-text" onClick={() => importInputRef.current?.click()} type="button">
                <span className="material-symbols-outlined">upload_file</span>
                {locale === "vi" ? "Nhập" : "Import"}
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".json,.csv,application/json,text/csv"
                onChange={handleImportFile}
                hidden
              />
            </div>
          </div>
        </div>
        {transferStatus && <div className="gantt-transfer-status">{transferStatus}</div>}

        {workspaceView === "timeline" ? (
          <div className={`gantt-workspace ${!showTaskTable ? "gantt-workspace--chart-only" : ""} ${focusMode ? "gantt-workspace--focus" : ""}`}>
            <div className={`split-view ${!showTaskTable ? "split-view--chart-only" : ""}`} onWheel={handleTimelineWheel}>
              {showTaskTable && (
                <DataGrid
                  tasks={visibleTasks}
                  registerScrollElement={(element) => {
                    dataGridScrollRef.current = element;
                  }}
                  onScroll={(top) => syncVerticalScroll("grid", top)}
                />
              )}
              {showTaskTable && <div className="split-view__divider" />}
              <GanttCanvas
                projectId={projectId}
                tasks={visibleTasks}
                dependencies={data.dependencies}
                registerScrollElement={(element) => {
                  ganttScrollRef.current = element;
                }}
                onScrollTopChange={(top) => syncVerticalScroll("chart", top)}
              />
            </div>
          </div>
        ) : (
          <div className="gantt-workspace gantt-workspace--panel">
            <GanttAnalyticsPanel
              tasks={flatTasks}
              dependencies={data.dependencies}
              analysis={analysis}
              locale={locale}
              mode={workspaceView === "dependencies" ? "dependencies" : "analytics"}
              onOpenTask={openSidePanel}
            />
          </div>
        )}
        <TaskSidePanel projectId={projectId} tasks={flatTasks} dependencies={data.dependencies} />
        <NewTaskModal projectId={projectId} tasks={flatTasks} />
      </div>
    </>
  );
}
