"use client";

import { Users, BookOpen, DollarSign, TrendingUp, Calendar, Library, BarChart3, Cpu, Shield, Globe, Database, Activity, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardHome() {
  const [activeFilter, setActiveFilter] = useState("today");
  const router = useRouter();
  const stats = [
    { name: "Total Students", value: "2,847", change: "+12%", icon: Users, color: "blue" },
    { name: "Faculty Staff", value: "156", change: "+8%", icon: Users, color: "emerald" },
    { name: "Revenue", value: "$324.5K", change: "+23.5%", icon: DollarSign, color: "amber" },
    { name: "Active Courses", value: "42", change: "+4", icon: BookOpen, color: "purple" },
  ];

  const quickActions = [
    { name: "Students", icon: Users, color: "blue", label: "Manage Students" },
    { name: "Finance", icon: DollarSign, color: "emerald", label: "Fee Payments" },
    { name: "Courses", icon: BookOpen, color: "purple", label: "Manage Courses" },
    { name: "Attendance", icon: Calendar, color: "amber", label: "Mark Attendance" },
    { name: "Library", icon: Library, color: "rose", label: "Book Records" },
    { name: "Reports", icon: BarChart3, color: "indigo", label: "Generate Reports" },
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
    const colors: Record<string, { bg: string; text: string; ring: string; hover: string }> = {
      blue: { bg: "bg-blue-600", text: "text-blue-600", ring: "ring-blue-200", hover: "hover:bg-blue-50" },
      emerald: { bg: "bg-emerald-600", text: "text-emerald-600", ring: "ring-emerald-200", hover: "hover:bg-emerald-50" },
      amber: { bg: "bg-amber-500", text: "text-amber-600", ring: "ring-amber-200", hover: "hover:bg-amber-50" },
      purple: { bg: "bg-purple-600", text: "text-purple-600", ring: "ring-purple-200", hover: "hover:bg-purple-50" },
      rose: { bg: "bg-rose-600", text: "text-rose-600", ring: "ring-rose-200", hover: "hover:bg-rose-50" },
      indigo: { bg: "bg-indigo-600", text: "text-indigo-600", ring: "ring-indigo-200", hover: "hover:bg-indigo-50" },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="h-full bg-gray-50">
      <div className="h-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Header */}
        <header className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">School ERP Dashboard</h1>
              <p className="text-gray-600 mt-2">Real-time overview of your institution</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
                {["today", "week", "month", "year"].map((period) => (
                  <button
                    key={period}
                    onClick={() => setActiveFilter(period)}
                    className={`px-5 py-2.5 text-sm font-medium rounded-lg capitalize transition-all ${activeFilter === period
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-6">
            <span className="px-4 py-1.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Live</span>
            <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">AI Powered</span>
            <span className="px-4 py-1.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">Cloud Sync</span>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {stats.map((stat) => {
            const colors = getColorClass(stat.color);
            return (
              <div key={stat.name} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-5">
                  <div className={`p-3.5 rounded-xl ${colors.bg}/10 ring-4 ${colors.ring}`}>
                    <stat.icon className={`w-7 h-7 ${colors.text}`} />
                  </div>
                  <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                    <TrendingUp className="w-4 h-4" />
                    {stat.change}
                  </span>
                </div>
                <p className="text-gray-600 text-sm font-medium">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                <div className="mt-6 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${colors.bg} rounded-full transition-all duration-1000`} style={{ width: "88%" }} />
                </div>
              </div>
            );
          })}
        </section>

        {/* Performance Overview */}
        <section className="mb-12">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Performance Overview</h2>
                <p className="text-gray-600 mt-2">Academic performance vs attendance trends</p>
              </div>
              <div className="flex items-center gap-8 mt-6 lg:mt-0">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-blue-600 rounded-full" />
                  <span className="text-sm font-medium text-gray-700">Academic</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-emerald-600 rounded-full" />
                  <span className="text-sm font-medium text-gray-700">Attendance</span>
                </div>
              </div>
            </div>

            <div className="h-80 md:h-96 flex items-end justify-between gap-4">
              {performanceData.map((item) => (
                <div key={item.month} className="flex-1 flex flex-col items-center">
                  <div className="relative w-full flex justify-center gap-2 mb-5">
                    <div
                      className="w-full bg-blue-600 rounded-t-lg hover:bg-blue-700 transition-all duration-300 group"
                      style={{ height: `${item.academic * 3}px` }}
                    >
                      <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.academic}%
                      </div>
                    </div>
                    <div
                      className="w-full bg-emerald-600 rounded-t-lg hover:bg-emerald-700 transition-all duration-300 group"
                      style={{ height: `${item.attendance * 3}px` }}
                    >
                      <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.attendance}%
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{item.month}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="mb-12">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {quickActions.map((action) => {
              const colors = getColorClass(action.color);
              return (
                <button
                  key={action.name}
                  className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-7 text-left ${colors.hover} transition-all duration-300 hover:shadow-xl hover:-translate-y-2 group`}
                  onClick={() => router.push("/dashboard/modules/students")}
                >
            <div className={`p-4 rounded-xl ${colors.bg}/10 w-fit mb-6 group-hover:scale-110 transition-transform`}>
              <action.icon className={`w-8 h-8 ${colors.text}`} />
            </div>
            <p className="font-bold text-gray-900 text-lg">{action.name}</p>
            <p className="text-sm text-gray-600 mt-2">{action.label}</p>
            <ChevronRight className="w-5 h-5 text-gray-400 mt-6 group-hover:text-gray-700 group-hover:translate-x-3 transition-all" />
          </button>
          );
            })}
      </div>
    </section>

        {/* System Status & Recent Activity - Stacked in Column */ }
  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
    {/* System Status */}
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 text-white">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-bold">System Status</h3>
        <span className="text-sm bg-emerald-500/20 text-emerald-300 px-5 py-2 rounded-full font-medium">
          Operational
        </span>
      </div>
      <div className="space-y-6">
        {systemMetrics.map((metric) => {
          const isHigh = metric.status === "high";
          const isGood = metric.status === "good";
          return (
            <div key={metric.name} className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className={`p-4 rounded-xl ${(isGood ? "bg-emerald-500" : isHigh ? "bg-amber-500" : "bg-blue-500")}/20`}>
                  <metric.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-lg">{metric.name}</p>
                  <p className="text-gray-300 mt-1">{metric.value}</p>
                </div>
              </div>
              <span className="text-sm font-medium capitalize text-gray-300 px-4 py-2 bg-white/10 rounded-full">
                {metric.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>

    {/* Recent Activity */}
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-bold text-gray-900">Recent Activity</h3>
        <button className="text-sm font-medium text-blue-600 hover:text-blue-700">View all →</button>
      </div>
      <div className="space-y-6">
        {recentActivities.map((activity, i) => (
          <div key={i} className="flex gap-5">
            <div className={`p-4 rounded-xl shrink-0 ${activity.type === "academic" ? "bg-blue-100 text-blue-600" :
                activity.type === "finance" ? "bg-emerald-100 text-emerald-600" :
                  activity.type === "admin" ? "bg-purple-100 text-purple-600" :
                    "bg-gray-100 text-gray-600"
              }`}>
              {activity.type === "academic" ? <BookOpen className="w-6 h-6" /> :
                activity.type === "finance" ? <DollarSign className="w-6 h-6" /> :
                  activity.type === "admin" ? <Users className="w-6 h-6" /> :
                    <Activity className="w-6 h-6" />}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">
                <span className="font-semibold">{activity.user}</span> {activity.action}
              </p>
              <p className="text-sm text-gray-500 mt-2">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>

  {/* Bottom Summary */ }
  <footer className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
      <div>
        <div className="text-4xl font-bold text-gray-900">98.7%</div>
        <p className="text-sm text-gray-600 mt-4">System Uptime</p>
        <p className="text-sm font-semibold text-emerald-600 mt-2">Excellent</p>
      </div>
      <div>
        <div className="text-4xl font-bold text-gray-900">2.4s</div>
        <p className="text-sm text-gray-600 mt-4">Avg Response Time</p>
        <p className="text-sm font-semibold text-blue-600 mt-2">Optimal</p>
      </div>
      <div>
        <div className="text-4xl font-bold text-gray-900">1.2K</div>
        <p className="text-sm text-gray-600 mt-4">API Requests</p>
        <p className="text-sm font-semibold text-emerald-600 mt-2">Today</p>
      </div>
      <div>
        <div className="text-4xl font-bold text-gray-900">0</div>
        <p className="text-sm text-gray-600 mt-4">Active Issues</p>
        <p className="text-sm font-semibold text-emerald-600 mt-2">All Clear</p>
      </div>
    </div>
    <div className="mt-10 pt-8 border-t border-gray-200 text-center">
      <p className="text-sm text-gray-500">
        Last updated: Today at 11:42 AM • Auto-refresh in 3 minutes
      </p>
    </div>
  </footer>
      </div >
    </div >
  );
}