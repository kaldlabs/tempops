"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopNav from "@/components/layout/TopNav";
import { useCreateProject, useProjects } from "@/hooks/use-gantt-mutations";
import { getErrorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n";

export default function ProjectsPage() {
  const router = useRouter();
  const { t, locale } = useT();
  const { data: projects, isLoading, error } = useProjects();
  const createProject = useCreateProject();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    try {
      const project = await createProject.mutateAsync({ name, description: description || null });
      setModalOpen(false);
      setName("");
      setDescription("");
      router.push(`/projects/${project.id}`);
    } catch (err: unknown) {
      setCreateError(getErrorMessage(err, "Could not create project."));
    }
  };

  return (
    <>
      <TopNav />
      <main className="main-content">
        <div className="dashboard project-index">
          <header className="dashboard__header dashboard__header-row">
            <div>
              <h1 className="dashboard__title">{t.projects}</h1>
              <p className="dashboard__subtitle">
                {locale === "vi"
                  ? "Quản lý toàn bộ dự án, mở Gantt, theo dõi tiến độ và xem phân tích nhanh."
                  : "All roadmaps with direct Gantt access, progress, and quick analysis."}
              </p>
            </div>
            <button className="btn btn--primary" onClick={() => setModalOpen(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              {t.newProject}
            </button>
          </header>
          {error && <div className="form-alert form-alert--error">{(error as Error).message}</div>}
          {isLoading ? (
            <div className="project-grid">
              {[1, 2, 3].map((item) => <div key={item} className="card skeleton" style={{ height: 180 }} />)}
            </div>
          ) : projects?.length ? (
            <div className="project-grid">
              {projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="project-card">
                  <div>
                    <span className="project-card__kicker">
                      {project.task_count} {locale === "vi" ? "công việc" : "tasks"}
                    </span>
                    <h2>{project.name}</h2>
                    <p>{project.description || (locale === "vi" ? "Chưa có mô tả." : "No description yet.")}</p>
                  </div>
                  <div className="project-card__footer">
                    <div className="progress-bar">
                      <div className="progress-bar__fill" style={{ width: `${project.progress}%` }} />
                    </div>
                    <span>{project.progress}%</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state empty-state--panel project-empty">
              <span className="empty-state__icon material-symbols-outlined">route</span>
              <h3 className="empty-state__title">{t.noProjects}</h3>
              <p className="empty-state__description">{t.noProjectsHelp}</p>
              <button className="btn btn--primary" onClick={() => setModalOpen(true)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                {t.createFirstProject}
              </button>
            </div>
          )}
        </div>
      </main>
      {modalOpen && (
        <div className="modal-overlay" role="presentation" onMouseDown={() => !createProject.isPending && setModalOpen(false)}>
          <div className="modal animate-fade-in" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <h2 className="modal__title">{t.newProject}</h2>
            {createError && <div className="form-alert form-alert--error">{createError}</div>}
            <form className="form-stack" onSubmit={create}>
              <div>
                <label className="input-label" htmlFor="project-name">{locale === "vi" ? "Tên dự án" : "Project name"}</label>
                <input id="project-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </div>
              <div>
                <label className="input-label" htmlFor="project-description">{locale === "vi" ? "Mô tả" : "Description"}</label>
                <textarea id="project-description" className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="modal__actions">
                <button type="button" className="btn btn--outline" onClick={() => setModalOpen(false)}>{locale === "vi" ? "Hủy" : "Cancel"}</button>
                <button type="submit" className="btn btn--primary" disabled={createProject.isPending}>
                  {createProject.isPending ? "..." : t.newProject}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
