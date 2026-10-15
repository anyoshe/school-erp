"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getToken } from "@/utils/auth";
import { CurrentSchoolProvider } from "@/contexts/CurrentSchoolContext";
import Sidebar from "./components/layout/Sidebar";
import Navbar from "./components/layout/Navbar";

/**
 * Dashboard chrome is identical on server and client (no token/window branches).
 * Auth redirect runs only after mount in useEffect.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading, mounted } = useCurrentUser();

  useEffect(() => {
    if (!mounted || loading) return;
    if (!getToken() && !user) {
      router.replace("/login");
    }
  }, [mounted, loading, user, router]);

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
    <div
      className="flex h-screen bg-background overflow-hidden"
      suppressHydrationWarning
    >
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
          <Sidebar isCollapsed={false} onToggleCollapse={() => setMobileSidebarOpen(false)} />
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

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
