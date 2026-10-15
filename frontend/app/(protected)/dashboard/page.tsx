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

export default function DashboardHome() {
  const { currentSchool, loading: schoolLoading } = useCurrentSchool();
  const { user } = useCurrentUser();
  const router = useRouter();

  const pulseQ = useQuery({
    queryKey: ["school-pulse", currentSchool?.id],
    queryFn: fetchSchoolPulse,
    enabled: !!currentSchool?.id,
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  });

  const pulse = pulseQ.data;
  const name =
    user?.full_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.email ||
    "there";

  const currency = pulse?.school?.currency_symbol || currentSchool?.currency_symbol || "KSh";

  // Paint hero immediately; pulse cards show their own loading state
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Hero — explicit colors so heading never washes out */}
      <div
        className="rounded-3xl p-6 sm:p-8 shadow-lg overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, #0F766E 0%, #115E59 45%, #D97706 160%)",
        }}
      >
        <div className="absolute right-0 top-0 w-72 h-72 rounded-full opacity-20 -translate-y-1/3 translate-x-1/4"
          style={{ background: "#F59E0B" }} />
        <div className="relative z-10">
          <p className="text-sm font-semibold tracking-wide" style={{ color: "#CCFBF1" }}>
            School pulse
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight text-white drop-shadow-sm">
            Good to see you, {name.split(" ")[0]}
          </h1>
          <p className="mt-2 max-w-xl text-sm sm:text-base" style={{ color: "#E7E5E4" }}>
            <span className="font-semibold text-white">{currentSchool?.name || "Your school"}</span>
            {" "}— decisions at a glance. No digging through modules.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 items-center">
            {pulse?.academics?.active_year && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
                style={{ background: "rgba(255,255,255,0.2)" }}>
                <CalendarRange className="h-3.5 w-3.5" />
                {pulse.academics.active_year.name}
                {pulse.academics.current_term ? ` · ${pulse.academics.current_term.name}` : ""}
              </span>
            )}
            {typeof pulse?.readiness_score === "number" && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
                style={{ background: "#D97706" }}>
                <Sparkles className="h-3.5 w-3.5" />
                Structure {pulse.readiness_score}% ready
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Colorful KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Active students"
          value={pulseQ.isLoading ? "…" : String(pulse?.students?.active ?? 0)}
          sub={`${pulse?.students?.total ?? 0} total records`}
          icon={Users}
          tone="teal"
          onClick={() => router.push("/dashboard/modules/students")}
        />
        <Kpi
          label="Collected this month"
          value={pulseQ.isLoading ? "…" : `${currency} ${Number(pulse?.finance?.collected_month || 0).toLocaleString()}`}
          sub={`${pulse?.finance?.collection_rate ?? 0}% collection rate · ${pulse?.finance?.overdue_invoices ?? 0} overdue`}
          icon={DollarSign}
          tone="amber"
          onClick={() => router.push("/dashboard/modules/finance")}
        />
        <Kpi
          label="Fees outstanding"
          value={pulseQ.isLoading ? "…" : `${currency} ${Number(pulse?.finance?.outstanding || 0).toLocaleString()}`}
          sub={`${currency} ${Number(pulse?.finance?.overdue_balance || 0).toLocaleString()} overdue balance`}
          icon={TrendingUp}
          tone="coral"
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
          tone="slate"
          onClick={() => router.push("/dashboard/modules/admissions")}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-0 rounded-2xl shadow-md overflow-hidden"
          style={{ background: "linear-gradient(180deg, #FFFBEB 0%, #FFFFFF 40%)" }}>
          <CardContent className="p-5">
            <h2 className="font-semibold text-stone-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: "#D97706" }} />
              What needs attention
            </h2>
            <p className="text-xs text-stone-500 mt-1 mb-4">Guided setup — not a blank system.</p>
            {(pulse?.gaps || []).length === 0 && !pulseQ.isLoading ? (
              <p className="text-sm font-medium rounded-xl p-3" style={{ background: "#F0FDFA", color: "#0F766E" }}>
                Structure looks solid. Ready for day-to-day operations.
              </p>
            ) : (
              <ul className="space-y-2">
                {(pulse?.gaps || []).map((g: { code: string; label: string; href: string }) => (
                  <li key={g.code}>
                    <button
                      onClick={() => router.push(g.href)}
                      className="w-full text-left flex items-center justify-between gap-2 rounded-xl border border-amber-100 bg-white px-3 py-2.5 text-sm hover:border-amber-300 transition-colors"
                    >
                      <span className="text-stone-800">{g.label}</span>
                      <ChevronRight className="h-4 w-4 text-stone-400 shrink-0" />
                    </button>
                  </li>
                ))}
                {pulseQ.isLoading && <li className="h-10 animate-pulse bg-stone-100 rounded-xl" />}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 border-0 rounded-2xl shadow-md overflow-hidden"
          style={{ background: "linear-gradient(180deg, #F0FDFA 0%, #FFFFFF 40%)" }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-stone-900">Students by class</h2>
              <Button variant="ghost" size="sm" className="text-teal-800" onClick={() => router.push("/dashboard/modules/students")}>
                Open
              </Button>
            </div>
            {(pulse?.students?.by_class || []).length === 0 ? (
              <p className="text-sm text-stone-500">
                No class placements yet. Adopt a curriculum, then enrol students into grades.
              </p>
            ) : (
              <div className="space-y-2">
                {pulse.students.by_class.map((row: { name: string; count: number }) => {
                  const max = Math.max(...pulse.students.by_class.map((r: { count: number }) => r.count), 1);
                  return (
                    <div key={row.name}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-stone-800 font-medium">{row.name}</span>
                        <span className="text-stone-500">{row.count}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-teal-50 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(row.count / max) * 100}%`, background: "#0F766E" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 border-0 rounded-2xl shadow-md overflow-hidden"
          style={{ background: "linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 45%)" }}>
          <CardContent className="p-5">
            <h2 className="font-semibold text-stone-900 mb-4">Go further</h2>
            <div className="grid gap-2">
              {[
                { label: "Academic structure", href: "/dashboard/modules/academics", icon: GraduationCap, color: "#0F766E" },
                { label: "Admissions pipeline", href: "/dashboard/modules/admissions", icon: ClipboardList, color: "#EA580C" },
                { label: "Finance & fees", href: "/dashboard/modules/finance", icon: DollarSign, color: "#D97706" },
                { label: "Subjects catalogue", href: "/dashboard/modules/academics", icon: BookOpen, color: "#0D9488" },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => router.push(item.href)}
                  className="flex items-center gap-3 rounded-xl border border-stone-100 bg-white px-3 py-2.5 text-sm text-left hover:shadow-sm transition-all"
                >
                  <span className="p-1.5 rounded-lg" style={{ background: `${item.color}18`, color: item.color }}>
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="font-medium text-stone-800">{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-stone-400 ml-auto" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const TONES: Record<string, { bg: string; icon: string; bar: string }> = {
  teal: { bg: "linear-gradient(145deg, #F0FDFA, #FFFFFF)", icon: "#0F766E", bar: "#0F766E" },
  amber: { bg: "linear-gradient(145deg, #FFFBEB, #FFFFFF)", icon: "#D97706", bar: "#D97706" },
  coral: { bg: "linear-gradient(145deg, #FFF7ED, #FFFFFF)", icon: "#EA580C", bar: "#EA580C" },
  slate: { bg: "linear-gradient(145deg, #F5F5F4, #FFFFFF)", icon: "#57534E", bar: "#78716C" },
};

function Kpi({
  label, value, sub, icon: Icon, onClick, tone = "teal",
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof Users;
  onClick?: () => void;
  tone?: keyof typeof TONES;
}) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-2xl border border-stone-100 p-4 shadow-md hover:shadow-lg transition-all group"
      style={{ background: t.bg }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-stone-900 mt-1 group-hover:opacity-90">
            {value}
          </p>
          <p className="text-xs text-stone-500 mt-1">{sub}</p>
        </div>
        <div className="p-2.5 rounded-xl text-white" style={{ background: t.icon }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </button>
  );
}
