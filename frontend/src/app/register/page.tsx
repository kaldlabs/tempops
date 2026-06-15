/**
 * Registration Page — matches login two-panel layout with animations.
 */
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/store/use-auth-store";

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await register({ username, email, password });
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to register account."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      {/* Left — register form */}
      <section className="login-panel">
        <div className="login-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
            <Link href="/" className="top-nav__brand">
              <Image src="/tempops-logo.svg" alt="" width={30} height={30} />
              <span>tempops</span>
            </Link>
          </div>

          <h1 className="text-headline-lg" style={{ fontWeight: 800, marginBottom: 8 }}>
            Create Account
          </h1>
          <p style={{ color: "var(--on-surface-variant)", fontSize: 13, marginBottom: 28 }}>
            Join tempops to plan and track tasks effortlessly.
          </p>

          {success && (
            <div className="form-alert" style={{
              background: "#d1fae5",
              color: "#065f46",
              border: "1px solid rgba(47,143,70,0.2)",
              marginBottom: 20,
            }}>
              Account created! Redirecting to login…
            </div>
          )}

          {error && <div className="form-alert form-alert--error" style={{ marginBottom: 16 }}>{error}</div>}

          <form onSubmit={handleSubmit} className="form-stack">
            <div>
              <label className="input-label" htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Pick a username"
                minLength={3}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="input-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="input-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn--primary"
              style={{ height: 42 }}
              disabled={submitting || success}
            >
              {submitting ? "Creating account…" : "Sign Up"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", margin: "24px 0", color: "var(--outline)" }}>
            <div style={{ flex: 1, height: 1, background: "var(--outline)" }} />
            <span style={{ padding: "0 12px", fontSize: 12, color: "var(--on-surface-variant)" }}>
              OR
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--outline)" }} />
          </div>

          <a 
            href={process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/auth/google/login` : "/api/v1/auth/google/login"}
            className="btn btn--outline" 
            style={{ width: "100%", height: 42, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </a>

          <div style={{ marginTop: 22, fontSize: 12, color: "var(--on-surface-variant)" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--secondary)", fontWeight: 700, textDecoration: "none" }}>
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Right — animated visual panel */}
      <section className="login-visual" aria-hidden="true">
        <div className="login-visual-orb login-visual-orb--1" />
        <div className="login-visual-orb login-visual-orb--2" />
        <div className="login-visual-orb login-visual-orb--3" />
        <div className="login-visual__content">
          <p className="text-label-md" style={{ color: "rgba(255,255,255,0.55)", marginBottom: 22, letterSpacing: "0.12em" }}>
            GET STARTED
          </p>
          <h2>Plan smarter,<br />ship faster.</h2>
          <p>
            Visualise your entire roadmap, assign tasks, and watch progress
            unfold in real-time—all in one collaborative workspace.
          </p>
        </div>
        <div className="login-mini-board">
          {[
            ["Design",    "88%"],
            ["Dev sprint","66%"],
            ["QA review", "40%"],
            ["Deploy",    "20%"],
          ].map(([label, width]) => (
            <div key={label} className="login-mini-row">
              <span>{label}</span>
              <div className="login-mini-bar" style={{ width }} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
