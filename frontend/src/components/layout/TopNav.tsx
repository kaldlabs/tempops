"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AIAssistant from "@/components/ai/AIAssistant";
import { useT } from "@/lib/i18n";
import { useGanttStore } from "@/store/use-gantt-store";
import { useAuthStore } from "@/store/use-auth-store";
import { useLocaleStore } from "@/store/use-locale-store";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useGlobalSearch, useMarkNotificationRead, useNotifications, useProjects } from "@/hooks/use-gantt-mutations";

interface TopNavProps {
  projectName?: string;
  projectId?: string;
}

export default function TopNav({ projectName, projectId }: TopNavProps) {
  const router = useRouter();
  const { t, locale } = useT();
  const toggleLocale = useLocaleStore((s) => s.toggleLocale);
  const { setNewTaskModalOpen, searchQuery, setSearchQuery } = useGanttStore();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);
  const { data: notifications } = useNotifications();
  const { data: projects } = useProjects();
  const markNotificationRead = useMarkNotificationRead();
  const { data: searchResults } = useGlobalSearch(searchQuery);
  const unreadCount = notifications?.filter((item) => !item.is_read).length || 0;

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!notifRef.current?.contains(target)) setNotifOpen(false);
      if (!userMenuRef.current?.contains(target)) setDropdownOpen(false);
      if (!searchRef.current?.contains(target)) setSearchOpen(false);
      if (!projectRef.current?.contains(target)) setProjectOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const toggleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
  };

  const userInitials = user?.username ? user.username.slice(0, 2).toUpperCase() : "TF";

  return (
    <header className="top-nav">
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        <Link href="/" className="top-nav__brand" style={{ textDecoration: "none" }}>
          <Image src="/tempops-logo.svg" alt="" className="top-nav__brand-mark" width={28} height={28} priority />
          <span>tempops</span>
        </Link>
        {projectName && (
          <div className="top-nav__context" ref={projectRef}>
            <button className="project-selector" type="button" onClick={() => setProjectOpen((value) => !value)}>
              <span className="project-selector__dot" />
              <span>{projectName}</span>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--on-surface-variant)" }}>
                expand_more
              </span>
            </button>
            {projectOpen && (
              <div className="project-selector__menu animate-fade-in">
                {projects?.length ? projects.map((project) => (
                  <button
                    key={project.id}
                    className={`project-selector__item ${project.id === projectId ? "project-selector__item--active" : ""}`}
                    type="button"
                    onClick={() => {
                      setProjectOpen(false);
                      if (project.id !== projectId) router.push(`/projects/${project.id}`);
                    }}
                  >
                    <span className="project-selector__dot" />
                    <span>
                      <strong>{project.name}</strong>
                      <small>{project.task_count} {locale === "vi" ? "công việc" : "tasks"} · {project.progress}%</small>
                    </span>
                  </button>
                )) : (
                  <div className="project-selector__empty">{locale === "vi" ? "Chưa có dự án." : "No projects yet."}</div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="top-nav__search" ref={searchRef}>
            <span className="top-nav__search-icon material-symbols-outlined">search</span>
            <input
              className="top-nav__search-input"
              type="search"
              placeholder={projectName ? (locale === "vi" ? "Tìm công việc..." : "Filter tasks...") : (locale === "vi" ? "Tìm dự án, task, template..." : "Search projects, tasks, templates...")}
              aria-label={locale === "vi" ? "Tìm kiếm toàn cục" : "Global search"}
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
            />
            {searchOpen && searchQuery.trim().length >= 2 && (
              <div className="top-nav__search-results">
                {searchResults?.results.length ? (
                  searchResults.results.slice(0, 8).map((result) => (
                    <Link key={`${result.type}-${result.id}`} href={result.href} className="top-nav__search-result" onClick={() => setSearchOpen(false)}>
                      <span className="material-symbols-outlined">
                        {result.type === "project" ? "folder_open" : result.type === "template" ? "dashboard_customize" : "task_alt"}
                      </span>
                      <span>
                        <strong>{result.title}</strong>
                        <small>{result.type} {result.subtitle ? `· ${result.subtitle}` : ""}</small>
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="top-nav__search-empty">{locale === "vi" ? "Không có kết quả phù hợp." : "No matching results."}</div>
                )}
              </div>
            )}
          </div>
      </div>
      <div className="top-nav__actions" style={{ position: "relative" }}>
        {projectName && (
          <button
            className="btn btn--primary"
            onClick={() => setNewTaskModalOpen(true)}
            id="btn-new-task"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            {t.newTask}
          </button>
        )}
        <AIAssistant projectId={projectId} />
        <button className="btn btn--ghost" onClick={toggleLocale} aria-label={t.language}>
          {locale.toUpperCase()}
        </button>
        <button className="btn btn--ghost" onClick={toggleTheme} aria-label="Toggle theme">
          <span className="material-symbols-outlined">
            {theme === "light" ? "light_mode" : theme === "dark" ? "dark_mode" : "contrast"}
          </span>
        </button>
        <div style={{ position: "relative" }} ref={notifRef}>
          <button className="btn btn--ghost" onClick={() => { setNotifOpen(!notifOpen); setDropdownOpen(false); }} aria-label="Notifications">
            <span className="material-symbols-outlined">notifications</span>
            {unreadCount > 0 && <span className="top-nav__notification-dot">{unreadCount}</span>}
          </button>
          
          {notifOpen && (
            <div className="top-nav__popover top-nav__notifications animate-fade-in">
              <div className="top-nav__popover-header">
                <strong>{locale === "vi" ? "Thông báo" : "Notifications"}</strong>
                <small>{unreadCount} {locale === "vi" ? "chưa đọc" : "unread"}</small>
              </div>
              {notifications?.length ? notifications.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  className={`notification-item ${item.is_read ? "" : "notification-item--unread"}`}
                  type="button"
                  onClick={() => markNotificationRead.mutate(item.id)}
                >
                  <span className="notification-item__dot" />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.message}</small>
                  </span>
                </button>
              )) : (
                <div className="top-nav__search-empty">{locale === "vi" ? "Chưa có thông báo." : "No notifications yet."}</div>
              )}
            </div>
          )}
        </div>
        
        {/* User Profile Dropdown */}
        <div style={{ position: "relative" }} ref={userMenuRef}>
          <button
            className="avatar avatar--blue"
            onClick={() => { setDropdownOpen(!dropdownOpen); setNotifOpen(false); }}
            style={{ border: "none", cursor: "pointer", outline: "none" }}
            aria-label="User profile"
          >
            {userInitials}
          </button>
          
          {dropdownOpen && (
            <div
              className="card animate-fade-in"
              style={{
                position: "absolute",
                top: 40,
                right: 0,
                width: 220,
                background: "color-mix(in srgb, var(--surface) 95%, transparent)",
                backdropFilter: "blur(8px)",
                border: "1px solid var(--outline-variant)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-lg)",
                padding: "16px 12px",
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--on-surface)" }}>
                  @{user?.username}
                </div>
                <div style={{ fontSize: 11, color: "var(--on-surface-variant)", marginTop: 2 }}>
                  {user?.email}
                </div>
                <div
                  style={{
                    display: "inline-block",
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    background: user?.role === "admin" ? "var(--error-container)" : "var(--primary-fixed)",
                    color: user?.role === "admin" ? "var(--on-error-container)" : "var(--primary-container)",
                    padding: "2px 6px",
                    borderRadius: "var(--radius-sm)",
                    marginTop: 6,
                  }}
                >
                  {user?.role}
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--outline-variant)" }} />

              {user?.role === "admin" && (
                <Link
                  href="/admin"
                  className="btn btn--outline"
                  onClick={() => setDropdownOpen(false)}
                  style={{ justifyContent: "flex-start", width: "100%", border: "none", padding: "6px 8px" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>admin_panel_settings</span>
                  {t.admin}
                </Link>
              )}

              <button
                className="btn btn--outline"
                onClick={handleLogout}
                style={{
                  justifyContent: "flex-start",
                  width: "100%",
                  color: "var(--error)",
                  border: "none",
                  padding: "6px 8px",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
                {locale === "vi" ? "Đăng xuất" : "Log Out"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
