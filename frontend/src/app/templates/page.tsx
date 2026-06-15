"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "@/components/layout/TopNav";
import { useInstantiateTemplate, useRunAutomation, useTemplates } from "@/hooks/use-gantt-mutations";
import { getErrorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n";

export default function TemplatesPage() {
  const { locale, t } = useT();
  const router = useRouter();
  const { data: templates, isLoading } = useTemplates();
  const runAutomation = useRunAutomation();
  const instantiateTemplate = useInstantiateTemplate();
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const templateStats = useMemo(() => {
    const totalDays = (templates || []).reduce((sum, template) => {
      const parsed = JSON.parse(template.template_json) as { default_duration_days?: number };
      return sum + (parsed.default_duration_days || 0);
    }, 0);
    return { count: templates?.length || 0, totalDays };
  }, [templates]);

  const handleUseTemplate = async (id: string) => {
    setActiveTemplateId(id);
    setStatusMessage(null);
    try {
      const project = await instantiateTemplate.mutateAsync(id);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setStatusMessage(getErrorMessage(err, locale === "vi" ? "Không thể tạo project từ mẫu." : "Could not create project from template."));
    } finally {
      setActiveTemplateId(null);
    }
  };

  return (
    <>
      <TopNav />
      <main className="main-content">
        <div className="template-shell">
          <header className="template-hero">
            <div>
              <p className="calendar-hero__eyebrow">{locale === "vi" ? "Thư viện vận hành" : "Operating library"}</p>
              <h1>{t.templates}</h1>
              <p>
                {locale === "vi"
                  ? "Khởi tạo nhanh roadmap, sprint và release plan với cấu trúc phase rõ ràng, sau đó đưa vào Gantt để theo dõi rủi ro và phụ thuộc."
                  : "Start roadmaps, sprints, and release plans from structured phases, then move them into Gantt for risk and dependency tracking."}
              </p>
            </div>
            <div className="template-hero__panel">
              <div>
                <strong>{templateStats.count}</strong>
                <span>{locale === "vi" ? "mẫu sẵn dùng" : "ready templates"}</span>
              </div>
              <div>
                <strong>{templateStats.totalDays}</strong>
                <span>{locale === "vi" ? "ngày kế hoạch" : "planned days"}</span>
              </div>
              <button className="btn btn--primary" type="button" onClick={() => runAutomation.mutate()} disabled={runAutomation.isPending}>
                <span className="material-symbols-outlined">rule_settings</span>
                {runAutomation.isPending ? (locale === "vi" ? "Đang chạy" : "Running") : locale === "vi" ? "Chạy automation" : "Run automation"}
              </button>
            </div>
          </header>

          {statusMessage && <div className="form-alert form-alert--error">{statusMessage}</div>}

          <section className="template-playbook" aria-label={locale === "vi" ? "Quy trình dùng mẫu" : "Template workflow"}>
            {[
              [locale === "vi" ? "Chọn mẫu" : "Pick", locale === "vi" ? "Roadmap, sprint hoặc release plan." : "Roadmap, sprint, or release plan."],
              [locale === "vi" ? "Sinh workspace" : "Generate", locale === "vi" ? "Tạo project và phase riêng cho tài khoản." : "Create an isolated project and phase set."],
              [locale === "vi" ? "Theo dõi Gantt" : "Track", locale === "vi" ? "Mở Gantt để quản lý phụ thuộc, rủi ro và tiến độ." : "Open Gantt for dependencies, risk, and progress."],
            ].map(([title, description], index) => (
              <div className="template-playbook__step" key={title}>
                <span>{index + 1}</span>
                <strong>{title}</strong>
                <small>{description}</small>
              </div>
            ))}
          </section>

          <section className="template-grid">
            {isLoading
              ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="template-card"><div className="skeleton" /></div>)
              : templates?.map((template) => {
                  const parsed = JSON.parse(template.template_json) as { phases?: string[]; default_duration_days?: number };
                  return (
                    <article className="template-card" key={template.id}>
                      <div className="template-card__top">
                        <span className="material-symbols-outlined">dashboard_customize</span>
                        <span className="badge badge--unlocked">{template.category}</span>
                      </div>
                      <h2>{template.name}</h2>
                      <p>{template.description}</p>
                      <div className="template-card__phases">
                        {(parsed.phases || []).map((phase) => <span key={phase}>{phase}</span>)}
                      </div>
                      <div className="template-card__footer">
                        <small>{parsed.default_duration_days || 0} {locale === "vi" ? "ngày mặc định" : "default days"}</small>
                        <button className="btn btn--outline" type="button" onClick={() => handleUseTemplate(template.id)} disabled={activeTemplateId === template.id}>
                          <span className="material-symbols-outlined">add_task</span>
                          {activeTemplateId === template.id ? (locale === "vi" ? "Đang tạo" : "Creating") : locale === "vi" ? "Tạo project" : "Create project"}
                        </button>
                      </div>
                    </article>
                  );
                })}
          </section>
        </div>
      </main>
    </>
  );
}
