"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { CurrentSchoolProvider } from "@/contexts/CurrentSchoolContext";
import Sidebar from "./components/layout/Sidebar";
import Navbar from "./components/layout/Navbar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Only show full-page spinner on the very first auth check (no cached user yet).
  // Once we have a user, keep the shell mounted so navigation feels instant.
  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-5 mx-auto" />
          <p className="text-base font-medium text-textPrimary">Loading dashboard...</p>
          <p className="text-sm text-textMuted mt-1">Preparing your space</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <CurrentSchoolProvider>
      <InnerDashboardLayout>{children}</InnerDashboardLayout>
    </CurrentSchoolProvider>
  );
}

function InnerDashboardLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar – stays mounted during navigation */}
      <aside
        className={`
          hidden lg:flex flex-col fixed inset-y-0 left-0 z-30
          transition-all duration-300 ease-in-out bg-white border-r border-border shadow-sm
          ${sidebarOpen ? "w-[280px]" : "w-20"}
        `}
      >
        <Sidebar
          isCollapsed={!sidebarOpen}
          onToggleCollapse={() => setSidebarOpen(!sidebarOpen)}
        />
      </aside>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      {mobileSidebarOpen && (
        <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] bg-white shadow-2xl">
          <Sidebar isCollapsed={false} onToggleCollapse={() => setMobileSidebarOpen(false)} />
        </aside>
      )}

      {/* Main column */}
      <div
        className={`
          flex-1 flex flex-col min-w-0
          lg:transition-all lg:duration-300 lg:ease-in-out
          ${sidebarOpen ? "lg:ml-[280px]" : "lg:ml-20"}
        `}
      >
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-border shadow-sm">
          <Navbar
            onMenuClick={() => setMobileSidebarOpen(true)}
            onDesktopSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
            isDesktopSidebarOpen={sidebarOpen}
          />
        </header>

        {/* Only this area changes / shows loading on navigation */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
