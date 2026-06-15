"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useAuthStore } from "@/store/use-auth-store";
import { useLocaleStore } from "@/store/use-locale-store";

export default function LoginPage() {
  const router = useRouter();
  const { t, locale } = useT();
  const { theme, setTheme } = useTheme();
  const toggleLocale = useLocaleStore((s) => s.toggleLocale);
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ username, password });
      router.push("/");
    } catch (err: unknown) {
      const fallback =
        locale === "vi"
          ? "Tài khoản hoặc mật khẩu chưa khớp. Vui lòng kiểm tra lại thông tin đăng nhập."
          : "Username or password does not match. Please check your credentials and try again.";
      const rawMessage = getErrorMessage(err, fallback);
      setError(rawMessage.toLowerCase().includes("invalid") ? fallback : rawMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const clearLoginError = () => {
    if (error) setError(null);
  };

  const toggleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-card">
          <div className="login-card__topbar">
            <Link href="/" className="top-nav__brand">
              <Image src="/tempops-logo.svg" alt="" width={32} height={32} />
              <span>tempops</span>
            </Link>
            <div className="login-card__actions">
              <button className="btn btn--outline login-language" onClick={toggleLocale} type="button">
                {locale.toUpperCase()}
              </button>
              <button
                className="btn btn--outline login-language login-theme-toggle"
                onClick={toggleTheme}
                type="button"
                aria-label={locale === "vi" ? "Đổi giao diện" : "Change theme"}
              >
                <span className="material-symbols-outlined">
                  {theme === "light" ? "light_mode" : theme === "dark" ? "dark_mode" : "contrast"}
                </span>
              </button>
            </div>
          </div>

          <div className="login-copy">
            <p className="login-kicker">tempops Gantt</p>
            <h1>{t.loginTitle}</h1>
            <p>{t.loginSubtitle}</p>
          </div>

          {error && (
            <div className="form-alert form-alert--error login-error" role="alert" aria-live="assertive">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="form-stack login-form">
            <div>
              <label className="input-label" htmlFor="username">{t.username}</label>
              <div className="login-input-wrap">
                <span className="material-symbols-outlined">account_circle</span>
                <input
                  id="username"
                  type="text"
                  className={`input ${error ? "input--error" : ""}`}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    clearLoginError();
                  }}
                  required
                  autoFocus
                  autoComplete="username"
                  aria-invalid={!!error}
                  aria-describedby={error ? "login-credential-error" : undefined}
                />
              </div>
            </div>
            <div>
              <label className="input-label" htmlFor="password">{t.password}</label>
              <div className="login-input-wrap">
                <span className="material-symbols-outlined">lock</span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className={`input ${error ? "input--error" : ""}`}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearLoginError();
                  }}
                  required
                  autoComplete="current-password"
                  aria-invalid={!!error}
                  aria-describedby={error ? "login-credential-error" : undefined}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              {error && (
                <p className="field-error" id="login-credential-error">
                  {locale === "vi"
                    ? "Hãy kiểm tra lại tên đăng nhập và mật khẩu. Hệ thống không tiết lộ trường nào sai để bảo vệ tài khoản."
                    : "Check both username and password. For account safety, tempops does not reveal which field is incorrect."}
                </p>
              )}
            </div>
            <button type="submit" className="btn btn--primary login-submit" disabled={submitting}>
              <span className="material-symbols-outlined">{submitting ? "progress_activity" : "login"}</span>
              {submitting ? t.signingIn : t.signIn}
            </button>
          </form>

          <div className="login-sso-disabled">
            <span className="material-symbols-outlined">verified_user</span>
            <span>
              {locale === "vi"
                ? "Đăng nhập Google sẽ khả dụng sau khi cấu hình OAuth."
                : "Google SSO unlocks after OAuth setup."}
            </span>
          </div>

          <div className="login-footer">
            {locale === "vi" ? "Chưa có tài khoản?" : "Don't have an account?"}{" "}
            <Link href="/register">{t.createAccount}</Link>
          </div>
        </div>
      </section>

      <section className="login-visual" aria-hidden="true">
        <div className="login-visual__content">
          <p className="login-kicker login-kicker--dark">Multiplayer planning</p>
          <h2>
            {locale === "vi"
              ? "Dự báo trễ hạn trước khi dự án lệch nhịp."
              : "Predict project delays before they happen."}
          </h2>
          <p>
            {locale === "vi"
              ? "Gantt, phụ thuộc, tải nguồn lực và tín hiệu rủi ro được gom lại để đội ngũ ra quyết định sớm hơn."
              : "Gantt, dependencies, workload, and risk signals stay together so teams can act earlier."}
          </p>
        </div>

        <div className="login-product-preview">
          <div className="login-preview__header">
            <div>
              <span>Q3 Release</span>
              <strong>68%</strong>
            </div>
            <div className="login-preview__status">Live</div>
          </div>
          <div className="login-preview__metrics">
            <div><strong>21</strong><span>Tasks</span></div>
            <div><strong>10</strong><span>Links</span></div>
            <div><strong>4</strong><span>Risks</span></div>
          </div>
          <div className="login-mini-board">
            {[
              ["Foundation", "18%", "58%"],
              ["Realtime", "34%", "42%"],
              ["AI queue", "52%", "28%"],
              ["Release", "70%", "20%"],
            ].map(([label, left, width]) => (
              <div key={label} className="login-mini-row">
                <span>{label}</span>
                <div className="login-mini-track">
                  <div className="login-mini-bar" style={{ marginLeft: left, width }} />
                </div>
              </div>
            ))}
          </div>
          <div className="login-preview__insight">
            <span className="material-symbols-outlined">query_stats</span>
            <p>
              {locale === "vi"
                ? "ML phát hiện 2 công việc có nguy cơ trễ hạn."
                : "ML detected 2 tasks trending late."}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
