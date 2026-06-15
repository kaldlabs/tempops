"use client";

import { useMemo, useState } from "react";
import { useCreateTask } from "@/hooks/use-gantt-mutations";
import { getErrorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n";
import { addDays } from "@/lib/utils";
import { useGanttStore } from "@/store/use-gantt-store";
import type { FlatTask, TaskPriority, TaskStatus } from "@/types";

interface NewTaskModalProps {
  projectId: string;
  tasks: FlatTask[];
}

export default function NewTaskModal({ projectId, tasks }: NewTaskModalProps) {
  const { locale } = useT();
  const { isNewTaskModalOpen, setNewTaskModalOpen } = useGanttStore();
  const createTask = useCreateTask(projectId);
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDays(today, 3));
  const [parentId, setParentId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("M");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [assignee, setAssignee] = useState("");
  const [isLocked, setIsLocked] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!isNewTaskModalOpen) return null;

  const close = () => {
    if (createTask.isPending) return;
    setNewTaskModalOpen(false);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await createTask.mutateAsync({
        project_id: projectId,
        name,
        description: description || null,
        start_date: startDate,
        end_date: endDate,
        parent_id: parentId || null,
        priority,
        status,
        assignee_id: assignee || null,
        sort_order: tasks.length,
        is_locked: isLocked,
      });
      setName("");
      setDescription("");
      setStartDate(today);
      setEndDate(addDays(today, 3));
      setParentId("");
      setPriority("M");
      setStatus("TODO");
      setAssignee("");
      setIsLocked(true);
      setNewTaskModalOpen(false);
    } catch (err: unknown) {
      setError(getErrorMessage(err, locale === "vi" ? "Không thể tạo công việc." : "Could not create task."));
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={close}>
      <div className="modal modal--wide animate-fade-in" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="modal__title">{locale === "vi" ? "Tạo công việc" : "New Task"}</h2>
        {error && <div className="form-alert form-alert--error">{error}</div>}
        <form onSubmit={handleSubmit} className="form-stack">
          <div>
            <label className="input-label" htmlFor="task-name">{locale === "vi" ? "Tên công việc" : "Task name"}</label>
            <input
              id="task-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={1}
              maxLength={255}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="input-label" htmlFor="task-description">{locale === "vi" ? "Mô tả" : "Description"}</label>
            <textarea
              id="task-description"
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
            />
          </div>
          <div className="form-grid form-grid--2">
            <div>
              <label className="input-label" htmlFor="task-start">{locale === "vi" ? "Ngày bắt đầu" : "Start"}</label>
              <input
                id="task-start"
                className="input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="input-label" htmlFor="task-end">{locale === "vi" ? "Ngày kết thúc" : "End"}</label>
              <input
                id="task-end"
                className="input"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                required
              />
            </div>
          </div>
          <div className="form-grid form-grid--2">
            <div>
              <label className="input-label" htmlFor="task-status">{locale === "vi" ? "Trạng thái" : "Status"}</label>
              <select id="task-status" className="select" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                <option value="TODO">{locale === "vi" ? "Chưa bắt đầu" : "To Do"}</option>
                <option value="IN_PROGRESS">{locale === "vi" ? "Đang thực hiện" : "Doing"}</option>
                <option value="DONE">{locale === "vi" ? "Hoàn tất" : "Done"}</option>
                <option value="OVERDUE">{locale === "vi" ? "Trễ hạn" : "Overdue"}</option>
              </select>
            </div>
            <div>
              <label className="input-label" htmlFor="task-priority">{locale === "vi" ? "Độ ưu tiên" : "Priority"}</label>
              <select id="task-priority" className="select" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                <option value="H">{locale === "vi" ? "Cao" : "High"}</option>
                <option value="M">{locale === "vi" ? "Trung bình" : "Medium"}</option>
                <option value="L">{locale === "vi" ? "Thấp" : "Low"}</option>
              </select>
            </div>
          </div>
          <div className="form-grid form-grid--2">
            <div>
              <label className="input-label" htmlFor="task-parent">{locale === "vi" ? "Công việc cha" : "Parent task"}</label>
              <select id="task-parent" className="select" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">{locale === "vi" ? "Không có" : "No parent"}</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {"--".repeat(task.depth)} {task.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label" htmlFor="task-assignee">{locale === "vi" ? "Người phụ trách" : "Assignee"}</label>
              <input
                id="task-assignee"
                className="input"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="@kietdo"
              />
            </div>
          </div>
          <label className="form-check">
            <input
              type="checkbox"
              checked={isLocked}
              onChange={(event) => setIsLocked(event.target.checked)}
            />
            <span>
              {locale === "vi"
                ? "Khóa lịch sau khi tạo. Muốn kéo hoặc đổi ngày trên Gantt cần mở khóa trong panel công việc."
                : "Lock schedule after creation. Unlock in the task panel before dragging or changing dates on the Gantt."}
            </span>
          </label>
          <div className="modal__actions">
            <button type="button" className="btn btn--outline" onClick={close}>{locale === "vi" ? "Hủy" : "Cancel"}</button>
            <button type="submit" className="btn btn--primary" disabled={createTask.isPending}>
              {createTask.isPending ? (locale === "vi" ? "Đang tạo..." : "Creating...") : locale === "vi" ? "Tạo công việc" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
