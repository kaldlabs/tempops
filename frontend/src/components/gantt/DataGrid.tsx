"use client";

import { useEffect, useRef } from "react";
import { useGanttStore } from "@/store/use-gantt-store";
import { useT } from "@/lib/i18n";
import { statusLabel, statusClass, avatarColor, avatarInitials } from "@/lib/utils";
import type { FlatTask } from "@/types";

interface DataGridProps {
  tasks: FlatTask[];
  onScroll: (scrollTop: number) => void;
  registerScrollElement?: (element: HTMLDivElement | null) => void;
}

export default function DataGrid({ tasks, onScroll, registerScrollElement }: DataGridProps) {
  const { locale } = useT();
  const { selectedTaskId, toggleExpanded, openSidePanel, setHoveredTaskId } =
    useGanttStore();
  const gridRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    registerScrollElement?.(gridRef.current);
    return () => registerScrollElement?.(null);
  }, [registerScrollElement]);

  const handleScroll = (nextScrollTop: number) => {
    if (Math.abs(nextScrollTop - lastScrollTopRef.current) < 1) return;
    lastScrollTopRef.current = nextScrollTop;
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      onScroll(nextScrollTop);
      frameRef.current = null;
    });
  };

  const handleRowClick = (task: FlatTask) => {
    openSidePanel(task.id);
  };

  const handleRowDoubleClick = (task: FlatTask) => {
    openSidePanel(task.id);
  };

  return (
    <div className="split-view__left">
      {/* Header */}
      <div className="data-grid__header">
        <span className="data-grid__header-cell">{locale === "vi" ? "Công việc" : "Task Name"}</span>
        <span className="data-grid__header-cell">{locale === "vi" ? "Phụ trách" : "Asgn"}</span>
        <span className="data-grid__header-cell">{locale === "vi" ? "Trạng thái" : "Status"}</span>
        <span className="data-grid__header-cell">{locale === "vi" ? "Ưu tiên" : "Pri"}</span>
      </div>

      {/* Rows */}
      <div
        ref={gridRef}
        className="data-grid"
        onScroll={(e) => handleScroll(e.currentTarget.scrollTop)}
      >
        {tasks.length === 0 && (
          <div className="empty-state empty-state--compact">
            <span className="empty-state__icon material-symbols-outlined">search_off</span>
            <h3 className="empty-state__title">{locale === "vi" ? "Không tìm thấy công việc" : "No tasks found"}</h3>
          </div>
        )}
        {tasks.map((task, idx) => (
          <div
            key={task.id}
            className={`data-grid__row ${
              selectedTaskId === task.id ? "data-grid__row--selected" : ""
            }`}
            onClick={() => handleRowClick(task)}
            onDoubleClick={() => handleRowDoubleClick(task)}
            onMouseEnter={() => setHoveredTaskId(task.id)}
            onMouseLeave={() => setHoveredTaskId(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openSidePanel(task.id);
              }
            }}
            style={{ animationDelay: `${idx * 30}ms` }}
            role="button"
            tabIndex={0}
          >
            {/* Task Name with tree indent */}
            <div className="data-grid__task-name">
              <span
                className="data-grid__task-indent"
                style={{ width: task.depth * 20 }}
              />
              {task.hasChildren ? (
                <button
                  className={`data-grid__toggle ${
                    !task.isExpanded ? "data-grid__toggle--collapsed" : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(task.id);
                  }}
                  aria-label={task.isExpanded ? "Collapse" : "Expand"}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    expand_more
                  </span>
                </button>
              ) : (
                <span style={{ width: 22 }} />
              )}
              <span className="data-grid__task-label">{task.name}</span>
            </div>

            {/* Assignee */}
            <div>
              {task.assignee_id && (
                <div
                  className={`avatar ${avatarColor(task.assignee_id)}`}
                  title={task.assignee_id}
                >
                  {avatarInitials(task.assignee_id)}
                </div>
              )}
            </div>

            {/* Status Badge */}
            <div>
              <span className={`badge ${statusClass(task.status)}`}>
                {statusLabel(task.status)}
              </span>
            </div>

            {/* Priority */}
            <div style={{ textAlign: "center", fontWeight: 600, fontSize: 12 }}>
              <span className={`badge--priority-${task.priority.toLowerCase()}`}>
                {task.priority}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
