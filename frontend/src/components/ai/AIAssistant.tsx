"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n";

interface AIAssistantProps {
  projectId?: string;
}

export default function AIAssistant({ projectId }: AIAssistantProps) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const job = await api.ai.createJob({ prompt, project_id: projectId || null });
      setStatus(
        locale === "vi"
          ? `Yêu cầu ${job.job_id.slice(0, 8)} đã được đưa vào hàng chờ.`
          : `Job ${job.job_id.slice(0, 8)} · ${job.status}. ${job.message}`
      );
      setPrompt("");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "AI assistant is unavailable."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button className="btn btn--outline" onClick={() => setOpen(true)}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>auto_awesome</span>
        {t.aiAssistant}
      </button>
      {open && (
        <div className="ai-drawer" role="dialog" aria-modal="true">
          <div className="ai-drawer__header">
            <div>
              <h2>{t.aiAssistant}</h2>
              <p>
                {locale === "vi"
                  ? "Tạo bản nháp kế hoạch, chia nhỏ phạm vi công việc và chuẩn bị dữ liệu cho Gantt."
                  : "Draft planning structures, split scope, and prepare Gantt-ready data."}
              </p>
            </div>
            <button className="btn btn--ghost" onClick={() => setOpen(false)} aria-label="Close AI assistant">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          {error && <div className="form-alert form-alert--error">{error}</div>}
          {status && <div className="form-alert form-alert--info">{status}</div>}
          <form className="form-stack" onSubmit={submit}>
            <label className="input-label" htmlFor="ai-prompt">
              {locale === "vi" ? "Yêu cầu" : "Prompt"}
            </label>
            <textarea
              id="ai-prompt"
              className="textarea ai-drawer__textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={locale === "vi" ? "Ví dụ: Lập kế hoạch ra mắt sản phẩm trong 6 tuần..." : "Draft a launch roadmap, split this feature into WBS tasks..."}
              required
            />
            <button className="btn btn--primary" type="submit" disabled={submitting}>
              {submitting
                ? locale === "vi" ? "Đang xử lý..." : "Queueing..."
                : locale === "vi" ? "Tạo bản nháp" : "Queue AI Job"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
