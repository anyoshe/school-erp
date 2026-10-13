"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Users, DollarSign, GraduationCap, TrendingUp, AlertTriangle,
  ChevronRight, CalendarRange, BookOpen, Sparkles, ClipboardList,
} from "lucide-react";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { fetchSchoolPulse } from "@/services/dashboard.service";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function DashboardHome() {
  const { currentSchool, loading: schoolLoading } = useCurrentSchool();
  const { user } = useCurrentUser();
  const router = useRouter();

  const pulseQ = useQuery({
    queryKey: ["school-pulse", currentSchool?.id],
    queryFn: fetchSchoolPulse,
    enabled: !!currentSchool?.id,
    staleTime: 60_000,
  });

  const pulse = pulseQ.data;
  const name =
    user?.full_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.email ||
    "there";

  const currency = pulse?.school?.currency_symbol || currentSchool?.currency_symbol || "KSh";

  if (schoolLoading) {
    return <div className="h-64 animate-pulse bg-stone-100 rounded-2xl" />;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Hero */}
      <div className="rounded-3xl bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white p-6 sm:p-8 shadow-lg overflow-hidden relative">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative">
          <p className="text-primary-100 text-sm font-medium">School pulse</p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight">
            Good to see you, {name.split(" ")[0]}
          </h1>
          <p className="text-primary-100/90 mt-2 max-w-xl text-sm sm:text-base">
            {currentSchool?.name || "Your school"} — decisions at a glance. No digging through modules.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 items-center">
            {pulse?.academics?.active_year && (
              <Badge className="bg-white/15 text-white border-0 backdrop-blur">
                <CalendarRange className="h-3.5 w-3.5 mr-1" />
                {pulse.academics.active_year.name}
                {pulse.academics.current_term ? ` · ${pulse.academics.current_term.name}` : ""}
              </Badge>
            )}
            {typeof pulse?.readiness_score === "number" && (
              <Badge className="bg-secondary/90 text-white border-0">
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                Structure {pulse.readiness_score}% ready
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Active students"
          value={pulseQ.isLoading ? "…" : String(pulse?.students?.active ?? 0)}
          sub={`${pulse?.students?.total ?? 0} total records`}
          icon={Users}
          onClick={() => router.push("/dashboard/modules/students")}
        />
        <Kpi
          label="Collected this month"
          value={pulseQ.isLoading ? "…" : `${currency} ${Number(pulse?.finance?.collected_month || 0).toLocaleString()}`}
          sub={`${pulse?.finance?.overdue_invoices ?? 0} overdue invoices`}
          icon={DollarSign}
          accent="secondary"
          onClick={() => router.push("/dashboard/modules/finance")}
        />
        <Kpi
          label="Fees outstanding"
          value={pulseQ.isLoading ? "…" : `${currency} ${Number(pulse?.finance?.outstanding || 0).toLocaleString()}`}
          sub={`${pulse?.finance?.invoices_unpaid ?? 0} unpaid invoices`}
          icon={TrendingUp}
          onClick={() => router.push("/dashboard/modules/finance")}
        />
        <Kpi
          label="Admissions in play"
          value={
            pulseQ.isLoading
              ? "…"
              : String(
                  (pulse?.admissions?.submitted || 0) +
                    (pulse?.admissions?.under_review || 0) +
                    (pulse?.admissions?.accepted || 0)
                )
          }
          sub={`${pulse?.admissions?.enrolled ?? 0} enrolled · ${pulse?.admissions?.this_month ?? 0} this month`}
          icon={ClipboardList}
          onClick={() => router.push("/dashboard/modules/admissions")}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Gaps / next actions — unique vs generic ERPs */}
        <Card className="lg:col-span-1 border-border rounded-2xl shadow-card">
          <CardContent className="p-5">
            <h2 className="font-semibold text-textPrimary flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-secondary" />
              What needs attention
            </h2>
            <p className="text-xs text-textMuted mt-1 mb-4">
              Guided setup — not a blank system.
            </p>
            {(pulse?.gaps || []).length === 0 && !pulseQ.isLoading ? (
              <p className="text-sm text-primary font-medium bg-primary-50 rounded-xl p-3">
                Structure looks solid. You are ready to run day-to-day operations.
              </p>
            ) : (
              <ul className="space-y-2">
                {(pulse?.gaps || []).map((g: { code: string; label: string; href: string }) => (
                  <li key={g.code}>
                    <button
                      onClick={() => router.push(g.href)}
                      className="w-full text-left flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm hover:border-primary/40 transition-colors"
                    >
                      <span className="text-textPrimary">{g.label}</span>
                      <ChevronRight className="h-4 w-4 text-textMuted shrink-0" />
                    </button>
                  </li>
                ))}
                {pulseQ.isLoading && (
                  <li className="h-10 animate-pulse bg-stone-100 rounded-xl" />
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Students by class */}
        <Card className="lg:col-span-1 border-border rounded-2xl shadow-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-textPrimary">Students by class</h2>
              <Button variant="ghost" size="sm" className="text-primary" onClick={() => router.push("/dashboard/modules/students")}>
                Open
              </Button>
            </div>
            {(pulse?.students?.by_class || []).length === 0 ? (
              <p className="text-sm text-textMuted">
                No class placements yet. Enrol students into grade levels from Academics + Students.
              </p>
            ) : (
              <div className="space-y-2">
                {pulse.students.by_class.map((row: { name: string; count: number }) => {
                  const max = Math.max(...pulse.students.by_class.map((r: { count: number }) => r.count), 1);
                  return (
                    <div key={row.name}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-textPrimary font-medium">{row.name}</span>
                        <span className="text-textMuted">{row.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/80"
                          style={{ width: `${(row.count / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <Card className="lg:col-span-1 border-border rounded-2xl shadow-card">
          <CardContent className="p-5">
            <h2 className="font-semibold text-textPrimary mb-4">Go further</h2>
            <div className="grid gap-2">
              {[
                { label: "Academic structure", href: "/dashboard/modules/academics", icon: GraduationCap },
                { label: "Admissions pipeline", href: "/dashboard/modules/admissions", icon: ClipboardList },
                { label: "Finance & fees", href: "/dashboard/modules/finance", icon: DollarSign },
                { label: "Subjects & catalogue", href: "/dashboard/modules/academics", icon: BookOpen },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => router.push(item.href)}
                  className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm text-left hover:bg-primary-50 hover:border-primary/30 transition-colors"
                >
                  <item.icon className="h-4 w-4 text-primary" />
                  <span className="font-medium text-textPrimary">{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-textMuted ml-auto" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label, value, sub, icon: Icon, onClick, accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof Users;
  onClick?: () => void;
  accent?: "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-2xl border border-border bg-white p-4 shadow-card hover:border-primary/30 transition-all group"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-textMuted uppercase tracking-wide">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-textPrimary mt-1 group-hover:text-primary transition-colors">
            {value}
          </p>
          <p className="text-xs text-textMuted mt-1">{sub}</p>
        </div>
        <div
          className={`p-2 rounded-xl ${
            accent === "secondary" ? "bg-secondary-50 text-secondary" : "bg-primary-50 text-primary"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </button>
  );
}
