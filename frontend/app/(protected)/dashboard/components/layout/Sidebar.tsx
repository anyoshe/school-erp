"use client";

import { resolveMediaUrl } from "@/utils/media";

import Link from "next/link";
import { Hash,
  Home, Settings, LogOut, Shield,
  Users, BookOpen, DollarSign, Calendar, Library, BarChart3, Info, MapPin, Book, Image, Grid, ChevronDown, GraduationCap, FileText
} from "lucide-react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse?: () => void;
  /** Close mobile drawer after choosing a destination */
  onNavigate?: () => void;
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
  "staff",
  "parent_portal",
  "library",
  "reports",
  "events",
  "health",
  "alumni",
  "transport",
  "elearning",
  "inventory",
  "procurement",
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
  { label: "Grade requirements", href: "/dashboard/settings/school/academic/requirements", icon: Book },
  { label: "Admission numbers", href: "/dashboard/settings/school/admission-numbers", icon: Hash },
  { label: "Branding", href: "/dashboard/settings/school/branding", icon: Image },
  { label: "Modules", href: "/dashboard/settings/modules", icon: Grid },
  { label: "Users & Roles", href: "/dashboard/settings/users", icon: Users },
  { label: "Billing", href: "/dashboard/settings/billing", icon: DollarSign },
  { label: "Risk thresholds", href: "/dashboard/settings/school/risk", icon: Shield },
];

export default function Sidebar({ isCollapsed, onToggleCollapse, onNavigate }: SidebarProps) {
  const handleNavigate = () => {
    onNavigate?.();
  };

  const pathname = usePathname();
  const { currentSchool, isPlatformAdmin } = useCurrentSchool();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Open Settings submenu after mount when already on a settings route (avoid SSR mismatch)
  useEffect(() => {
    if (pathname.startsWith("/dashboard/settings")) {
      setIsSettingsOpen(true);
    }
  }, [pathname]);

  const enabledModules = currentSchool?.modules || [];

  // Product core — used only when school has no module list yet
  const CORE_MODULE_CODES = [
    "admissions",
    "students",
    "finance",
    "academics",
    "attendance",
    "staff",
    "parent_portal",
    "reports",
  ];

  // Placeholder modules: never inject unless the school explicitly enabled them
  const SHELL_MODULE_CODES = new Set([
    "library",
    "events",
    "health",
    "alumni",
    "transport",
    "elearning",
    "inventory",
    "procurement",
  ]);

  const uniqueModuleItems = new Map<string, MenuItem>();
  const schoolCodes = enabledModules
    .map((m: { code?: string }) => m?.code)
    .filter(Boolean) as string[];

  if (schoolCodes.length === 0) {
    for (const code of CORE_MODULE_CODES) {
      const item = MODULE_CONFIG[code];
      if (item) uniqueModuleItems.set(code, item);
    }
  } else {
    for (const code of schoolCodes) {
      if (SHELL_MODULE_CODES.has(code) && !schoolCodes.includes(code)) continue;
      const item = MODULE_CONFIG[code];
      if (item) uniqueModuleItems.set(code, item);
    }
    // Always keep core operational modules visible even if an older school
    // lost them from the M2M — still prefer not to force shells.
    for (const code of CORE_MODULE_CODES) {
      if (!uniqueModuleItems.has(code) && MODULE_CONFIG[code]) {
        uniqueModuleItems.set(code, MODULE_CONFIG[code]);
      }
    }
  }

  const dynamicItems: MenuItem[] = [];
  for (const code of DESIRED_ORDER) {
    const item = uniqueModuleItems.get(code);
    if (item) {
      dynamicItems.push(item);
      uniqueModuleItems.delete(code);
    }
  }
  const reportsItem = uniqueModuleItems.get("reports");
  if (reportsItem) {
    dynamicItems.push(reportsItem);
    uniqueModuleItems.delete("reports");
  }
  for (const item of uniqueModuleItems.values()) {
    dynamicItems.push(item);
  }
  return (
    <div className="flex flex-col h-full bg-white shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className={clsx("flex items-center gap-3 transition-all")}>
          <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-primary-700 to-primary-900 flex items-center justify-center text-white font-bold">
            {currentSchool?.logo ? (
              <img
                src={resolveMediaUrl(currentSchool.logo) || undefined}
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
          {isPlatformAdmin && (
            <li>
              <Link
                href="/platform-admin"
                onClick={handleNavigate}
                  className={clsx(
                  "flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all",
                  pathname === "/platform-admin"
                    ? "bg-primary-50 text-primary-800 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <Shield className="w-5 h-5" />
                {!isCollapsed && <span>Platform dashboard</span>}
              </Link>
            </li>
          )}

          {/* Dashboard */}
          <li>
            <Link
              href={isPlatformAdmin && !currentSchool ? "/platform-admin" : "/dashboard"}
              onClick={handleNavigate}
                  className={clsx(
                "flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all",
                pathname === "/dashboard" && (!isPlatformAdmin || Boolean(currentSchool))
                  ? "bg-primary-50 text-primary-800 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Home className="w-5 h-5" />
              {!isCollapsed && <span>{isPlatformAdmin && !currentSchool ? "School directory" : "Dashboard"}</span>}
            </Link>
          </li>

          {/* Dynamic Modules */}
          {dynamicItems.map((item) => {
            if (!item.href) return null;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={handleNavigate}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all",
                    pathname.startsWith(item.href)
                      ? "bg-primary-50 text-primary-800 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}

          {/* Early warning */}
          <li>
            <Link
              href="/dashboard/modules/risks"
              onClick={handleNavigate}
                  className={clsx(
                "flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all",
                pathname.startsWith("/dashboard/modules/risks")
                  ? "bg-primary-50 text-primary-800 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Shield className="w-5 h-5" />
              {!isCollapsed && <span>Risk center</span>}
            </Link>
          </li>

          {/* Settings */}
          {(!isPlatformAdmin || Boolean(currentSchool)) && (
          <li>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={clsx(
                "flex items-center justify-between px-3 py-3 w-full rounded-lg text-sm transition-all",
                pathname.startsWith("/dashboard/settings")
                  ? "bg-primary-50 text-primary-800 font-medium"
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
                if (!link.href) return null;
                const isActive = pathname.startsWith(link.href);
                const Icon = link.icon;
                return (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      onClick={handleNavigate}
                  className={clsx(
                        "flex items-center gap-2 px-3 py-3 min-h-[44px] rounded-lg text-sm transition-all",
                        isActive
                          ? "bg-primary-50 text-primary-800 font-medium"
                          : "text-gray-600 hover:bg-gray-50 hover:text-primary-700"
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {!isCollapsed && <span>{link.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
          )}

          {/* Add School */}
          {!isPlatformAdmin && (
          <li>
            <button
              onClick={() => { handleNavigate(); window.location.href = "/onboarding/setup?mode=new"; }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-secondary-600 hover:bg-secondary-50 hover:text-secondary-700 transition-all"
            >
              <Users className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span>Add School</span>}
            </button>
          </li>
          )}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-all"
          onClick={() => { handleNavigate(); window.location.href = "/login"; }}
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
