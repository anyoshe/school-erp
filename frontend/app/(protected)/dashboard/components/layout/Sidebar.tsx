"use client";

import { 
  Home, Settings, LogOut, 
  Users, BookOpen, DollarSign, Calendar, Library, BarChart3 
} from "lucide-react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse?: () => void;
}

interface MenuItem {
  icon: any;
  label: string;
  href: string;
}

// Module config: code → UI data
const MODULE_CONFIG: Record<string, MenuItem> = {
  students: { label: "Students", icon: Users, href: "/dashboard/modules/students" },
  admissions: { label: "Admissions", icon: BookOpen, href: "/dashboard/modules/admissions" },
  finance: { label: "Finance", icon: DollarSign, href: "/dashboard/modules/finance" },
  academics: { label: "Courses", icon: BookOpen, href: "/dashboard/modules/academics" },
  attendance: { label: "Attendance", icon: Calendar, href: "/dashboard/modules/attendance" },
  library: { label: "Library", icon: Library, href: "/dashboard/modules/library" },
  reports: { label: "Reports", icon: BarChart3, href: "/dashboard/modules/reports" },
  hr: { label: "Human Resource", icon: Users, href: "/dashboard/modules/hr" },
  // Add more as needed
};

export default function Sidebar({ isCollapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { currentSchool, loading } = useCurrentSchool();

  if (loading) {
    return <div className="p-6 text-gray-400">Loading modules...</div>;
  }

  // Get enabled modules (array of objects)
  const enabledModules = currentSchool?.modules || [];

  // Build dynamic module items
  const dynamicItems: MenuItem[] = enabledModules
    .map(module => module.code ? MODULE_CONFIG[module.code] : undefined)
    .filter((item): item is MenuItem => !!item);

  // Core items - only Dashboard at top
  const topCoreItems: MenuItem[] = [
    { icon: Home, label: "Dashboard", href: "/dashboard" },
  ];

  // Settings as the very last item
  const bottomCoreItem: MenuItem = {
    icon: Settings,
    label: "Settings",
    href: "/dashboard/settings"
  };

  // Final menu: Dashboard → All Modules (incl. HR) → Settings
  const menuItems: MenuItem[] = [
    ...topCoreItems,
    ...dynamicItems,
    bottomCoreItem
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header: School Logo + Name */}
      <div className="p-6 border-b border-gray-200">
        <div className={clsx("flex items-center gap-3 transition-all", isCollapsed && "justify-center")}>
          <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold">
            {currentSchool?.logo ? (
              <img
                src={currentSchool.logo}
                alt={currentSchool.name || "School logo"}
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

          {!isCollapsed && (
            <span className="text-xl font-bold text-gray-900 truncate max-w-[180px]">
              {currentSchool?.name || "School ERP"}
            </span>
          )}
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <li key={item.label}>
                <a
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-3 rounded-lg transition-all group relative",
                    isActive ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700 hover:bg-gray-100",
                    isCollapsed && "justify-center px-3"
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}

                  {isCollapsed && (
                    <span className="absolute left-full ml-3 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
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
          onClick={() => window.location.href = "/login"}
        >
          <LogOut className="w-5 h-5" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}