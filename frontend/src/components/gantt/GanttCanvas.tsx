"use client";

import { useMemo, useRef, useCallback, useEffect, useState } from "react";
import { useGanttStore } from "@/store/use-gantt-store";
import { useUpdateTask } from "@/hooks/use-gantt-mutations";
import { addDays, generateDateRange, isWeekend, isToday, getMonthLabel, taskBarClass } from "@/lib/utils";
import type { FlatTask, Dependency } from "@/types";

const ROW_HEIGHT = 40;
const DAY_MS = 1000 * 60 * 60 * 24;

interface GanttCanvasProps {
  projectId: string;
  tasks: FlatTask[];
  dependencies: Dependency[];
  onScrollTopChange?: (top: number) => void;
  registerScrollElement?: (element: HTMLDivElement | null) => void;
}

type DragMode = "move" | "resize-start" | "resize-end";

interface DragState {
  task: FlatTask;
  mode: DragMode;
  originX: number;
  deltaDays: number;
}

interface PreviewDates {
  start_date: string;
  end_date: string;
}

interface PanState {
  pointerId: number;
  originX: number;
  originY: number;
  scrollLeft: number;
  scrollTop: number;
  moved: boolean;
}

export default function GanttCanvas({ projectId, tasks, dependencies, onScrollTopChange, registerScrollElement }: GanttCanvasProps) {
  const {
    hoveredTaskId,
    setHoveredTaskId,
    selectedTaskId,
    setSelectedTaskId,
    openSidePanel,
    closeSidePanel,
    zoomMode,
    showDependencies,
  } = useGanttStore();
  const updateTask = useUpdateTask(projectId);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragMovedRef = useRef(false);
  const panStateRef = useRef<PanState | null>(null);
  const lastScrollTopRef = useRef(0);
  const scrollFrameRef = useRef<number | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [previewDates, setPreviewDates] = useState<Record<string, PreviewDates>>({});
  const [isPanning, setIsPanning] = useState(false);

  const dayWidthByMode = {
    quarter: 8,
    month: 12,
    week: 24,
    day: 40,
    detail: 64,
    max: 88,
  } as const;
  const dayWidth = dayWidthByMode[zoomMode];

  // Calculate date range from tasks
  const dateRange = useMemo(() => {
    if (!tasks.length) {
      const start = new Date();
      start.setDate(1);
      start.setMonth(start.getMonth() - 1);
      return { start, dates: generateDateRange(start, 180) };
    }
    const starts = tasks.map((t) => new Date(t.start_date).getTime());
    const ends = tasks.map((t) => new Date(t.end_date).getTime());
    const minDate = new Date(Math.min(...starts));
    const maxDate = new Date(Math.max(...ends));
    minDate.setDate(1);
    minDate.setMonth(minDate.getMonth() - 1);
    maxDate.setMonth(maxDate.getMonth() + 2);
    maxDate.setDate(0);
    const days = Math.ceil((maxDate.getTime() - minDate.getTime()) / DAY_MS) + 1;
    return { start: minDate, dates: generateDateRange(minDate, Math.max(days, 180)) };
  }, [tasks]);

  useEffect(() => {
    registerScrollElement?.(bodyRef.current);
    return () => registerScrollElement?.(null);
  }, [registerScrollElement]);

  // Calculate task bar position
  const getBarPosition = useCallback(
    (task: FlatTask) => {
      const preview = previewDates[task.id];
      const startDate = new Date(preview?.start_date || task.start_date);
      const endDate = new Date(preview?.end_date || task.end_date);
      const dayOffset = Math.floor(
        (startDate.getTime() - dateRange.start.getTime()) / DAY_MS
      );
      const duration = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / DAY_MS
      ) + 1;
      return { left: dayOffset * dayWidth, width: duration * dayWidth };
    },
    [dateRange.start, dayWidth, previewDates]
  );

  // Group dates by month for header
  const monthGroups = useMemo(() => {
    const groups: { label: string; span: number }[] = [];
    let currentMonth = "";
    for (const d of dateRange.dates) {
      const label = getMonthLabel(d);
      if (label !== currentMonth) {
        groups.push({ label, span: 1 });
        currentMonth = label;
      } else {
        groups[groups.length - 1].span++;
      }
    }
    return groups;
  }, [dateRange.dates]);

  // Today line position
  const todayOffset = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOffset = Math.floor(
      (today.getTime() - dateRange.start.getTime()) / DAY_MS
    );
    return dayOffset * dayWidth + dayWidth / 2;
  }, [dateRange.start, dayWidth]);

  const totalWidth = dateRange.dates.length * dayWidth;
  const visibleRowCount = Math.max(tasks.length, 22);

  const getPreviewDates = useCallback((task: FlatTask, mode: DragMode, deltaDays: number): PreviewDates => {
    if (mode === "move") {
      return {
        start_date: addDays(task.start_date, deltaDays),
        end_date: addDays(task.end_date, deltaDays),
      };
    }

    if (mode === "resize-start") {
      const nextStart = addDays(task.start_date, deltaDays);
      return {
        start_date: new Date(nextStart) > new Date(task.end_date) ? task.end_date : nextStart,
        end_date: task.end_date,
      };
    }

    const nextEnd = addDays(task.end_date, deltaDays);
    return {
      start_date: task.start_date,
      end_date: new Date(nextEnd) < new Date(task.start_date) ? task.start_date : nextEnd,
    };
  }, []);

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>, task: FlatTask, mode: DragMode) => {
    if (event.button !== 0) return;
    if (task.is_locked) {
      openSidePanel(task.id);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragMovedRef.current = false;
    setSelectedTaskId(task.id);
    setDragState({ task, mode, originX: event.clientX, deltaDays: 0 });
    setPreviewDates((prev) => ({
      ...prev,
      [task.id]: { start_date: task.start_date, end_date: task.end_date },
    }));
  };

  const updateDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    const deltaDays = Math.round((event.clientX - dragState.originX) / dayWidth);
    if (deltaDays === dragState.deltaDays) return;
    dragMovedRef.current = true;
    const nextDates = getPreviewDates(dragState.task, dragState.mode, deltaDays);
    setDragState({ ...dragState, deltaDays });
    setPreviewDates((prev) => ({ ...prev, [dragState.task.id]: nextDates }));
  };

  const endDrag = async () => {
    if (!dragState) return;
    const preview = getPreviewDates(dragState.task, dragState.mode, dragState.deltaDays);
    setDragState(null);
    setPreviewDates((prev) => {
      const next = { ...prev };
      delete next[dragState.task.id];
      return next;
    });

    if (
      preview &&
      (preview.start_date !== dragState.task.start_date ||
        preview.end_date !== dragState.task.end_date)
    ) {
      try {
        await updateTask.mutateAsync({
          id: dragState.task.id,
          data: {
            start_date: preview.start_date,
            end_date: preview.end_date,
          },
        });
      } catch {
        // Optimistic mutation handles rollback; the next refetch restores the row.
      }
    }

    window.setTimeout(() => {
      dragMovedRef.current = false;
    }, 0);
  };

  const formatDayLabel = (date: Date) => {
    if (zoomMode === "quarter") return date.getDate() === 1 ? date.toLocaleDateString("en-US", { month: "short" }) : "";
    if (zoomMode === "month") return date.getDate() === 1 || date.getDate() === 15 ? `${date.getDate()}` : "";
    if (zoomMode === "week") return date.getDay() === 1 ? `${date.getDate()}` : "";
    return date.getDate();
  };

  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as HTMLElement;
    if (target.closest(".task-bar")) return;

    setSelectedTaskId(null);
    closeSidePanel();

    const container = bodyRef.current;
    if (!container) return;
    container.setPointerCapture(event.pointerId);
    panStateRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      moved: false,
    };
    setIsPanning(true);
  };

  const updatePan = (event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panStateRef.current;
    const container = bodyRef.current;
    if (!pan || !container) return;

    const deltaX = event.clientX - pan.originX;
    const deltaY = event.clientY - pan.originY;
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      pan.moved = true;
    }
    container.scrollLeft = pan.scrollLeft - deltaX;
    container.scrollTop = pan.scrollTop - deltaY;
  };

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = bodyRef.current;
    if (container && panStateRef.current?.pointerId === event.pointerId && container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    panStateRef.current = null;
    setIsPanning(false);
  };

  const syncScroll = () => {
    const container = bodyRef.current;
    if (!container || !onScrollTopChange) return;
    if (Math.abs(container.scrollTop - lastScrollTopRef.current) < 1) return;
    const nextScrollTop = container.scrollTop;
    lastScrollTopRef.current = nextScrollTop;
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      onScrollTopChange(nextScrollTop);
      scrollFrameRef.current = null;
    });
  };

  return (
    <div
      ref={bodyRef}
      className={`split-view__right gantt-pan-surface ${isPanning ? "split-view__right--panning" : ""}`}
      style={{ overflow: "auto" }}
      onPointerDown={beginPan}
      onPointerMove={updatePan}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onScroll={syncScroll}
    >
      {/* ── Header: Month + Day ──────────────────────────────── */}
      <div className="gantt-canvas__header" style={{ width: totalWidth, minWidth: "100%" }}>
        {/* Month row */}
        <div className="gantt-canvas__month-row">
          {monthGroups.map((g, i) => (
            <div
              key={i}
              className="gantt-canvas__month-cell"
              style={{ width: g.span * dayWidth }}
            >
              {g.label}
            </div>
          ))}
        </div>
        {/* Day row */}
        <div className="gantt-canvas__day-row">
          {dateRange.dates.map((d, i) => (
            <div
              key={i}
              className={`gantt-canvas__day-cell ${
                isToday(d) ? "gantt-canvas__day-cell--today" : ""
              } ${isWeekend(d) ? "gantt-canvas__day-cell--weekend" : ""}`}
              style={{ width: dayWidth, minWidth: dayWidth }}
            >
              {formatDayLabel(d)}
            </div>
          ))}
        </div>
      </div>

      {/* ── Body: Task Bars ──────────────────────────────────── */}
      <div
        className="gantt-body"
        style={{ width: totalWidth, minWidth: "100%", position: "relative" }}
      >
        {/* Background grid */}
        {Array.from({ length: visibleRowCount }).map((_, rowIdx) => (
          <div key={rowIdx} className="gantt-body__row">
            {dateRange.dates.map((d, colIdx) => (
              <div
                key={colIdx}
                className={`gantt-body__cell ${
                  isWeekend(d) ? "gantt-body__cell--weekend" : ""
                }`}
              />
            ))}
          </div>
        ))}

        {/* Today line */}
        {todayOffset > 0 && todayOffset < totalWidth && (
          <div className="today-line" style={{ left: todayOffset }} />
        )}

        {/* Task bars */}
        {tasks.map((task, idx) => {
          const pos = getBarPosition(task);
          const isHovered = hoveredTaskId === task.id;
          const isSelected = selectedTaskId === task.id;

          return (
            <div
              key={task.id}
              className={`task-bar ${taskBarClass(task.status)} ${task.is_locked ? "task-bar--locked" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${task.name}, ${task.progress}%`}
              style={{
                left: pos.left,
                width: Math.max(pos.width, dayWidth),
                top: idx * ROW_HEIGHT + 5,
                height: 30,
                outline: isSelected ? "2px solid var(--secondary)" : undefined,
                outlineOffset: 1,
                zIndex: isHovered || isSelected ? 5 : 2,
                }}
              onMouseEnter={() => setHoveredTaskId(task.id)}
              onMouseLeave={() => setHoveredTaskId(null)}
              onClick={() => {
                if (!dragMovedRef.current) openSidePanel(task.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openSidePanel(task.id);
                }
              }}
              onDoubleClick={() => openSidePanel(task.id)}
              onPointerDown={(event) => beginDrag(event, task, "move")}
              onPointerMove={updateDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              title={`${task.name} (${task.progress}%)`}
            >
              {/* Progress fill */}
              <div
                className="task-bar__progress"
                style={{ width: `${task.progress}%` }}
              />
              {/* Label */}
              {pos.width > 60 && (
                <span className="task-bar__label">
                  {task.is_locked && <span className="material-symbols-outlined">lock</span>}
                  <span>{task.name}</span>
                </span>
              )}
              {/* Anchor points (shown on hover) */}
              <div className="task-bar__anchor task-bar__anchor--start" />
              <div className="task-bar__anchor task-bar__anchor--end" />
              {/* Resize handles */}
              {!task.is_locked && (
                <>
                  <div
                    className="task-bar__resize task-bar__resize--left"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      beginDrag(event, task, "resize-start");
                    }}
                    onPointerMove={updateDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  />
                  <div
                    className="task-bar__resize task-bar__resize--right"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      beginDrag(event, task, "resize-end");
                    }}
                    onPointerMove={updateDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  />
                </>
              )}
            </div>
          );
        })}

        {/* Dependency lines */}
        {showDependencies && (
          <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: totalWidth,
            height: visibleRowCount * ROW_HEIGHT,
            pointerEvents: "none",
            overflow: "visible",
          }}
          >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="var(--dependency-line)" />
            </marker>
          </defs>
          {dependencies.map((dep) => {
            const predIdx = tasks.findIndex((t) => t.id === dep.predecessor_id);
            const succIdx = tasks.findIndex((t) => t.id === dep.successor_id);
            if (predIdx === -1 || succIdx === -1) return null;

            const predTask = tasks[predIdx];
            const succTask = tasks[succIdx];
            const predPos = getBarPosition(predTask);
            const succPos = getBarPosition(succTask);

            // Orthogonal routing: end of pred → start of succ
            const x1 = predPos.left + predPos.width;
            const y1 = predIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
            const x2 = succPos.left;
            const y2 = succIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
            const midX = x1 + (x2 - x1) / 2;

            return (
              <path
                key={dep.id}
                className="dependency-line"
                d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`}
              />
            );
          })}
          </svg>
        )}
      </div>
    </div>
  );
}
