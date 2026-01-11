"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/utils/api";
import { CurrentSchoolProvider } from "@/contexts/CurrentSchoolContext";
import Sidebar from "./components/layout/Sidebar";
import Navbar from "./components/layout/Navbar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const validateAuth = async () => {
      try {
        console.log("[DashboardLayout] Validating auth...");
        // Force fresh fetch to avoid stale/cached user data
        await getCurrentUser(true);
        console.log("[DashboardLayout] Auth valid → proceed to dashboard");
        setIsAuthenticated(true);
      } catch (error) {
        console.error("[DashboardLayout] Auth failed:", error);
        router.replace("/login");
      } finally {
        setIsLoading(false);
      }
    };

    validateAuth();
  }, [router]);

  // Loading state: show spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50/50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-6 mx-auto" />
          <p className="text-lg font-medium text-gray-700">Loading dashboard...</p>
          <p className="text-sm text-gray-500 mt-2">Preparing your space</p>
        </div>
      </div>
    );
  }

  // Not authenticated → nothing renders (redirect already happened)
  if (!isAuthenticated) {
    return null;
  }

  // Fully authenticated → render protected dashboard layout
  return (
    <CurrentSchoolProvider>
      <InnerDashboardLayout>{children}</InnerDashboardLayout>
    </CurrentSchoolProvider>
  );
}

// Inner layout with sidebar, navbar, and responsive behavior
function InnerDashboardLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`
          hidden lg:flex flex-col fixed inset-y-0 left-0 z-30
          transition-all duration-300 ease-in-out bg-white border-r border-gray-200 shadow-sm
          ${sidebarOpen ? "w-[280px]" : "w-20"}
        `}
      >
        <Sidebar
          isCollapsed={!sidebarOpen}
          onToggleCollapse={() => setSidebarOpen(!sidebarOpen)}
        />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Mobile Sidebar Panel */}
      {mobileSidebarOpen && (
        <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] bg-white shadow-2xl animate-in slide-in-from-left">
          <Sidebar isCollapsed={false} onToggleCollapse={() => setMobileSidebarOpen(false)} />
        </aside>
      )}

      {/* Main Content Area */}
      <div
        className={`
          flex-1 flex flex-col
          lg:transition-all lg:duration-300 lg:ease-in-out
          ${sidebarOpen ? "lg:ml-[280px]" : "lg:ml-20"}
        `}
      >
        {/* Navbar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
          <Navbar
            onMenuClick={() => setMobileSidebarOpen(true)}
            onDesktopSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
            isDesktopSidebarOpen={sidebarOpen}
          />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}