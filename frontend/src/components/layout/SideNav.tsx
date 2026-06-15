"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/use-auth-store";
import { useProjects } from "@/hooks/use-gantt-mutations";
import { useT } from "@/lib/i18n";

export default function SideNav() {
  const pathname = usePathname();
  const { t } = useT();
  const { user } = useAuthStore();
  const { data: projects } = useProjects();
  const firstProjectHref = projects?.[0] ? `/projects/${projects[0].id}` : "/projects";

  const navItems: Array<{ href: string; icon: string; label: string }> = [
    { href: "/", icon: "dashboard", label: t.dashboard },
    { href: "/projects", icon: "folder_open", label: t.projects },
    { href: firstProjectHref, icon: "waterfall_chart", label: t.gantt },
    { href: "/calendar", icon: "calendar_today", label: t.calendar },
    { href: "/reports", icon: "bar_chart", label: t.reports },
    { href: "/integrations", icon: "hub", label: t.integrations },
    { href: "/templates", icon: "dashboard_customize", label: t.templates },
  ];
  if (user?.role === "admin") {
    navItems.push({ href: "/admin", icon: "admin_panel_settings", label: t.admin });
  }

  return (
    <nav className="side-nav" aria-label="Main navigation">
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flexGrow: 1 }}>
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || (item.href !== "/projects" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`side-nav__item ${isActive ? "side-nav__item--active" : ""}`}
            >
              <span
                className="side-nav__item-icon material-symbols-outlined"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span className="side-nav__item-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="side-nav__spacer" />
      <Link href="/settings" className={`side-nav__item ${pathname === "/settings" ? "side-nav__item--active" : ""}`} style={{ marginBottom: 16 }}>
        <span className="side-nav__item-icon material-symbols-outlined">settings</span>
        <span className="side-nav__item-label">{t.settings}</span>
      </Link>
    </nav>
  );
}
