"use client";

import { useMemo, useState } from "react";
import TopNav from "@/components/layout/TopNav";
import {
  useConnectIntegration,
  useDisconnectIntegration,
  useIntegrations,
  useSyncIntegration,
} from "@/hooks/use-gantt-mutations";
import { getErrorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n";

const PROVIDER_ICONS: Record<string, string> = {
  notion: "article",
  trello: "view_kanban",
  confluence: "menu_book",
  jira: "bug_report",
  google_calendar: "calendar_month",
  github: "code_blocks",
};

export default function IntegrationsPage() {
  const { locale, t } = useT();
  const { data, isLoading, error } = useIntegrations();
  const connectIntegration = useConnectIntegration();
  const syncIntegration = useSyncIntegration();
  const disconnectIntegration = useDisconnectIntegration();
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const connections = useMemo(() => {
    return new Map((data?.connections || []).map((connection) => [connection.provider, connection]));
  }, [data?.connections]);
  const connectedCount = connections.size;
  const readyCount = (data?.connections || []).filter((connection) => connection.status === "ready").length;

  const handleConnect = async (provider: string) => {
    setActiveProvider(provider);
    setStatusMessage(null);
    try {
      await connectIntegration.mutateAsync({
        provider,
        sync_mode: "manual",
        external_workspace: `${provider} workspace`,
      });
      setStatusMessage(locale === "vi" ? "Đã tạo cấu hình connector." : "Connector configuration created.");
    } catch (err) {
      setStatusMessage(getErrorMessage(err, locale === "vi" ? "Không thể cấu hình connector." : "Could not configure connector."));
    } finally {
      setActiveProvider(null);
    }
  };

  const handleSync = async (provider: string) => {
    setActiveProvider(provider);
    setStatusMessage(null);
    try {
      const result = await syncIntegration.mutateAsync(provider);
      setStatusMessage(result.message);
    } catch (err) {
      setStatusMessage(getErrorMessage(err, locale === "vi" ? "Không thể kiểm tra đồng bộ." : "Could not run sync check."));
    } finally {
      setActiveProvider(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    setActiveProvider(provider);
    setStatusMessage(null);
    try {
      await disconnectIntegration.mutateAsync(provider);
      setStatusMessage(locale === "vi" ? "Đã ngắt cấu hình connector." : "Connector disconnected.");
    } catch (err) {
      setStatusMessage(getErrorMessage(err, locale === "vi" ? "Không thể ngắt connector." : "Could not disconnect connector."));
    } finally {
      setActiveProvider(null);
    }
  };

  return (
    <>
      <TopNav />
      <main className="main-content">
        <div className="integration-shell">
          <header className="integration-hero">
            <div>
              <p className="calendar-hero__eyebrow">{locale === "vi" ? "Lớp điều phối" : "Orchestration layer"}</p>
              <h1>{t.integrations}</h1>
              <p>
                {locale === "vi"
                  ? "Kết nối Notion, Trello, Confluence, Jira, Calendar và GitHub để tempops trở thành nguồn điều phối timeline, rủi ro, phụ thuộc và tải nguồn lực."
                  : "Connect Notion, Trello, Confluence, Jira, Calendar, and GitHub so tempops becomes the schedule, risk, dependency, and workload control layer."}
              </p>
              <div className="integration-inline-note">
                <span className="material-symbols-outlined">hub</span>
                <strong>{locale === "vi" ? "Không thay thế công cụ hiện có" : "Do not replace existing tools"}</strong>
                <span>
                {locale === "vi"
                  ? "tempops đọc tín hiệu từ công cụ đội nhóm đang dùng, sau đó chuẩn hóa thành Gantt, báo cáo và cảnh báo trễ hạn."
                  : "tempops reads the tools teams already use, then normalizes them into Gantt, reporting, and schedule-risk signals."}
                </span>
              </div>
            </div>
          </header>

          <section className="integration-overview" aria-label={locale === "vi" ? "Tổng quan tích hợp" : "Integration overview"}>
            <div className="integration-overview__metric">
              <span className="material-symbols-outlined">extension</span>
              <strong>{data?.providers.length || 0}</strong>
              <small>{locale === "vi" ? "Connector khả dụng" : "Available connectors"}</small>
            </div>
            <div className="integration-overview__metric">
              <span className="material-symbols-outlined">link</span>
              <strong>{connectedCount}</strong>
              <small>{locale === "vi" ? "Đã cấu hình" : "Configured"}</small>
            </div>
            <div className="integration-overview__metric">
              <span className="material-symbols-outlined">sync_saved_locally</span>
              <strong>{readyCount}</strong>
              <small>{locale === "vi" ? "Sẵn sàng sync" : "Ready to sync"}</small>
            </div>
            <div className="integration-overview__flow">
              {[
                [locale === "vi" ? "Nguồn" : "Sources", "Notion · Trello · Jira"],
                [locale === "vi" ? "Chuẩn hóa" : "Normalize", "Docs · Cards · Issues"],
                [locale === "vi" ? "Điều phối" : "Orchestrate", "Gantt · Risk · Workload"],
              ].map(([label, value], index) => (
                <div key={label} className="integration-flow-step">
                  <span>{index + 1}</span>
                  <strong>{label}</strong>
                  <small>{value}</small>
                </div>
              ))}
            </div>
          </section>

          {(error || statusMessage) && (
            <div className={`form-alert ${error ? "form-alert--error" : "form-alert--info"}`}>
              {error ? getErrorMessage(error, "Could not load integrations.") : statusMessage}
            </div>
          )}

          <section className="integration-grid">
            {isLoading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <div className="integration-card integration-card--loading" key={index}>
                    <div className="skeleton" />
                    <div className="skeleton" />
                    <div className="skeleton" />
                  </div>
                ))
              : data?.providers.map((provider) => {
                  const connection = connections.get(provider.provider);
                  const busy = activeProvider === provider.provider;
                  return (
                    <article className="integration-card" key={provider.provider}>
                      <div className="integration-card__header">
                        <span className="integration-card__icon material-symbols-outlined">
                          {PROVIDER_ICONS[provider.provider] || "extension"}
                        </span>
                        <div>
                          <h2>{provider.name}</h2>
                          <p>{provider.category}</p>
                        </div>
                        <span className={`badge ${connection ? "badge--unlocked" : "badge--todo"}`}>
                          {connection
                            ? connection.status === "ready"
                              ? locale === "vi"
                                ? "Sẵn sàng"
                                : "Ready"
                              : locale === "vi"
                              ? "Đã cấu hình"
                              : "Configured"
                            : locale === "vi"
                            ? "Chưa kết nối"
                            : "Not connected"}
                        </span>
                      </div>

                      <p className="integration-card__description">{provider.description}</p>

                      <div className="integration-card__value">
                        <span>{locale === "vi" ? "tempops làm tốt hơn" : "tempops advantage"}</span>
                        <p>{provider.tempops_advantage}</p>
                      </div>

                      <div className="integration-card__chips">
                        {provider.strengths.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>

                      {connection?.last_sync_summary && (
                        <div className="integration-card__sync">
                          <span className="material-symbols-outlined">sync_saved_locally</span>
                          <p>{connection.last_sync_summary}</p>
                        </div>
                      )}

                      <div className="integration-card__actions">
                        {connection ? (
                          <>
                            <button className="btn btn--primary" type="button" onClick={() => handleSync(provider.provider)} disabled={busy}>
                              <span className="material-symbols-outlined">sync</span>
                              {busy ? (locale === "vi" ? "Đang kiểm tra" : "Checking") : locale === "vi" ? "Kiểm tra sync" : "Check sync"}
                            </button>
                            <button className="btn btn--outline" type="button" onClick={() => handleDisconnect(provider.provider)} disabled={busy}>
                              {locale === "vi" ? "Ngắt" : "Disconnect"}
                            </button>
                          </>
                        ) : (
                          <button className="btn btn--primary" type="button" onClick={() => handleConnect(provider.provider)} disabled={busy}>
                            <span className="material-symbols-outlined">add_link</span>
                            {busy ? (locale === "vi" ? "Đang cấu hình" : "Configuring") : locale === "vi" ? "Tạo connector" : "Create connector"}
                          </button>
                        )}
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
