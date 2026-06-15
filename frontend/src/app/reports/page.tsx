"use client";

import Link from "next/link";
import { useProjects } from "@/hooks/use-gantt-mutations";
import { useT } from "@/lib/i18n";
import TopNav from "@/components/layout/TopNav";

export default function ReportsPage() {
  const { t, locale } = useT();
  const { data: projects, isLoading, error } = useProjects();
  const totalTasks = projects?.reduce((sum, project) => sum + project.task_count, 0) ?? 0;
  const avgProgress = projects?.length ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length) : 0;
  const activeProjects = projects?.filter((project) => project.progress < 100).length ?? 0;
  const stalled = projects?.filter((project) => project.progress === 0).length ?? 0;

  return (
    <>
      <TopNav />
      <main className="main-content">
        <div className="dashboard">
          <header className="dashboard__header dashboard__header-row">
            <div>
              <h1 className="dashboard__title">{t.reports}</h1>
              <p className="dashboard__subtitle">
                {locale === "vi" ? "Theo dõi trạng thái danh mục, nhịp thực thi và các dự án cần ưu tiên." : "Portfolio health, execution rhythm, and projects that need attention."}
              </p>
            </div>
            <Link href="/projects" className="btn btn--primary">{t.openProject}</Link>
          </header>
          {error && <div className="form-alert form-alert--error">{(error as Error).message}</div>}
          <div className="report-hero">
            {[
              [t.activeProjects, activeProjects, "workspaces"],
              [t.totalTasks, totalTasks, "checklist"],
              [t.progress, `${avgProgress}%`, "query_stats"],
              [locale === "vi" ? "Chưa khởi động" : "Stalled", stalled, "pause_circle"],
            ].map(([label, value, icon]) => (
              <div key={label} className="card report-metric">
                <span className="material-symbols-outlined">{icon}</span>
                <p>{label}</p>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="dashboard__grid dashboard__grid--bento">
            <div className="card">
              <h3 className="card__title">{locale === "vi" ? "Hiệu suất dự án" : "Project Performance"}</h3>
              {isLoading ? (
                <div className="skeleton" style={{ height: 180 }} />
              ) : projects?.length ? (
                <div className="report-list">
                  {projects.map((project) => (
                    <Link key={project.id} href={`/projects/${project.id}`} className="report-list__item">
                      <div>
                        <strong>{project.name}</strong>
                        <span>{project.task_count} {locale === "vi" ? "công việc" : "tasks"}</span>
                      </div>
                      <div className="report-list__progress">
                        <div className="progress-bar">
                          <div className="progress-bar__fill" style={{ width: `${project.progress}%` }} />
                        </div>
                        <small>{project.progress}%</small>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="empty-state empty-state--compact">
                  <span className="empty-state__icon material-symbols-outlined">monitoring</span>
                  <h3 className="empty-state__title">{locale === "vi" ? "Chưa có dữ liệu báo cáo" : "No report data yet"}</h3>
                  <Link href="/projects" className="btn btn--primary">{t.createFirstProject}</Link>
                </div>
              )}
            </div>
            <div className="card insight-stack">
              <h3 className="card__title">{locale === "vi" ? "Khuyến nghị" : "Recommendations"}</h3>
              <p>{locale === "vi" ? "Mở từng Gantt để xem trạng thái ML và nhãn phân loại công việc." : "Open each Gantt chart to see ML Health and auto task tags."}</p>
              <p>{locale === "vi" ? "Dự án chưa có tiến độ nên được bổ sung giai đoạn khởi tạo hoặc tạo bản nháp WBS bằng AI." : "0% projects should get a first phase or use the AI assistant to queue a WBS draft."}</p>
              <p>{locale === "vi" ? "Đồng bộ thời gian thực giúp các thay đổi công việc được cập nhật cho nhiều người dùng." : "Project WebSockets keep task changes synced across collaborators."}</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
