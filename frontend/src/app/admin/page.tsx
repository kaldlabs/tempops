/**
 * Admin User Management Dashboard.
 * Admin-only page with CRUD capabilities for user accounts.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n";
import type { User, UserAdminSummary } from "@/types";
import TopNav from "@/components/layout/TopNav";

export default function AdminPage() {
  const { t } = useT();
  const [users, setUsers] = useState<UserAdminSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Edit / Delete confirmation states
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.users.summary();
      setUsers(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to fetch users list."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);

    try {
      await api.users.create({
        username: newUsername,
        email: newEmail,
        password: newPassword,
      });
      // Clear forms
      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      setCreateModalOpen(false);
      // Reload user list
      loadUsers();
    } catch (err: unknown) {
      setCreateError(getErrorMessage(err, "Failed to create user."));
    } finally {
      setCreating(false);
    }
  };

  const handleToggleRole = async (user: User) => {
    const nextRole = user.role === "admin" ? "user" : "admin";
    try {
      await api.users.update(user.id, { role: nextRole });
      // Update locally
      setUsers(prev =>
        prev.map(u => (u.id === user.id ? { ...u, role: nextRole } : u))
      );
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Failed to toggle role."));
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    setDeleting(true);

    try {
      await api.users.delete(deleteConfirmUser.id);
      setUsers(prev => prev.filter(u => u.id !== deleteConfirmUser.id));
      setDeleteConfirmUser(null);
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Failed to delete user."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <TopNav />
      <main className="main-content admin-shell">
        <div className="admin-hero">
          <div>
            <p className="calendar-hero__eyebrow">Admin Console</p>
            <h1 className="text-headline-lg" style={{ fontWeight: 800, letterSpacing: 0 }}>
              {t.adminTitle}
            </h1>
            <p className="admin-hero__subtitle">
              {t.adminSubtitle} Admin can inspect each member workspace and open their projects directly.
            </p>
          </div>

          <div className="admin-hero__actions">
            <Link className="btn btn--outline" href="/projects">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>folder_open</span>
              {t.projects}
            </Link>
            <Link className="btn btn--outline" href="/reports">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>monitoring</span>
              {t.reports}
            </Link>
            <button className="btn btn--primary" onClick={() => setCreateModalOpen(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              Add User
            </button>
          </div>
        </div>

        <section className="admin-metrics">
          <div className="admin-metric">
            <span className="material-symbols-outlined">group</span>
            <strong>{users.length}</strong>
            <small>Total accounts</small>
          </div>
          <div className="admin-metric">
            <span className="material-symbols-outlined">folder_managed</span>
            <strong>{users.reduce((sum, user) => sum + user.project_count, 0)}</strong>
            <small>Isolated projects</small>
          </div>
          <div className="admin-metric">
            <span className="material-symbols-outlined">task_alt</span>
            <strong>{users.reduce((sum, user) => sum + user.task_count, 0)}</strong>
            <small>Stored tasks</small>
          </div>
          <div className="admin-metric">
            <span className="material-symbols-outlined">database</span>
            <strong>{users.filter((user) => user.project_count > 0 || user.task_count > 0).length}</strong>
            <small>Active environments</small>
          </div>
        </section>

        {error && (
          <div
            style={{
              background: "var(--error-container)",
              color: "var(--on-error-container)",
              padding: "12px 16px",
              borderRadius: "var(--radius-lg)",
              marginBottom: 20,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div className="admin-table-card">
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--on-surface-variant)" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "2px solid var(--outline-variant)",
                  borderTopColor: "var(--secondary)",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 12px",
                }}
              />
              Loading user accounts...
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--on-surface-variant)" }}>
              No users found.
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Workspace</th>
                  <th>Owned projects</th>
                  <th>Tasks</th>
                  <th>Notifications</th>
                  <th>Last activity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="admin-user-cell">
                        <span className="avatar avatar--blue">{u.username.slice(0, 2).toUpperCase()}</span>
                        <span>
                          <strong>@{u.username}</strong>
                          <small>{u.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${u.role === "admin" ? "badge--overdue" : "badge--todo"}`}
                        style={{ textTransform: "uppercase", fontSize: 10 }}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-env-pill ${u.project_count || u.task_count ? "admin-env-pill--active" : ""}`}>
                        <span className="material-symbols-outlined">database</span>
                        {u.project_count || u.task_count ? "Dedicated active store" : "Dedicated empty store"}
                      </span>
                    </td>
                    <td>
                      {u.projects.length ? (
                        <div className="admin-project-list">
                          {u.projects.map((project) => (
                            <Link className="admin-project-link" href={`/projects/${project.id}`} key={project.id}>
                              <span>
                                <strong>{project.name}</strong>
                                <small>{project.task_count} tasks · {project.progress}% complete</small>
                              </span>
                              <span className="material-symbols-outlined">arrow_forward</span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <span className="admin-empty-state">No projects yet</span>
                      )}
                    </td>
                    <td>{u.task_count}</td>
                    <td>{u.notification_count}</td>
                    <td>
                      {new Date(u.created_at).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })}
                      {u.latest_project_at && (
                        <small className="admin-table__sub">
                          Project updated {new Date(u.latest_project_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                        </small>
                      )}
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          className="btn btn--outline"
                          onClick={() => handleToggleRole(u)}
                          style={{ padding: "4px 8px", fontSize: 11 }}
                          title={`Switch to ${u.role === "admin" ? "user" : "admin"}`}
                        >
                          Toggle Role
                        </button>
                        <button className="btn btn--outline" onClick={() => setDeleteConfirmUser(u)} style={{ padding: "4px 8px", fontSize: 11, color: "var(--error)", borderColor: "rgba(186, 26, 26, 0.2)" }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── CREATE USER MODAL ────────────────────────────────────── */}
        {createModalOpen && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              className="card animate-fade-in"
              style={{
                width: "100%",
                maxWidth: 400,
                background: "var(--surface-container)",
                boxShadow: "var(--shadow-lg)",
                padding: 24,
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Create User Account</h3>
              {createError && (
                <div
                  style={{
                    background: "var(--error-container)",
                    color: "var(--on-error-container)",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-default)",
                    fontSize: 12,
                    marginBottom: 16,
                  }}
                >
                  {createError}
                </div>
              )}
              <form onSubmit={handleCreateUser} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="input-label" htmlFor="new-username">Username</label>
                  <input
                    id="new-username"
                    type="text"
                    className="input"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor="new-email">Email Address</label>
                  <input
                    id="new-email"
                    type="email"
                    className="input"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor="new-password">Password</label>
                  <input
                    id="new-password"
                    type="password"
                    className="input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
                  <button type="button" className="btn btn--outline" onClick={() => setCreateModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn--primary" disabled={creating}>
                    {creating ? "Creating..." : "Create Account"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── DELETE CONFIRMATION MODAL ─────────────────────────────── */}
        {deleteConfirmUser && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              className="card animate-fade-in"
              style={{
                width: "100%",
                maxWidth: 360,
                background: "var(--surface-container)",
                boxShadow: "var(--shadow-lg)",
                padding: 24,
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--error)", marginBottom: 12 }}>
                Delete User Account?
              </h3>
              <p style={{ color: "var(--on-surface-variant)", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
                Are you sure you want to delete the user account for <strong>@{deleteConfirmUser.username}</strong>?
                This action is permanent and cannot be undone.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button className="btn btn--outline" onClick={() => setDeleteConfirmUser(null)} disabled={deleting}>
                  Cancel
                </button>
                <button className="btn btn--primary" onClick={handleDeleteUser} style={{ background: "var(--error)" }} disabled={deleting}>
                  {deleting ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
