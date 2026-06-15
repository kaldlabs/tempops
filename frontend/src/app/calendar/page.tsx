"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useGanttData, useProjects } from "@/hooks/use-gantt-mutations";
import { flattenTaskTree } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import TopNav from "@/components/layout/TopNav";
import type { FlatTask, ProjectListItem, TaskStatus } from "@/types";

type CalendarView = "month" | "week" | "agenda";

const DAY_MS = 1000 * 60 * 60 * 24;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start: Date, end: Date) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS);
}

function getWeekStart(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(next, offset);
}

function getMonthGrid(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = getWeekStart(first);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function formatDate(date: Date, locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", options).format(date);
}

function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function taskTouchesDate(task: FlatTask, date: Date) {
  const start = startOfDay(new Date(task.start_date));
  const end = startOfDay(new Date(task.end_date));
  const target = startOfDay(date);
  return start <= target && target <= end;
}

function getStatusLabel(status: TaskStatus, locale: string) {
  if (locale !== "vi") {
    return status === "TODO" ? "To Do" : status === "IN_PROGRESS" ? "In Progress" : status === "DONE" ? "Done" : "Overdue";
  }
  return status === "TODO" ? "Chưa bắt đầu" : status === "IN_PROGRESS" ? "Đang xử lý" : status === "DONE" ? "Hoàn thành" : "Quá hạn";
}

function statusClass(status: TaskStatus) {
  return status === "DONE" ? "done" : status === "IN_PROGRESS" ? "active" : status === "OVERDUE" ? "late" : "todo";
}

function getProjectName(projects: ProjectListItem[] | undefined, selectedProjectId: string) {
  return projects?.find((project) => project.id === selectedProjectId)?.name || "";
}

export default function CalendarPage() {
  const { t, locale } = useT();
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useProjects();
  const sortedProjects = useMemo(
    () => [...(projects || [])].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)),
    [projects]
  );
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const projectSwitcherRef = useRef<HTMLDivElement>(null);

  const activeProjectId = selectedProjectId || sortedProjects[0]?.id || "";

  const { data: ganttData, isLoading: ganttLoading, error: ganttError } = useGanttData(activeProjectId);

  const tasks = useMemo(() => {
    if (!ganttData?.tasks) return [];
    const expandedIds = new Set<string>();
    const collectIds = (nodes: typeof ganttData.tasks) => {
      for (const node of nodes) {
        expandedIds.add(node.id);
        if (node.children?.length) collectIds(node.children);
      }
    };
    collectIds(ganttData.tasks);
    return flattenTaskTree(ganttData.tasks, 0, expandedIds);
  }, [ganttData]);

  const today = startOfDay(new Date());
  const monthDays = useMemo(() => getMonthGrid(anchorDate), [anchorDate]);
  const weekDays = useMemo(() => {
    const weekStart = getWeekStart(anchorDate);
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [anchorDate]);

  const visibleDays = calendarView === "week" ? weekDays : monthDays;
  const upcomingTasks = useMemo(
    () =>
      [...tasks]
        .filter((task) => new Date(task.end_date) >= today && task.status !== "DONE")
        .sort((a, b) => +new Date(a.end_date) - +new Date(b.end_date))
        .slice(0, 7),
    [tasks, today]
  );
  const overdueTasks = tasks.filter((task) => task.status !== "DONE" && new Date(task.end_date) < today);
  const dueThisWeek = tasks.filter((task) => {
    const end = new Date(task.end_date);
    return end >= today && end <= addDays(today, 7) && task.status !== "DONE";
  });
  const activeTasks = tasks.filter((task) => task.status === "IN_PROGRESS");
  const completion = tasks.length ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length) : 0;
  const selectedProjectName = getProjectName(projects, activeProjectId);
  const selectedProject = sortedProjects.find((project) => project.id === activeProjectId);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!projectSwitcherRef.current?.contains(event.target as Node)) {
        setProjectSwitcherOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const changePeriod = (direction: -1 | 1) => {
    const amount = calendarView === "month" ? 30 : 7;
    setAnchorDate((current) => addDays(current, amount * direction));
  };

  const calendarTitle =
    calendarView === "month"
      ? formatDate(anchorDate, locale, { month: "long", year: "numeric" })
      : `${formatDate(weekDays[0], locale, { day: "2-digit", month: "short" })} - ${formatDate(weekDays[6], locale, { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <>
      <TopNav />
      <main className="main-content">
        <div className="calendar-shell">
          <header className="calendar-hero">
            <div>
              <p className="calendar-hero__eyebrow">{locale === "vi" ? "Lịch điều phối" : "Delivery calendar"}</p>
              <h1>{t.calendar}</h1>
              <p>
                {locale === "vi"
                  ? "Theo dõi mốc bắt đầu, hạn kết thúc, công việc quá hạn và tải vận hành theo từng dự án."
                  : "Track starts, due dates, overdue work, and delivery load across each project."}
              </p>
            </div>
            <div className="calendar-hero__actions">
              <div className="project-switcher" ref={projectSwitcherRef}>
                <button
                  className="project-switcher__trigger"
                  type="button"
                  onClick={() => setProjectSwitcherOpen((value) => !value)}
                  disabled={!sortedProjects.length}
                  aria-haspopup="listbox"
                  aria-expanded={projectSwitcherOpen}
                >
                  <span className="project-selector__dot" />
                  <span>
                    <strong>{selectedProject?.name || (locale === "vi" ? "Chưa có dự án" : "No project")}</strong>
                    <small>
                      {selectedProject
                        ? `${selectedProject.task_count} ${locale === "vi" ? "công việc" : "tasks"} · ${selectedProject.progress}%`
                        : locale === "vi"
                        ? "Tạo dự án để xem lịch"
                        : "Create a project to view schedule"}
                    </small>
                  </span>
                  <span className="material-symbols-outlined">expand_more</span>
                </button>
                {projectSwitcherOpen && (
                  <div className="project-switcher__menu" role="listbox">
                    <div className="project-switcher__menu-header">
                      <span className="material-symbols-outlined">folder_managed</span>
                      <div>
                        <strong>{locale === "vi" ? "Chọn dự án" : "Select project"}</strong>
                        <small>{locale === "vi" ? "Lịch sẽ đọc từ Gantt đã chọn" : "Calendar follows the selected Gantt"}</small>
                      </div>
                    </div>
                    {sortedProjects.map((project) => (
                      <button
                        key={project.id}
                        className={`project-switcher__option ${project.id === activeProjectId ? "project-switcher__option--active" : ""}`}
                        type="button"
                        role="option"
                        aria-selected={project.id === activeProjectId}
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          setProjectSwitcherOpen(false);
                        }}
                      >
                        <span className="project-selector__dot" />
                        <span>
                          <strong>{project.name}</strong>
                          <small>{project.task_count} {locale === "vi" ? "công việc" : "tasks"} · {project.progress}%</small>
                        </span>
                        {project.id === activeProjectId && <span className="material-symbols-outlined">check</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {activeProjectId && (
                <Link href={`/projects/${activeProjectId}`} className="btn btn--primary">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>view_timeline</span>
                  Gantt
                </Link>
              )}
            </div>
          </header>

          {(projectsError || ganttError) && (
            <div className="form-alert form-alert--error">
              {((projectsError || ganttError) as Error).message}
            </div>
          )}

          {!projectsLoading && !sortedProjects.length ? (
            <div className="empty-state empty-state--panel project-empty">
              <span className="empty-state__icon material-symbols-outlined">event_busy</span>
              <h3 className="empty-state__title">{locale === "vi" ? "Chưa có lịch dự án" : "No project calendar yet"}</h3>
              <p className="empty-state__description">
                {locale === "vi"
                  ? "Tạo dự án đầu tiên để tempops hiển thị mốc thời gian, hạn hoàn thành và tải công việc."
                  : "Create a first project so tempops can show schedule dates, deadlines, and workload."}
              </p>
              <Link href="/projects" className="btn btn--primary">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                {t.createFirstProject}
              </Link>
            </div>
          ) : (
            <>

          <section className="calendar-metrics" aria-label={locale === "vi" ? "Tổng quan lịch" : "Calendar summary"}>
            {[
              { label: locale === "vi" ? "Đang xử lý" : "In progress", value: activeTasks.length, icon: "pending_actions" },
              { label: locale === "vi" ? "Đến hạn 7 ngày" : "Due in 7 days", value: dueThisWeek.length, icon: "event_upcoming" },
              { label: locale === "vi" ? "Quá hạn" : "Overdue", value: overdueTasks.length, icon: "warning", danger: overdueTasks.length > 0 },
              { label: locale === "vi" ? "Hoàn tất trung bình" : "Average completion", value: `${completion}%`, icon: "data_usage" },
            ].map((metric) => (
              <div key={metric.label} className={`calendar-metric ${metric.danger ? "calendar-metric--danger" : ""}`}>
                <span className="material-symbols-outlined">{metric.icon}</span>
                <strong>{metric.value}</strong>
                <small>{metric.label}</small>
              </div>
            ))}
          </section>

          <section className="calendar-layout">
            <div className="calendar-main">
              <div className="calendar-toolbar">
                <div>
                  <strong>{calendarTitle}</strong>
                  <span>{selectedProjectName || (locale === "vi" ? "Chưa chọn dự án" : "No project selected")}</span>
                </div>
                <div className="calendar-toolbar__controls">
                  <button className="icon-btn" type="button" onClick={() => changePeriod(-1)} aria-label={locale === "vi" ? "Kỳ trước" : "Previous period"}>
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <button className="btn btn--outline" type="button" onClick={() => setAnchorDate(today)}>
                    {locale === "vi" ? "Hôm nay" : "Today"}
                  </button>
                  <button className="icon-btn" type="button" onClick={() => changePeriod(1)} aria-label={locale === "vi" ? "Kỳ sau" : "Next period"}>
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                  <div className="segmented-control segmented-control--compact">
                    {(["month", "week", "agenda"] as const).map((view) => (
                      <button
                        key={view}
                        className={`segmented-control__button ${calendarView === view ? "segmented-control__button--active" : ""}`}
                        onClick={() => setCalendarView(view)}
                        type="button"
                      >
                        {locale === "vi"
                          ? view === "month"
                            ? "Tháng"
                            : view === "week"
                            ? "Tuần"
                            : "Lịch trình"
                          : view}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="calendar-scroll" aria-label={locale === "vi" ? "Nội dung lịch có thể cuộn" : "Scrollable calendar content"}>
                {projectsLoading || ganttLoading ? (
                  <div className="calendar-loading">
                    <div className="skeleton" />
                    <div className="skeleton" />
                    <div className="skeleton" />
                  </div>
                ) : calendarView === "agenda" ? (
                  <div className="calendar-agenda">
                  {upcomingTasks.length ? (
                    upcomingTasks.map((task) => (
                      <Link key={task.id} href={`/projects/${task.project_id}`} className="agenda-row">
                        <span className={`calendar-dot calendar-dot--${statusClass(task.status)}`} />
                        <div>
                          <strong>{task.name}</strong>
                          <span>{getStatusLabel(task.status, locale)} · {task.progress}%</span>
                        </div>
                        <time>{formatDate(new Date(task.end_date), locale, { dateStyle: "medium" })}</time>
                      </Link>
                    ))
                  ) : (
                    <div className="calendar-empty">
                      <span className="material-symbols-outlined">event_available</span>
                      <strong>{locale === "vi" ? "Không có hạn sắp tới" : "No upcoming deadlines"}</strong>
                      <p>{locale === "vi" ? "Các công việc của dự án đang không có mốc cần xử lý gần." : "This project has no immediate scheduled work."}</p>
                    </div>
                  )}
                  </div>
                ) : (
                  <div className={`calendar-grid calendar-grid--${calendarView}`}>
                  {visibleDays.slice(0, 7).map((day) => (
                    <div key={`head-${day.toISOString()}`} className="calendar-grid__weekday">
                      {formatDate(day, locale, { weekday: "short" })}
                    </div>
                  ))}
                  {visibleDays.map((day) => {
                    const dayTasks = tasks.filter((task) => taskTouchesDate(task, day));
                    const isCurrentMonth = day.getMonth() === anchorDate.getMonth();
                    return (
                      <div
                        key={day.toISOString()}
                        className={`calendar-day ${!isCurrentMonth && calendarView === "month" ? "calendar-day--muted" : ""} ${isSameDay(day, today) ? "calendar-day--today" : ""}`}
                      >
                        <div className="calendar-day__top">
                          <strong>{formatDate(day, locale, { day: "2-digit" })}</strong>
                          {dayTasks.length > 0 && <span>{dayTasks.length}</span>}
                        </div>
                        <div className="calendar-day__events">
                          {dayTasks.slice(0, calendarView === "week" ? 8 : 3).map((task) => (
                            <Link key={task.id} href={`/projects/${task.project_id}`} className={`calendar-chip calendar-chip--${statusClass(task.status)}`}>
                              <span>{task.name}</span>
                              <small>{task.progress}%</small>
                            </Link>
                          ))}
                          {dayTasks.length > (calendarView === "week" ? 8 : 3) && (
                            <span className="calendar-more">
                              +{dayTasks.length - (calendarView === "week" ? 8 : 3)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>
            </div>

            <aside className="calendar-side">
              <section>
                <h2>{locale === "vi" ? "Hạn cần chú ý" : "Priority deadlines"}</h2>
                <div className="deadline-list">
                  {upcomingTasks.length ? (
                    upcomingTasks.slice(0, 5).map((task) => (
                      <Link key={task.id} href={`/projects/${task.project_id}`} className="deadline-item">
                        <span className={`calendar-dot calendar-dot--${statusClass(task.status)}`} />
                        <div>
                          <strong>{task.name}</strong>
                          <small>{daysBetween(today, new Date(task.end_date))} {locale === "vi" ? "ngày còn lại" : "days left"}</small>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <p className="calendar-side__empty">{locale === "vi" ? "Không có hạn gần." : "No near-term deadlines."}</p>
                  )}
                </div>
              </section>

              <section>
                <h2>{locale === "vi" ? "Phân bổ trạng thái" : "Status mix"}</h2>
                <div className="status-stack">
                  {(["TODO", "IN_PROGRESS", "DONE", "OVERDUE"] as TaskStatus[]).map((status) => {
                    const count = tasks.filter((task) => task.status === status).length;
                    const width = tasks.length ? Math.max(6, Math.round((count / tasks.length) * 100)) : 0;
                    return (
                      <div key={status} className="status-stack__row">
                        <span>{getStatusLabel(status, locale)}</span>
                        <div>
                          <i className={`calendar-fill calendar-fill--${statusClass(status)}`} style={{ width: `${width}%` }} />
                        </div>
                        <strong>{count}</strong>
                      </div>
                    );
                  })}
                </div>
              </section>
            </aside>
          </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}
