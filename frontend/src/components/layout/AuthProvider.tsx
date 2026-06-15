/**
 * Authentication Route Guard and Provider.
 * Enforces session verification, protected routes, and role-based access control.
 */
"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/use-auth-store";

import SideNav from "@/components/layout/SideNav";

const PUBLIC_ROUTES = ["/login", "/register"];
const ADMIN_ROUTES = ["/admin"];

export default function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, fetchMe } = useAuthStore();

  useEffect(() => {
    // Verify session from HttpOnly cookies on mount
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (isLoading) return;

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
    const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route));

    if (!isAuthenticated) {
      // Not logged in: redirect to login if attempting to access protected route
      if (!isPublicRoute) {
        router.push("/login");
      }
    } else {
      // Logged in: redirect to dashboard if trying to access login/register
      if (isPublicRoute) {
        router.push("/");
      }
      // Enforce RBAC: redirect non-admin away from admin panel
      if (isAdminRoute && user?.role !== "admin") {
        router.push("/");
      }
    }
  }, [isAuthenticated, user, isLoading, pathname, router]);

  // Handle route protection loading state to avoid layout flashes
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          width: "100vw",
          background: "linear-gradient(135deg, var(--surface-container-low) 0%, var(--surface) 100%)",
          color: "var(--on-surface)",
          fontFamily: "var(--font-geist-sans), sans-serif",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--radius-full)",
            border: "3px solid var(--outline-variant)",
            borderTopColor: "var(--secondary)",
            animation: "spin 1s linear infinite",
          }}
        />
        <style jsx global>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <span style={{ fontSize: 13, color: "var(--on-surface-variant)", fontWeight: 500 }}>
          Initializing tempops...
        </span>
      </div>
    );
  }

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route));

  // If not logged in and on protected route, or logged in and on public route,
  // do not render the children to prevent layout flashes during redirects.
  if (!isAuthenticated && !isPublicRoute) {
    return null;
  }
  if (isAuthenticated && isPublicRoute) {
    return null;
  }
  if (isAuthenticated && isAdminRoute && user?.role !== "admin") {
    return null;
  }

  // Wrap layouts differently based on route category
  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <div className="app-layout">
      <SideNav />
      {children}
    </div>
  );
}
