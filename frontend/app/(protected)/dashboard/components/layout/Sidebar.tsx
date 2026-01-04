"use client";

import { Home, Users, BookOpen, DollarSign, Calendar, Library, BarChart3, Settings, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import clsx from "clsx";

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse?: () => void;
}

const menuItems = [
  { icon: Home, label: "Dashboard", href: "/" },
  { icon: Users, label: "Students", href: "/students" },
  { icon: Users, label: "Faculty", href: "/faculty" },
  { icon: BookOpen, label: "Courses", href: "/courses" },
  { icon: DollarSign, label: "Finance", href: "/finance" },
  { icon: Calendar, label: "Attendance", href: "/attendance" },
  { icon: Library, label: "Library", href: "/library" },
  { icon: BarChart3, label: "Reports", href: "/reports" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export default function Sidebar({ isCollapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className={clsx("flex items-center gap-3 transition-all", isCollapsed && "justify-center")}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600" />
          {!isCollapsed && <span className="text-xl font-bold text-gray-900">ERP Pro</span>}
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <li key={item.label}>
                <a
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-3 rounded-lg transition-all",
                    isActive
                      ? "bg-blue-50 text-blue-600 font-medium"
                      : "text-gray-700 hover:bg-gray-100",
                    isCollapsed && "justify-center px-3"
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                  {isCollapsed && !isActive && (
                    <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          className={clsx(
            "flex items-center gap-3 w-full px-3 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-all",
            isCollapsed && "justify-center"
          )}
        >
          <LogOut className="w-5 h-5" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}