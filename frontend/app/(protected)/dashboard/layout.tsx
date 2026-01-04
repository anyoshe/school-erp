"use client";

import { ReactNode, useState } from "react";
import Sidebar from "./components/layout/Sidebar";
import Navbar from "./components/layout/Navbar";
import { Menu, X } from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        {/* Desktop Sidebar - ZERO left margin/padding, max 20% width */}
        <aside
          className={`
            hidden lg:flex flex-col
            fixed left-0 top-0 bottom-0  /* Sticks to all edges */
            transition-all duration-300 ease-in-out
            bg-white border-r border-gray-200
            ${sidebarOpen ? "lg:w-[20%] lg:max-w-[20%]" : "w-16"}
            overflow-hidden
            z-40  /* Above content if needed */
          `}
        >
          <Sidebar 
            isCollapsed={!sidebarOpen} 
            onToggleCollapse={() => setSidebarOpen(!sidebarOpen)} 
          />
        </aside>

        {/* Mobile Sidebar Drawer */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <aside className="fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Menu</h2>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Sidebar isCollapsed={false} />
              </div>
            </aside>
          </div>
        )}

        {/* Main Content Area - Offset by sidebar width when open */}
        <div 
          className={`
            flex-1 flex flex-col min-w-0
            transition-all duration-300 ease-in-out
            ${sidebarOpen ? "lg:ml-[20%]" : "lg:ml-16"}
          `}
        >
          {/* Navbar */}
          <Navbar
            onMenuClick={() => setMobileSidebarOpen(true)}
            onDesktopSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
            isDesktopSidebarOpen={sidebarOpen}
          />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}