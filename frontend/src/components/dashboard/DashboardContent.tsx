"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateProject, useProjects } from "@/hooks/use-gantt-mutations";
import { getErrorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n";
import Link from "next/link";

export default function DashboardContent() {
  const router = useRouter();
  const { t, locale } = useT();
  const { data: projects, isLoading, error } = useProjects();
  const createProject = useCreateProject();
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateProject = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    try {
      const project = await createProject.mutateAsync({
        name: projectName,
        description: projectDescription || null,
      });
      setProjectName("");
      setProjectDescription("");
      setIsProjectModalOpen(false);
      router.push(`/projects/${project.id}`);
    } catch (err: unknown) {
      setCreateError(getErrorMessage(err, "Could not create project."));
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard">
        <header className="dashboard__header">
          <h1 className="dashboard__title">{t.projectDashboard}</h1>
          <p className="dashboard__subtitle">
            {t.dashboardSubtitle}
          </p>
        </header>
        <div className="dashboard__grid dashboard__grid--3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card" style={{ height: 120 }}>
              <div className="skeleton" style={{ width: 80, height: 14, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: 60, height: 32 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalTasks = projects?.reduce((sum, p) => sum + p.task_count, 0) ?? 0;
  const avgProgress = projects?.length
    ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
    : 0;

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div className="dashboard__header-row">
          <div>
            <h1 className="dashboard__title">{t.projectDashboard}</h1>
            <p className="dashboard__subtitle">
              {t.dashboardSubtitle}
            </p>
          </div>
          <button className="btn btn--primary" onClick={() => setIsProjectModalOpen(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            {t.newProject}
          </button>
        </div>
      </header>

      {error && (
        <div className="form-alert form-alert--error" style={{ marginBottom: 24 }}>
          {(error as Error).message || "Could not load projects."}
        </div>
      )}

      {/* ── Stat Cards ──────────────────────────────────────── */}
      <div className="dashboard__grid dashboard__grid--3" style={{ marginBottom: 24 }}>
        {/* Total Tasks */}
        <div className="card">
          <div className="stat-card">
            <div>
              <p className="stat-card__label text-label-md">{t.totalTasks}</p>
              <h2 className="stat-card__value">{totalTasks}</h2>
            </div>
            <div
              className="stat-card__icon"
              style={{ background: "var(--secondary-fixed)", color: "var(--secondary)" }}
            >
              <span className="material-symbols-outlined">task</span>
            </div>
          </div>
        </div>

        {/* Overdue */}
        <div className="card card--overdue">
          <div className="stat-card">
            <div>
              <p className="stat-card__label text-label-md">{t.activeProjects}</p>
              <h2 className="stat-card__value stat-card__value--error">{projects?.filter((p) => p.progress < 100).length ?? 0}</h2>
            </div>
            <div
              className="stat-card__icon"
              style={{ background: "var(--error-container)", color: "var(--error)" }}
            >
              <span className="material-symbols-outlined">warning</span>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="card">
          <div className="stat-card" style={{ marginBottom: 16 }}>
            <div>
              <p className="stat-card__label text-label-md">{t.progress}</p>
              <h2 className="stat-card__value">{avgProgress}%</h2>
            </div>
            <div
              className="stat-card__icon"
              style={{ background: "var(--primary-fixed-dim)", color: "var(--primary-fixed)" }}
            >
              <span className="material-symbols-outlined">trending_up</span>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-bar__fill" style={{ width: `${avgProgress}%` }} />
          </div>
        </div>
      </div>

      {/* ── Bento: Workload + Risks ─────────────────────────── */}
      <div className="dashboard__grid dashboard__grid--bento" style={{ marginBottom: 24 }}>
        {/* Resource Workload */}
        <div className="card">
          <h3 className="card__title">{t.workload}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              { name: "Sarah Jenkins", tasks: 14, pct: 60, extra: 20 },
              { name: "Marcus Chen", tasks: 22, pct: 80, extra: 15, danger: true },
              { name: "Elena Rodriguez", tasks: 8, pct: 35, extra: 0 },
            ].map((person) => (
              <div key={person.name}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span className="text-body-sm" style={{ fontWeight: 500 }}>
                    {person.name}
                  </span>
                  <span className="text-body-sm" style={{ color: "var(--on-surface-variant)" }}>
                    {person.tasks} {locale === "vi" ? "công việc" : "tasks"}{person.danger ? (locale === "vi" ? " (quá tải)" : " (Overloaded)") : ""}
                  </span>
                </div>
                <div className="workload-bar">
                  <div
                    className="workload-bar__segment workload-bar__segment--primary"
                    style={{ width: `${person.pct}%` }}
                  />
                  {person.extra > 0 && (
                    <div
                      className={`workload-bar__segment ${
                        person.danger ? "workload-bar__segment--danger" : "workload-bar__segment--secondary"
                      }`}
                      style={{ width: `${person.extra}%` }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Risks */}
        <div className="card">
          <h3 className="card__title">{t.activeRisks}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="risk-item">
              <span className="risk-item__icon material-symbols-outlined" style={{ color: "var(--secondary)" }}>
                info
              </span>
              <div>
                <p className="risk-item__title">{locale === "vi" ? "Độ trễ backend" : "Backend latency"}</p>
                <span className="risk-item__severity risk-item__severity--low">{locale === "vi" ? "Thấp" : "Low"}</span>
              </div>
            </div>
            <div className="risk-item">
              <span className="risk-item__icon material-symbols-outlined" style={{ color: "var(--on-tertiary-container)" }}>
                warning
              </span>
              <div>
                <p className="risk-item__title">{locale === "vi" ? "Chậm phản hồi thiết kế" : "Design feedback delay"}</p>
                <span className="risk-item__severity risk-item__severity--medium">{locale === "vi" ? "Trung bình" : "Medium"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mini Timeline ───────────────────────────────────── */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
          <h3 className="card__title" style={{ margin: 0 }}>{locale === "vi" ? "Hai tuần tới" : "Next 2 Weeks Overview"}</h3>
          {projects && projects.length > 0 && (
            <Link
              href={`/projects/${projects[0].id}`}
              className="text-label-sm"
              style={{ color: "var(--secondary)", textDecoration: "none" }}
            >
              {t.viewFullGantt}
            </Link>
          )}
        </div>
        <div className="mini-timeline">
          <div className="mini-timeline__col mini-timeline__col--weekend">
            <span className="mini-timeline__label">{locale === "vi" ? "Tuần 1" : "Week 1"}</span>
          </div>
          <div className="mini-timeline__col">
            <span className="mini-timeline__label">{locale === "vi" ? "Giữa kỳ" : "Mid"}</span>
          </div>
          <div className="mini-timeline__col">
            <span className="mini-timeline__label">{locale === "vi" ? "Tuần 2" : "Week 2"}</span>
          </div>
          <div className="mini-timeline__col mini-timeline__col--weekend">
            <span className="mini-timeline__label">{locale === "vi" ? "Kết thúc" : "End"}</span>
          </div>
          {/* Task bars */}
          <div className="mini-timeline__bar mini-timeline__bar--primary" style={{ top: 16, left: "10%", width: "40%" }}>
            {locale === "vi" ? "Tích hợp API" : "API Integration"}
          </div>
          <div className="mini-timeline__bar mini-timeline__bar--secondary" style={{ top: 48, left: "30%", width: "45%" }}>
            {locale === "vi" ? "Triển khai giao diện" : "UI Implementation"}
          </div>
          <div className="mini-timeline__bar mini-timeline__bar--neutral" style={{ top: 80, left: "70%", width: "25%" }}>
            {locale === "vi" ? "Kiểm thử" : "Testing"}
          </div>
        </div>
      </div>

      {/* ── Project List ────────────────────────────────────── */}
      {projects && projects.length > 0 ? (
        <div className="card" id="projects" style={{ marginTop: 24 }}>
          <h3 className="card__title">{t.projects}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--outline-variant)",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "background var(--transition-fast)",
                }}
                className="animate-fade-in"
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="project-selector__dot" />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{project.name}</div>
                    <div className="text-body-sm" style={{ color: "var(--on-surface-variant)" }}>
                      {project.task_count} {locale === "vi" ? "công việc" : "tasks"} · {project.progress}% {locale === "vi" ? "hoàn thành" : "complete"}
                    </div>
                  </div>
                </div>
                <span className="material-symbols-outlined" style={{ color: "var(--on-surface-variant)" }}>
                  arrow_forward
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state empty-state--panel">
          <span className="empty-state__icon material-symbols-outlined">folder_open</span>
          <h3 className="empty-state__title">{t.noProjects}</h3>
          <p className="empty-state__description">{t.noProjectsHelp}</p>
          <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={() => setIsProjectModalOpen(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            {t.createFirstProject}
          </button>
        </div>
      )}

      {isProjectModalOpen && (
        <div className="modal-overlay" role="presentation" onMouseDown={() => !createProject.isPending && setIsProjectModalOpen(false)}>
          <div className="modal animate-fade-in" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <h2 className="modal__title">{t.newProject}</h2>
            {createError && <div className="form-alert form-alert--error">{createError}</div>}
            <form className="form-stack" onSubmit={handleCreateProject}>
              <div>
                <label className="input-label" htmlFor="project-name">{locale === "vi" ? "Tên dự án" : "Project name"}</label>
                <input
                  id="project-name"
                  className="input"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  minLength={1}
                  maxLength={255}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="input-label" htmlFor="project-description">{locale === "vi" ? "Mô tả" : "Description"}</label>
                <textarea
                  id="project-description"
                  className="textarea"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  maxLength={5000}
                />
              </div>
              <div className="modal__actions">
                <button type="button" className="btn btn--outline" onClick={() => setIsProjectModalOpen(false)} disabled={createProject.isPending}>
                  {locale === "vi" ? "Hủy" : "Cancel"}
                </button>
                <button type="submit" className="btn btn--primary" disabled={createProject.isPending}>
                  {createProject.isPending ? (locale === "vi" ? "Đang tạo..." : "Creating...") : t.newProject}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
