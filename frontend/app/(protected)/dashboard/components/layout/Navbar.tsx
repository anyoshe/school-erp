"use client";

import {
  Menu,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  ChevronDown,
} from "lucide-react";
import { useState, useEffect } from "react";
import SchoolSwitcher from "../SchoolSwitcher";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { getCurrentUser } from "@/utils/api";

interface NavbarProps {
  onMenuClick: () => void;
  onDesktopSidebarToggle: () => void;
  isDesktopSidebarOpen: boolean;
}

export default function Navbar({
  onMenuClick,
  onDesktopSidebarToggle,
  isDesktopSidebarOpen,
}: NavbarProps) {
  const { currentSchool } = useCurrentSchool();

  // User state
  const [user, setUser] = useState<{
    full_name?: string;
    first_name?: string;
    last_name?: string;
    email: string;
    role: string;
  } | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const data = await getCurrentUser(true); // fresh data
        setUser(data);
      } catch (error) {
        console.error("Failed to fetch user:", error);
      } finally {
        setIsLoadingUser(false);
      }
    }

    fetchUser();
  }, []);

  // Compute display name (priority: full_name → first+last → email username → fallback)
  const displayName = user
    ? user.full_name ||
    `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
    user.email.split("@")[0] ||
    "User"
    : "Loading...";

  // Compute initials (first letter of first name + last name, or email)
  const initials = user
    ? ((user.first_name?.[0] || "") + (user.last_name?.[0] || "")).toUpperCase() ||
    user.email[0].toUpperCase()
    : "?";

  // Role display (capitalize or fallback)
  const displayRole = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()
    : "Loading...";

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
      <div className="px-3 sm:px-4 md:px-5 lg:px-6 py-3">
        <div className="flex items-center justify-between">

          {/* LEFT */}
          <div className="flex items-center gap-3">
            {/* Mobile menu */}
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-5 h-5 text-gray-700" />
            </button>

            {/* Desktop sidebar toggle */}
            <button
              onClick={onDesktopSidebarToggle}
              className="hidden lg:flex p-2 hover:bg-gray-100 rounded-lg"
              aria-label="Toggle sidebar"
            >
              {isDesktopSidebarOpen ? (
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-700" />
              )}
            </button>

            {/* School selector */}
            <div className="flex items-center gap-2">
              {/* School Avatar / Logo */}
              <div className="relative w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold text-sm bg-gradient-to-br from-blue-500 to-purple-500 shadow-sm">
                {currentSchool?.logo ? (
                  <img
                    src={currentSchool.logo}  // ← Now full URL from ImageField
                    alt={`${currentSchool.name || 'School'} logo`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.parentElement!.innerHTML = currentSchool?.name?.charAt(0)?.toUpperCase() || "S";
                    }}
                  />
                ) : (
                  currentSchool?.name?.charAt(0)?.toUpperCase() || "S"
                )}
              </div>

              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-gray-900 truncate max-w-[160px]">
                  {currentSchool?.name || "Select School"}
                </p>
                <p className="text-xs text-gray-500">Dashboard</p>
              </div>


            </div>

            {/* Actual switcher */}
            <SchoolSwitcher />
          </div>

          {/* CENTER - Search */}
          <div className="hidden lg:block flex-1 max-w-xl mx-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                placeholder="Search students, reports, or actions..."
                className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm"
              />
            </div>
          </div>

          {/* RIGHT - Notifications + User Profile */}
          <div className="flex items-center gap-3">
            {/* Mobile search */}
            <button className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
              <Search className="w-5 h-5 text-gray-700" />
            </button>

            {/* Notifications */}
            <button className="relative p-2 hover:bg-gray-100 rounded-lg">
              <Bell className="w-5 h-5 text-gray-700" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-900">
                  {isLoadingUser ? "Loading..." : displayName}
                </p>
                <p className="text-xs text-gray-500">{displayRole}</p>
              </div>

              {/* User Avatar / Initials */}
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {isLoadingUser ? "..." : initials}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}