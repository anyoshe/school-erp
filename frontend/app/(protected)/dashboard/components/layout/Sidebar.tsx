"use client";

import {
  Home, Settings, LogOut,
  Users, BookOpen, DollarSign, Calendar, Library, BarChart3, Info, MapPin, Book, Image, Grid, ChevronDown, GraduationCap, FileText
} from "lucide-react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useState } from "react";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse?: () => void;
}

interface MenuItem {
  icon: any;
  label: string;
  href?: string;
  children?: MenuItem[];
}
const DESIRED_ORDER: string[] = [
  "admissions",
  "finance",
  "students",
  "academics",
  "attendance",
  "library",
  "staff",
  "events",
  "health",
  "parent_portal",
  "alumni",
  "transport",
  "elearning",
  "inventory",
  "procurement",
  // reports intentionally missing → will be forced last
];
// Map backend module codes to friendly names, icons, and URLs
const MODULE_CONFIG: Record<string, MenuItem> = {
  admissions: { label: "Admissions Management", icon: GraduationCap, href: "/dashboard/modules/admissions" },
  students: { label: "Student Management", icon: Users, href: "/dashboard/modules/students" },
  finance: { label: "Finance & Accounting", icon: DollarSign, href: "/dashboard/modules/finance" },
  academics: { label: "Academic Management", icon: BookOpen, href: "/dashboard/modules/academics" },
  attendance: { label: "Attendance Tracking", icon: Calendar, href: "/dashboard/modules/attendance" },
  library: { label: "Library Management", icon: Library, href: "/dashboard/modules/library" },
  reports: { label: "Reports & Analytics", icon: BarChart3, href: "/dashboard/modules/reports" },
  staff: { label: "Human Resource Management", icon: FileText, href: "/dashboard/modules/hr" },
  events: { label: "Events Management", icon: Calendar, href: "/dashboard/modules/events" },
  health: { label: "Health & Wellness", icon: Book, href: "/dashboard/modules/health" },
  parent_portal: { label: "Parent Portal", icon: Users, href: "/dashboard/modules/parent-portal" },
  alumni: { label: "Alumni Management", icon: Users, href: "/dashboard/modules/alumni" },
  transport: { label: "Transport Management", icon: Users, href: "/dashboard/modules/transport" },
  elearning: { label: "E-Learning", icon: BookOpen, href: "/dashboard/modules/elearning" },
  inventory: { label: "Inventory Management", icon: BookOpen, href: "/dashboard/modules/inventory" },
  procurement: { label: "Procurement Management", icon: BookOpen, href: "/dashboard/modules/procurement" },
};

// Fixed school settings links
const SETTINGS_LINKS: MenuItem[] = [
  { label: "Basic Info", href: "/dashboard/settings/school/basic-info", icon: Info },
  { label: "Contact & Address", href: "/dashboard/settings/school/contact", icon: MapPin },
  { label: "Academic Departments", href: "/dashboard/settings/school/departments", icon: Book },
  { label: "Academic Config", href: "/dashboard/settings/school/academic", icon: Book },
  { label: "Branding", href: "/dashboard/settings/school/branding", icon: Image },
  { label: "Modules", href: "/dashboard/settings/modules", icon: Grid },
  { label: "Users & Roles", href: "/dashboard/settings/users", icon: Users },
  { label: "Billing", href: "/dashboard/settings/billing", icon: DollarSign },
];

export default function Sidebar({ isCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const { currentSchool, loading } = useCurrentSchool();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  if (loading) return <div className="p-6 text-gray-400">Loading modules...</div>;

  const enabledModules = currentSchool?.modules || [];
// Build unique items by code first (already deduplicated)
const uniqueModuleItems = new Map<string, MenuItem>();

for (const m of enabledModules) {
  if (!m.code) continue;
  const item = MODULE_CONFIG[m.code];
  if (item) {
    uniqueModuleItems.set(m.code, item);
  }
}

// Now build the final ordered list
const dynamicItems: MenuItem[] = [];

// 1. Desired order (skip if not enabled)
for (const code of DESIRED_ORDER) {
  const item = uniqueModuleItems.get(code);
  if (item) {
    dynamicItems.push(item);
    uniqueModuleItems.delete(code); // prevent appearing again
  }
}

// 2. Reports last (if enabled)
const reportsItem = uniqueModuleItems.get("reports");
if (reportsItem) {
  dynamicItems.push(reportsItem);
  uniqueModuleItems.delete("reports");
}

// 3. Any remaining modules (in backend-provided order)
for (const item of uniqueModuleItems.values()) {
  dynamicItems.push(item);
}

// ── Debug: Check for duplicate hrefs ────────────────────────────────
const hrefCount = new Map<string, number>();
dynamicItems.forEach(item => {
  if (item.href) {
    hrefCount.set(item.href, (hrefCount.get(item.href) || 0) + 1);
  }
});

const duplicates = Array.from(hrefCount.entries()).filter(([_, count]) => count > 1);

if (duplicates.length > 0) {
  console.warn("Duplicate hrefs detected in sidebar:", duplicates);
  console.log("Full dynamicItems:", dynamicItems.map(i => ({label: i.label, href: i.href})));
}
  return (
    <div className="flex flex-col h-full bg-white shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className={clsx("flex items-center gap-3 transition-all")}>
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
          {/* Dashboard */}
          <li>
            <a
              href="/dashboard"
              className={clsx(
                "flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all",
                pathname === "/dashboard"
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Home className="w-5 h-5" />
              {!isCollapsed && <span>Dashboard</span>}
            </a>
          </li>

          {/* Dynamic Modules */}
          {dynamicItems.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all",
                  pathname.startsWith(item.href || "")
                    ? "bg-blue-50 text-blue-600 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <item.icon className="w-5 h-5" />
                {!isCollapsed && <span>{item.label}</span>}
              </a>
            </li>
          ))}

          {/* Settings */}
          <li>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={clsx(
                "flex items-center justify-between px-3 py-3 w-full rounded-lg text-sm transition-all",
                pathname.startsWith("/dashboard/settings")
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5" />
                {!isCollapsed && <span>Settings</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  className={clsx(
                    "w-4 h-4 transition-transform duration-200",
                    isSettingsOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              )}
            </button>

            {/* Submenu */}
            <ul
              className={clsx(
                "overflow-hidden transition-all duration-300",
                isSettingsOpen ? "max-h-[1000px] mt-1" : "max-h-0"
              )}
            >
              {SETTINGS_LINKS.map((link) => {
                const isActive = pathname.startsWith(link.href || "");
                const Icon = link.icon;
                return (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className={clsx(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                        isActive
                          ? "bg-blue-50 text-blue-600 font-medium"
                          : "text-gray-600 hover:bg-gray-50 hover:text-blue-600"
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {!isCollapsed && <span>{link.label}</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
          </li>

          {/* Add School */}
          <li>
            <button
              onClick={() => window.location.href = "/onboarding/setup?mode=new"}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-green-600 hover:bg-green-50 hover:text-green-700 transition-all"
            >
              <Users className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span>Add School</span>}
            </button>
          </li>
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-all"
          onClick={() => window.location.href = "/login"}
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
