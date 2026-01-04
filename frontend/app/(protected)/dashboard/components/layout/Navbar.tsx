
"use client";

import { Menu, ChevronLeft, ChevronRight } from "lucide-react";

interface NavbarProps {
  onMenuClick: () => void;
  onDesktopSidebarToggle?: () => void;
  isDesktopSidebarOpen?: boolean;
}

export default function Navbar({
  onMenuClick,
  onDesktopSidebarToggle,
  isDesktopSidebarOpen,
}: NavbarProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Mobile Hamburger */}
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-gray-100 lg:hidden"
          >
            <Menu className="w-5 h-5 text-gray-700" />
          </button>

          {/* Desktop Sidebar Collapse Toggle */}
          <button
            onClick={onDesktopSidebarToggle}
            className="hidden lg:block p-2 rounded-lg hover:bg-gray-100"
          >
            {isDesktopSidebarOpen ? (
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-700" />
            )}
          </button>

          <h1 className="text-xl font-semibold text-gray-900">School ERP</h1>
        </div>

        {/* Right side - profile, notifications, etc. */}
        <div className="flex items-center gap-3">
          {/* Add your user avatar, notifications here */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />
        </div>
      </div>
    </header>
  );
}