"use client";

import { useEffect, useState } from "react";
import { useActivity, useDeleteTask, useUpdateTask } from "@/hooks/use-gantt-mutations";
import { getErrorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n";
import { useGanttStore } from "@/store/use-gantt-store";
import { statusLabel, statusClass, formatDate, daysBetween, avatarColor, avatarInitials } from "@/lib/utils";
import type { FlatTask, Dependency, TaskPriority, TaskStatus } from "@/types";

interface TaskSidePanelProps {
  projectId: string;
  tasks: FlatTask[];
  dependencies: Dependency[];
}

export default function TaskSidePanel({ projectId, tasks, dependencies }: TaskSidePanelProps) {
  const { locale } = useT();
  const { isSidePanelOpen, closeSidePanel, selectedTaskId } = useGanttStore();
  const updateTask = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);
  const { data: activityLog } = useActivity(projectId);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [priority, setPriority] = useState<TaskPriority>("M");
  const [assignee, setAssignee] = useState("");
  const [progress, setProgress] = useState(0);
  const [isLocked, setIsLocked] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const task = tasks.find((t) => t.id === selectedTaskId);

  useEffect(() => {
    if (!task) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(task.name);
    setDescription(task.description || "");
    setStartDate(task.start_date);
    setEndDate(task.end_date);
    setStatus(task.status);
    setPriority(task.priority);
    setAssignee(task.assignee_id || "");
    setProgress(task.progress);
    setIsLocked(task.is_locked);
    setActionError(null);
    setIsEditing(false);
  }, [task]);

  if (!task) return null;

  const taskDeps = dependencies.filter((d) => d.successor_id === task.id);
  const blockingTasks = taskDeps
    .map((d) => tasks.find((t) => t.id === d.predecessor_id))
    .filter(Boolean);

  const duration = daysBetween(task.start_date, task.end_date) + 1;
  const taskActivity = (activityLog || []).filter((item) => item.task_id === task.id).slice(0, 5);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionError(null);
    try {
      await updateTask.mutateAsync({
        id: task.id,
        data: {
          name,
          description: description || null,
          start_date: startDate,
          end_date: endDate,
          status,
          priority,
          assignee_id: assignee || null,
          progress,
          is_locked: isLocked,
        },
      });
      setIsEditing(false);
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, "Could not update task."));
    }
  };

  const toggleLock = async () => {
    setActionError(null);
    try {
      await updateTask.mutateAsync({
        id: task.id,
        data: { is_locked: !task.is_locked },
      });
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, "Could not update task lock."));
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${task.name}" and its child tasks?`)) return;
    setActionError(null);
    try {
      await deleteTask.mutateAsync(task.id);
      closeSidePanel();
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, "Could not delete task."));
    }
  };

  return (
    <div className={`side-panel ${isSidePanelOpen ? "side-panel--open" : ""}`}>
      {/* Header */}
      <div className="side-panel__header">
        <div>
          <div className="side-panel__task-id">
            TSK · {task.id.slice(0, 8).toUpperCase()}
          </div>
          <h2 className="side-panel__task-name">{task.name}</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn--outline btn--icon-text" onClick={toggleLock} disabled={updateTask.isPending} aria-label={task.is_locked ? "Unlock task" : "Lock task"}>
            <span className="material-symbols-outlined">{task.is_locked ? "lock_open" : "lock"}</span>
            {task.is_locked ? "Unlock" : "Lock"}
          </button>
          <button className="btn btn--ghost" onClick={() => setIsEditing((v) => !v)} aria-label="Edit task">
            <span className="material-symbols-outlined">{isEditing ? "visibility" : "edit"}</span>
          </button>
          <button className="btn btn--ghost" onClick={closeSidePanel} aria-label="Close panel">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      {actionError && <div className="form-alert form-alert--error">{actionError}</div>}

      {isEditing ? (
        <form className="form-stack" onSubmit={handleSave}>
          <div>
            <label className="input-label" htmlFor="edit-task-name">Task name</label>
            <input id="edit-task-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="input-label" htmlFor="edit-task-description">Description</label>
            <textarea id="edit-task-description" className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="form-grid form-grid--2">
            <div>
              <label className="input-label" htmlFor="edit-task-start">Start</label>
              <input id="edit-task-start" className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required disabled={isLocked} />
            </div>
            <div>
              <label className="input-label" htmlFor="edit-task-end">End</label>
              <input id="edit-task-end" className="input" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required disabled={isLocked} />
            </div>
          </div>
          {isLocked && (
            <div className="form-alert form-alert--info">
              Unlock this task to adjust start/end dates or drag it on the Gantt chart.
            </div>
          )}
          <div className="form-grid form-grid--2">
            <div>
              <label className="input-label" htmlFor="edit-task-status">Status</label>
              <select id="edit-task-status" className="select" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">Doing</option>
                <option value="DONE">Done</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>
            <div>
              <label className="input-label" htmlFor="edit-task-priority">Priority</label>
              <select id="edit-task-priority" className="select" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                <option value="H">High</option>
                <option value="M">Medium</option>
                <option value="L">Low</option>
              </select>
            </div>
          </div>
          <div>
            <label className="input-label" htmlFor="edit-task-assignee">Assignee</label>
            <input id="edit-task-assignee" className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
          </div>
          <div>
            <label className="input-label" htmlFor="edit-task-progress">Progress: {progress}%</label>
            <input
              id="edit-task-progress"
              className="range"
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
            />
          </div>
          <div className="modal__actions side-panel__actions">
            <button type="button" className="btn btn--outline btn--danger" onClick={handleDelete} disabled={deleteTask.isPending}>
              Delete
            </button>
            <button type="button" className="btn btn--outline" onClick={() => setIsEditing(false)} disabled={updateTask.isPending}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={updateTask.isPending}>
              {updateTask.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      ) : (
        <>

      {/* Status + Assignee */}
      <div className="side-panel__section">
        <div className="side-panel__field-grid">
          <div>
            <div className="side-panel__field-label">Schedule lock</div>
            <span className={`badge ${task.is_locked ? "badge--locked" : "badge--unlocked"}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                {task.is_locked ? "lock" : "lock_open"}
              </span>
              {task.is_locked ? "Locked" : "Adjustable"}
            </span>
          </div>
          <div>
            <div className="side-panel__field-label">Status</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background:
                    task.status === "DONE"
                      ? "var(--status-done)"
                      : task.status === "IN_PROGRESS"
                      ? "var(--status-in-progress)"
                      : "var(--status-desaturated)",
                }}
              />
              <span className={`badge ${statusClass(task.status)}`} style={{ padding: "4px 10px" }}>
                {statusLabel(task.status)}
              </span>
            </div>
          </div>
          <div>
            <div className="side-panel__field-label">Assignee</div>
            {task.assignee_id ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className={`avatar ${avatarColor(task.assignee_id)}`}>
                  {avatarInitials(task.assignee_id)}
                </div>
                <span className="text-body-sm">{task.assignee_id}</span>
              </div>
            ) : (
              <span className="text-body-sm" style={{ color: "var(--on-surface-variant)" }}>
                Unassigned
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="side-panel__section">
        <div className="side-panel__section-title">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_today</span>
          Timeline
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="text-body-sm">
            {formatDate(task.start_date)} - {formatDate(task.end_date)}
          </span>
          <span className="text-label-md" style={{ color: "var(--on-surface-variant)" }}>
            {duration} days
          </span>
        </div>
      </div>

      {/* Priority */}
      <div className="side-panel__section">
        <div className="side-panel__field-label">Priority</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background:
                task.priority === "H"
                  ? "var(--error)"
                  : task.priority === "M"
                  ? "var(--on-surface-variant)"
                  : "var(--status-desaturated)",
            }}
          />
          <span className="text-body-sm">
            {task.priority === "H" ? "High" : task.priority === "M" ? "Medium" : "Low"}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="side-panel__section">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span className="side-panel__section-title" style={{ margin: 0 }}>Progress</span>
          <span className="text-label-md" style={{ color: "var(--secondary)" }}>
            {task.progress}%
          </span>
        </div>
        <div className="progress-bar" style={{ height: 8 }}>
          <div className="progress-bar__fill" style={{ width: `${task.progress}%` }} />
        </div>
      </div>

      {/* Dependencies */}
      {blockingTasks.length > 0 && (
        <div className="side-panel__section">
          <div className="side-panel__section-title">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>device_hub</span>
            Dependencies
          </div>
          {blockingTasks.map((bt) =>
            bt ? (
              <div
                key={bt.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  background: "var(--error-container)",
                  borderRadius: "var(--radius-default)",
                  marginBottom: 8,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--error)" }}>
                  block
                </span>
                <span className="text-body-sm">Blocked by: {bt.name}</span>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* AI Risk Assessment Banner */}
      <div className="side-panel__section">
        <div className="ai-banner">
          <span className="ai-banner__icon material-symbols-outlined">insights</span>
          {blockingTasks.length > 0 ? "Blocked by dependencies" : task.progress < 40 && duration > 7 ? "Schedule needs attention" : "Risk level looks steady"}
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <div className="side-panel__section">
          <div className="side-panel__section-title">Description</div>
          <p className="text-body-sm" style={{ color: "var(--on-surface-variant)" }}>
            {task.description}
          </p>
        </div>
      )}

      {/* Activity */}
      <div className="side-panel__section">
        <div className="side-panel__section-title">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>history</span>
          {locale === "vi" ? "Nhật ký thay đổi" : "Activity log"}
        </div>
        {taskActivity.length ? (
          taskActivity.map((item) => (
            <div className="activity-item" key={item.id}>
              <div className="activity-item__icon">
                <span className="material-symbols-outlined">
                  {item.action.includes("progress") ? "percent" : item.action.includes("delete") ? "delete" : item.action.includes("create") ? "add_task" : "edit_calendar"}
                </span>
              </div>
              <div>
                <div className="activity-item__content">{item.summary}</div>
                <div className="activity-item__time">
                  {new Date(item.created_at).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="activity-empty">
            {locale === "vi" ? "Chưa có thay đổi nào được ghi nhận cho task này." : "No recorded changes for this task yet."}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
