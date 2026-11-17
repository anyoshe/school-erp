"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getToken } from "@/utils/auth";
import { CurrentSchoolProvider } from "@/contexts/CurrentSchoolContext";
import Sidebar from "./components/layout/Sidebar";
import Navbar from "./components/layout/Navbar";

const PARENT_HOME = "/dashboard/modules/parent";

function roleSet(user: { role?: string; role_codes?: string[] }) {
  const codes = new Set((user.role_codes || []).map((c) => String(c).toUpperCase()));
  const primary = (user.role || "").toUpperCase();
  if (primary) codes.add(primary);
  return codes;
}

const ELEVATED = new Set([
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "DEPUTY_PRINCIPAL",
  "MANAGER",
]);

function isParentUser(user: { role?: string; role_codes?: string[] } | null | undefined) {
  if (!user) return false;
  const codes = roleSet(user);
  if (!codes.has("PARENT")) return false;
  for (const e of ELEVATED) if (codes.has(e)) return false;
  if (codes.has("TEACHER")) return false;
  return true;
}

function isTeacherUser(user: { role?: string; role_codes?: string[] } | null | undefined) {
  if (!user) return false;
  const codes = roleSet(user);
  if (!codes.has("TEACHER") && (user.role || "").toUpperCase() !== "TEACHER") return false;
  for (const e of ELEVATED) if (codes.has(e)) return false;
  if (codes.has("PARENT") && !codes.has("TEACHER")) return false;
  return codes.has("TEACHER") || (user.role || "").toUpperCase() === "TEACHER";
}

function parentAllowedPath(path: string) {
  if (path === PARENT_HOME || path.startsWith(PARENT_HOME + "/")) return true;
  if (path.startsWith("/dashboard/settings/account")) return true;
  if (path.startsWith("/login")) return true;
  return false;
}

const TEACHER_PREFIXES = [
  "/dashboard/modules/students",
  "/dashboard/modules/attendance",
  "/dashboard/modules/library",
  "/dashboard/modules/academics",
];

function teacherAllowedPath(path: string) {
  if (path === "/dashboard" || path === "/dashboard/") return true;
  if (path.startsWith("/dashboard/settings/account")) return true;
  return TEACHER_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

/**
 * Always render the same shell on server and client.
 * Do NOT branch on typeof window / getToken() during render (causes hydration mismatch).
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useCurrentUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || loading) return;
    if (!getToken() && !user) {
      router.replace("/login");
      return;
    }
    if (user && isParentUser(user) && pathname && !parentAllowedPath(pathname)) {
      router.replace(PARENT_HOME);
      return;
    }
    if (user && isTeacherUser(user) && pathname && !teacherAllowedPath(pathname)) {
      router.replace("/dashboard/modules/academics");
    }
  }, [mounted, loading, user, router, pathname]);

  return (
    <CurrentSchoolProvider>
      <DashboardShell>{children}</DashboardShell>
    </CurrentSchoolProvider>
  );
}

function DashboardShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden" suppressHydrationWarning>
      <aside
        className={
          "hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 " +
          "transition-all duration-300 ease-in-out bg-white border-r border-border shadow-sm " +
          (sidebarOpen ? "w-[280px]" : "w-20")
        }
      >
        <Sidebar
          isCollapsed={!sidebarOpen}
          onToggleCollapse={() => setSidebarOpen((v) => !v)}
        />
      </aside>

      {mobileSidebarOpen ? (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      {mobileSidebarOpen ? (
        <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] bg-white shadow-2xl">
          <Sidebar
            isCollapsed={false}
            onToggleCollapse={() => setMobileSidebarOpen(false)}
            onNavigate={() => setMobileSidebarOpen(false)}
          />
        </aside>
      ) : null}

      <div
        className={
          "flex-1 flex flex-col min-w-0 lg:transition-all lg:duration-300 lg:ease-in-out " +
          (sidebarOpen ? "lg:ml-[280px]" : "lg:ml-20")
        }
      >
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-border shadow-sm">
          <Navbar
            onMenuClick={() => setMobileSidebarOpen(true)}
            onDesktopSidebarToggle={() => setSidebarOpen((v) => !v)}
            isDesktopSidebarOpen={sidebarOpen}
          />
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-3 sm:p-6 lg:p-8 max-w-[100vw]">{children}</div>
        </main>
      </div>
    </div>
  );
}
