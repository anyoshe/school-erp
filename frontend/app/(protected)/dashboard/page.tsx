"use client";

import { Users, BookOpen, DollarSign, TrendingUp, Calendar, Library, BarChart3, Cpu, Shield, Globe, Database, Activity, ChevronRight, Clock, CheckCircle, Target } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";

export default function DashboardHome() {
  const [activeFilter, setActiveFilter] = useState("today");
  const { currentSchool, loading: schoolLoading } = useCurrentSchool();
  const [userName, setUserName] = useState("User");
  const router = useRouter();

  useEffect(() => {
    async function fetchUser() {
      try {
        const user = await getCurrentUser(true);
        let fullName =
          user.full_name ||
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          user.email?.split("@")[0] ||
          "User";

        // Capitalize each word properly
        fullName = fullName
          .split(" ")
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" ");

        setUserName(fullName);
      } catch (error) {
        console.error("Failed to fetch user name:", error);
        setUserName("User");
      }
    }
    fetchUser();
  }, []);
  // Very simple loading state while school context is initializing
  if (schoolLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your school context...</p>
        </div>
      </div>
    );
  }

  // No school selected → guide the user
  if (!currentSchool) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 text-center max-w-2xl mx-auto mt-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3">
          No School Selected
        </h2>
        <p className="text-gray-600 mb-6">
          Please use the school switcher in the top bar to select a school you manage.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg">
          <Target className="w-5 h-5" />
          <span className="font-medium">Select a school to begin</span>
        </div>
      </div>
    );
  }
  const stats = [
    { name: "Pending Admissions", value: "38", change: "+15", icon: TrendingUp, color: "indigo" },
    { name: "Total Students", value: "2,847", change: "+12%", icon: Users, color: "blue" },
    { name: "Faculty Staff", value: "156", change: "+8%", icon: Users, color: "emerald" },
    { name: "Revenue", value: "$324.5K", change: "+23.5%", icon: DollarSign, color: "amber" },
    { name: "Active Courses", value: "42", change: "+4", icon: BookOpen, color: "purple" },
  ];

  const quickActions = [
    { name: "Students", icon: Users, color: "blue", label: "Manage", path: "/dashboard/modules/students" },
    { name: "Admissions", icon: TrendingUp, color: "indigo", label: "Applications", path: "/dashboard/modules/admissions" },
    { name: "Finance", icon: DollarSign, color: "emerald", label: "Payments", path: "/dashboard/modules/finance" },
    { name: "Courses", icon: BookOpen, color: "purple", label: "Manage", path: "/dashboard/modules/academics" },
    { name: "Attendance", icon: Calendar, color: "amber", label: "Mark", path: "/dashboard/modules/attendance" },
    { name: "Library", icon: Library, color: "rose", label: "Books", path: "/dashboard/modules/library" },
    { name: "Reports", icon: BarChart3, color: "teal", label: "Generate", path: "/dashboard/modules/reports" },
  ];

  const systemMetrics = [
    { name: "Server Load", value: "68%", icon: Cpu, status: "normal" },
    { name: "Storage Used", value: "84%", icon: Database, status: "high" },
    { name: "Active Sessions", value: "247", icon: Globe, status: "up" },
    { name: "API Health", value: "100%", icon: Shield, status: "good" },
  ];

  const recentActivities = [
    { user: "Dr. Sarah Chen", action: "uploaded Physics 301 materials", time: "10:24 AM", type: "academic" },
    { user: "Finance Dept", action: "processed 134 fee payments", time: "9:45 AM", type: "finance" },
    { user: "Admin", action: "added new staff: Michael Rodriguez", time: "Yesterday", type: "admin" },
    { user: "System", action: "backup completed successfully", time: "2:30 AM", type: "system" },
  ];

  const performanceData = [
    { month: "Jan", academic: 78, attendance: 85 },
    { month: "Feb", academic: 82, attendance: 88 },
    { month: "Mar", academic: 85, attendance: 90 },
    { month: "Apr", academic: 88, attendance: 92 },
    { month: "May", academic: 90, attendance: 94 },
    { month: "Jun", academic: 92, attendance: 95 },
  ];

  const getColorClass = (color: string) => {
    const colors: Record<string, { bg: string; text: string; ring: string; hover: string; gradient: string }> = {
      blue: {
        bg: "bg-blue-600",
        text: "text-blue-600",
        ring: "ring-blue-200",
        hover: "hover:bg-blue-50",
        gradient: "from-blue-500 to-blue-600"
      },
      emerald: {
        bg: "bg-emerald-600",
        text: "text-emerald-600",
        ring: "ring-emerald-200",
        hover: "hover:bg-emerald-50",
        gradient: "from-emerald-500 to-emerald-600"
      },
      amber: {
        bg: "bg-amber-500",
        text: "text-amber-600",
        ring: "ring-amber-200",
        hover: "hover:bg-amber-50",
        gradient: "from-amber-400 to-amber-500"
      },
      purple: {
        bg: "bg-purple-600",
        text: "text-purple-600",
        ring: "ring-purple-200",
        hover: "hover:bg-purple-50",
        gradient: "from-purple-500 to-purple-600"
      },
      rose: {
        bg: "bg-rose-600",
        text: "text-rose-600",
        ring: "ring-rose-200",
        hover: "hover:bg-rose-50",
        gradient: "from-rose-500 to-rose-600"
      },
      indigo: {
        bg: "bg-indigo-600",
        text: "text-indigo-600",
        ring: "ring-indigo-200",
        hover: "hover:bg-indigo-50",
        gradient: "from-indigo-500 to-indigo-600"
      },
      teal: {
        bg: "bg-teal-600",
        text: "text-teal-600",
        ring: "ring-teal-200",
        hover: "hover:bg-teal-50",
        gradient: "from-teal-500 to-teal-600"
      },
    };
    return colors[color] || colors.blue;
  };



  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Welcome Header – now school-aware */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-5 border border-blue-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {userName}
              </span>
            </h1>
            <p className="text-gray-600 text-sm sm:text-base mt-1 flex items-center gap-2">
              In{" "}
              <span className="font-semibold text-gray-900">
                {currentSchool.name}
                {currentSchool.short_name && (
                  <span className="text-gray-500 ml-1.5 text-base">
                    ({currentSchool.short_name})
                  </span>
                )}
              </span>
              • Here's what's happening today.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 sm:px-4 py-2 bg-white rounded-lg sm:rounded-xl border border-gray-200">
              <p className="text-xs sm:text-sm font-medium text-gray-900">
                <Clock className="inline w-3 h-3 sm:w-4 sm:h-4 mr-1.5 text-gray-400" />
                Today, {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Time Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            <span className="font-medium text-gray-900 text-sm sm:text-base">Analytics Period</span>
          </div>
          <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
            {["today", "week", "month", "year"].map((period) => (
              <button
                key={period}
                onClick={() => setActiveFilter(period)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md capitalize transition-all ${activeFilter === period
                  ? "bg-white text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
                  }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-5 gap-3">
        {stats.map((stat) => {
          const colors = getColorClass(stat.color);
          return (
            <div
              key={stat.name}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-lg bg-gradient-to-br ${colors.gradient} bg-opacity-10`}>
                  <stat.icon className={`w-5 h-5 ${colors.text}`} />
                </div>
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  <TrendingUp className="w-3 h-3" />
                  {stat.change}
                </span>
              </div>
              <p className="text-gray-600 text-xs font-medium mb-1 truncate">{stat.name}</p>
              <p className="text-lg font-bold text-gray-900 truncate">{stat.value}</p>
              <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${colors.gradient} rounded-full`}
                  style={{ width: `${Math.min(90, Math.random() * 30 + 70)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base sm:text-lg font-bold text-gray-900">Quick Actions</h2>
          <button className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium">
            View all →
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {quickActions.map((action) => {
            const colors = getColorClass(action.color);
            return (
              <button
                key={action.name}
                onClick={() => router.push(action.path)}
                className="group bg-white rounded-lg border border-gray-200 p-3 text-center hover:shadow-sm transition-all duration-150"
              >
                <div className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${colors.gradient} bg-opacity-10 mb-2 group-hover:scale-105 transition-transform`}>
                  <action.icon className={`w-4 h-4 ${colors.text}`} />
                </div>
                <p className="font-semibold text-gray-900 text-xs mb-0.5 truncate">{action.name}</p>
                <p className="text-gray-500 text-xs truncate">{action.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Performance Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900">Performance Trends</h2>
            <p className="text-gray-600 text-xs sm:text-sm mt-0.5">Academic vs Attendance correlation</p>
          </div>
          <div className="flex items-center gap-3 mt-3 lg:mt-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
              <span className="text-xs sm:text-sm text-gray-700">Academic</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
              <span className="text-xs sm:text-sm text-gray-700">Attendance</span>
            </div>
          </div>
        </div>

        <div className="h-40 sm:h-48 flex items-end justify-between gap-1 px-1">
          {performanceData.map((item) => (
            <div key={item.month} className="flex-1 flex flex-col items-center">
              <div className="relative w-full flex justify-center gap-1 mb-2">
                <div
                  className="w-1/2 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                  style={{ height: `${item.academic * 1.2}px` }}
                />
                <div
                  className="w-1/2 bg-emerald-500 rounded-t hover:bg-emerald-600 transition-colors"
                  style={{ height: `${item.attendance * 1.2}px` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-700">{item.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* System Status & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* System Status */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold">System Status</h3>
            <span className="text-xs bg-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-full font-medium">
              Operational
            </span>
          </div>
          <div className="space-y-3">
            {systemMetrics.map((metric) => {
              const isHigh = metric.status === "high";
              const isGood = metric.status === "good";
              return (
                <div key={metric.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${(isGood ? "bg-emerald-500" : isHigh ? "bg-amber-500" : "bg-blue-500")}/20`}>
                      <metric.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{metric.name}</p>
                      <p className="text-gray-300 text-xs mt-0.5">{metric.value}</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium capitalize px-2 py-1 bg-white/10 rounded-full">
                    {metric.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900">Recent Activity</h3>
            <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              View all →
            </button>
          </div>
          <div className="space-y-3">
            {recentActivities.map((activity, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${activity.type === "academic" ? "bg-blue-100" :
                  activity.type === "finance" ? "bg-emerald-100" :
                    activity.type === "admin" ? "bg-purple-100" :
                      "bg-gray-100"
                  }`}>
                  {activity.type === "academic" ? <BookOpen className="w-4 h-4 text-blue-600" /> :
                    activity.type === "finance" ? <DollarSign className="w-4 h-4 text-emerald-600" /> :
                      activity.type === "admin" ? <Users className="w-4 h-4 text-purple-600" /> :
                        <Activity className="w-4 h-4 text-gray-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    <span className="font-semibold">{activity.user}</span> {activity.action}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { value: "98.7%", label: "System Uptime", status: "Excellent" },
            { value: "2.4s", label: "Avg Response Time", status: "Optimal" },
            { value: "1.2K", label: "API Requests", status: "Today" },
            { value: "0", label: "Active Issues", status: "All Clear" },
          ].map((item, i) => (
            <div key={i} className="text-center p-3 rounded-lg bg-gray-50">
              <div className="text-lg font-bold text-gray-900 mb-1">{item.value}</div>
              <p className="text-xs text-gray-600 mb-2 truncate">{item.label}</p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                <CheckCircle className="w-3 h-3" />
                {item.status}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            Last updated: Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  );
}