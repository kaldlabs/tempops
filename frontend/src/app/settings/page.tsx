"use client";

import TopNav from "@/components/layout/TopNav";
import { useAuthStore } from "@/store/use-auth-store";

export default function SettingsPage() {
  const { user, logout } = useAuthStore();

  return (
    <>
      <TopNav />
      <main className="main-content">
        <div className="dashboard">
          <header className="dashboard__header">
            <h1 className="dashboard__title">Settings</h1>
            <p className="dashboard__subtitle">Account and session details.</p>
          </header>
          <div className="card settings-panel">
            <div className="settings-panel__avatar">{user?.username.slice(0, 2).toUpperCase()}</div>
            <div>
              <h2>{user?.username}</h2>
              <p>{user?.email}</p>
              <span className={`badge ${user?.role === "admin" ? "badge--overdue" : "badge--todo"}`}>{user?.role}</span>
            </div>
            <button className="btn btn--outline btn--danger" onClick={logout}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
              Log Out
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
