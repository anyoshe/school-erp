"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  FileText,
  Users,
  BarChart2,
  TrendingUp,
  Calendar,
  CreditCard,
  ClipboardList,
  Scale,
  ScrollText,
  Menu,
  X,
} from "lucide-react";
import api from "@/utils/api";
import { toast } from "sonner";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";

interface FeeItemTotal {
  groupKey: string;
  description: string;
  allocated: number;
  pending: number;
  total: number;
  isTuition: boolean;
}

interface Stats {
  totalOutstanding: number;
  totalAssigned: number;
  totalRevenue: number;
  totalStudentsWithFees: number;
  studentsWithBalance: number;
  overdueBalance: number;
  pendingInvoices: number;
  totalInvoiced: number;
  totalAdmissionPayments: number;
}

interface RevenueByPeriod {
  all: number;
  year: number;
  term: number;
  session: number;
}

interface DashboardSummaryResponse {
  stats: Stats & {
    yearCollected?: number;
    yearInvoiced?: number;
    allTimeCollected?: number;
  };
  revenueByPeriod: RevenueByPeriod;
  detectedTerm: string;
  detectedYear: string;
  availableTerms?: string[];
  availableYears?: string[];
  isCurrentTerm?: boolean;
  feeGroupBreakdown: FeeItemTotal[];
}


/** Prefer 3–4 columns so fee-group cards fill balanced rows. */
function balancedFeeGroupColumns(count: number): number {
  if (count <= 1) return 1;
  if (count === 2) return 2;
  // Prefer exact divisors in the 3–4 range first
  for (const c of [4, 3, 5, 2]) {
    if (count % c === 0 && c <= 4) return c;
  }
  for (const c of [4, 3]) {
    if (count % c === 0) return c;
  }
  // Minimize leftover cards on the last row
  let best = 3;
  let bestScore = 999;
  for (let c = 2; c <= 4; c++) {
    const rem = count % c;
    const score = rem === 0 ? 0 : c - rem;
    if (score < bestScore || (score === bestScore && c > best)) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

const FINANCE_NAV_LINKS = [
  { href: "/dashboard/modules/finance/clearance", label: "Clearance" },
  { href: "/dashboard/modules/finance/payments", label: "Record payment" },
  { href: "/dashboard/modules/finance/receipts", label: "Receipts" },
  { href: "/dashboard/modules/finance/invoices", label: "Invoices" },
  { href: "/dashboard/modules/finance/fee-structures", label: "Fee structures" },
  { href: "/dashboard/modules/finance/standing", label: "P&L" },
  { href: "/dashboard/modules/finance/expenses", label: "Expenses" },
  { href: "/dashboard/modules/finance/bills", label: "Bills" },
  { href: "/dashboard/modules/finance/income-receipts", label: "Pre-enroll income" },
] as const;

function FinanceNavLinks() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const linkClass = (href: string) => {
    const active =
      pathname === href ||
      (href !== "/dashboard/modules/finance" && pathname?.startsWith(href));
    return [
      "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition no-underline",
      active
        ? "bg-teal-700 text-white shadow-sm"
        : "text-slate-700 hover:bg-teal-50 hover:text-teal-900",
    ].join(" ");
  };

  return (
    <nav className="mb-5 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
            Finance
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            Collect · bill · report
          </p>
        </div>

        {/* Desktop / tablet horizontal nav */}
        <div className="hidden md:flex flex-wrap items-center justify-end gap-1">
          {FINANCE_NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-800 hover:bg-teal-50 hover:text-teal-900"
          aria-label={open ? "Close finance menu" : "Open finance menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer panel */}
      {open ? (
        <div className="md:hidden border-t border-slate-100 bg-slate-50/80 px-2 py-2">
          <ul className="flex flex-col gap-0.5">
            {FINANCE_NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`block ${linkClass(l.href)}`}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}

export default function FinanceDashboard() {
  const { currentSchool } = useCurrentSchool();
  const currency = currentSchool?.currency_symbol || currentSchool?.currency || "KES";
  const [stats, setStats] = useState<Stats>({
    totalOutstanding: 0,
    totalAssigned: 0,
    totalRevenue: 0,
    totalStudentsWithFees: 0,
    studentsWithBalance: 0,
    overdueBalance: 0,
    pendingInvoices: 0,
    totalInvoiced: 0,
    totalAdmissionPayments: 0,
  });

  const [revenueByPeriod, setRevenueByPeriod] = useState<RevenueByPeriod>({
    all: 0,
    year: 0,
    term: 0,
    session: 0,
  });

  const [feeItemTotals, setFeeItemTotals] = useState<FeeItemTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [detectedTerm, setDetectedTerm] = useState<string>("Term 1");
  const [detectedYear, setDetectedYear] = useState<string>("2026");
  const [filterTerm, setFilterTerm] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [availableTerms, setAvailableTerms] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [yearCollected, setYearCollected] = useState(0);
  const [allTimeCollected, setAllTimeCollected] = useState(0);

  const fetchDashboardData = useCallback(async () => {
    const params: Record<string, string> = {};
    if (filterTerm) params.term = filterTerm;
    if (filterYear) params.academic_year = filterYear;
    const cacheKey = `erp_finance_summary_${currentSchool?.id || "x"}_${filterTerm || "auto"}_${filterYear || "auto"}`;

    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const { at, data } = JSON.parse(raw);
        if (Date.now() - at < 45_000 && data?.stats) {
          setStats(data.stats);
          setRevenueByPeriod(data.revenueByPeriod || revenueByPeriod);
          setDetectedTerm(data.detectedTerm || "Term 1");
          setDetectedYear(data.detectedYear || new Date().getFullYear().toString());
          setAvailableTerms(data.availableTerms || []);
          setAvailableYears(data.availableYears || []);
          setYearCollected(Number(data.stats?.yearCollected || data.revenueByPeriod?.year || 0));
          setAllTimeCollected(Number(data.stats?.allTimeCollected || data.revenueByPeriod?.all || 0));
          setFeeItemTotals(data.feeGroupBreakdown || []);
          setLoading(false);
        }
      }
    } catch { /* */ }

    setLoading(true);
    try {
      const response = await api.get<DashboardSummaryResponse>("/finance/dashboard-summary/", {
        params,
        headers: currentSchool?.id ? { "X-School-ID": String(currentSchool.id) } : undefined,
      });
      const data = response.data;
      setStats(data.stats);
      setRevenueByPeriod(data.revenueByPeriod);
      setDetectedTerm(data.detectedTerm || "Term 1");
      setDetectedYear(data.detectedYear || new Date().getFullYear().toString());
      setAvailableTerms(data.availableTerms || []);
      setAvailableYears(data.availableYears || []);
      setYearCollected(Number(data.stats?.yearCollected || data.revenueByPeriod?.year || 0));
      setAllTimeCollected(Number(data.stats?.allTimeCollected || data.revenueByPeriod?.all || 0));
      setFeeItemTotals(data.feeGroupBreakdown || []);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data }));
      } catch { /* */ }
    } catch (error: any) {
      console.error("Failed to fetch dashboard data:", error);
      const status = error?.response?.status;
      if (status === 401) {
        // interceptor will refresh or redirect
      } else if (!error?.response) {
        toast.error(
          "Cannot reach finance API. Is the backend running? Try: python manage.py migrate finance"
        );
      } else {
        toast.error(
          error?.response?.data?.detail ||
            `Finance dashboard failed (${status || "error"})`
        );
      }
    } finally {
      setLoading(false);
    }
  }, [currentSchool?.id, filterTerm, filterYear]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const collectionRate = useCallback(() => {
    return stats.totalAssigned > 0
      ? ((stats.totalRevenue / stats.totalAssigned) * 100).toFixed(1)
      : "0";
  }, [stats.totalRevenue, stats.totalAssigned]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <FinanceNavLinks />
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-3 shadow-sm">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Academic year</p>
          <select
            className="h-9 rounded-md border px-3 text-sm min-w-[120px]"
            value={filterYear || detectedYear}
            onChange={(e) => setFilterYear(e.target.value)}
          >
            {Array.from(new Set(availableYears.length ? availableYears : [detectedYear].filter(Boolean))).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Term</p>
          <select
            className="h-9 rounded-md border px-3 text-sm min-w-[140px]"
            value={filterTerm || detectedTerm}
            onChange={(e) => setFilterTerm(e.target.value)}
          >
            {Array.from(
              new Set(
                availableTerms.length
                  ? availableTerms
                  : [detectedTerm, "Term 1", "Term 2", "Term 3"].filter(Boolean)
              )
            ).map((term) => (
              <option key={term} value={term}>{term}</option>
            ))}
          </select>
        </div>
        <p className="text-sm text-muted-foreground pb-1">
          Showing <span className="font-semibold text-foreground">{filterTerm || detectedTerm}</span>
          {" · "}
          <span className="font-semibold text-foreground">{filterYear || detectedYear}</span>
          {" "}collections & balances
        </p>
      </div>

      {/* Owner-facing hero */}
      <div
        className="rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0F766E 0%, #115E59 40%, #D97706 130%)" }}
      >
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <p className="text-sm font-semibold" style={{ color: "#CCFBF1" }}>Money pulse</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1 tracking-tight">Finance</h1>
            <p className="text-sm mt-2 max-w-xl" style={{ color: "#E7E5E4" }}>
              {currentSchool?.name || "Your school"} — collected vs outstanding at a glance.
              Assign fees, generate invoices, and record payments without digging.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-[260px]">
            <div className="rounded-2xl bg-white/15 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#FDE68A" }}>Collected</p>
              <p className="text-xl font-bold text-white mt-1">
                {loading ? "…" : `${currency} ${stats.totalRevenue.toLocaleString()}`}
              </p>
            </div>
            <div className="rounded-2xl bg-white/15 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#CCFBF1" }}>Collection rate</p>
              <p className="text-xl font-bold text-white mt-1">
                {loading ? "…" : `${collectionRate()}%`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {loading ? "Loading..." : `${currency} ${stats.totalOutstanding.toLocaleString()}`}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.pendingInvoices} pending invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Balance</CardTitle>
            <FileText className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {loading ? "Loading..." : `${currency} ${stats.overdueBalance.toLocaleString()}`}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Past due date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary-600">
              {loading ? "Loading..." : `${collectionRate()}%`}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Of total invoiced</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students With Balance</CardTitle>
            <Users className="h-4 w-4 text-primary-700" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary-700">
              {loading ? "Loading..." : stats.studentsWithBalance}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Students with outstanding balances</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
            <BarChart2 className="h-4 w-4 text-primary-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary-600">
              {loading ? "Loading..." : `${currency} ${stats.totalInvoiced.toLocaleString()}`}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Total billing amount</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admission Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-600">
              {loading ? "Loading..." : `${currency} ${stats.totalAdmissionPayments.toLocaleString()}`}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Included in total revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown by Period */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Revenue Breakdown by Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: `${detectedTerm} · ${detectedYear}`, value: revenueByPeriod.term },
              { label: `Full year ${detectedYear}`, value: yearCollected || revenueByPeriod.year },
              { label: "All time", value: allTimeCollected || revenueByPeriod.all },
            ].map((period, i) => (
              <div key={i} className="bg-secondary-50 dark:bg-secondary-950/70 p-5 rounded-xl border border-secondary-100 dark:border-secondary-900">
                <p className="text-sm text-muted-foreground">{period.label}</p>
                <p className="text-3xl font-bold mt-3 text-secondary-600">
                  {currency} {period.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Defaults to the current academic term. Change year/term above to compare collections and balances.
          </p>
        </CardContent>
      </Card>

      {/* Money by fee group — dynamic from structure items */}
      <Card className="border-slate-200/80 shadow-sm overflow-hidden">
        <CardHeader className="pb-2 border-b bg-gradient-to-r from-teal-50/80 to-white">
          <CardTitle className="text-base text-teal-950">Money by fee group</CardTitle>
          <p className="text-xs text-muted-foreground font-normal">
            Built from your fee structure items, plus interview and admission fees. Period:{" "}
            <span className="font-medium text-foreground">
              {filterTerm || detectedTerm} · {filterYear || detectedYear}
            </span>
            .
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          {feeItemTotals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No fee items yet. Create fee structures (and optional interview/admission fees) to populate this section.
            </p>
          ) : (
            (() => {
              const cols = balancedFeeGroupColumns(feeItemTotals.length);
              const mdClass =
                cols <= 1
                  ? "md:grid-cols-1"
                  : cols === 2
                    ? "md:grid-cols-2"
                    : cols === 3
                      ? "md:grid-cols-3"
                      : cols === 4
                        ? "md:grid-cols-4"
                        : "md:grid-cols-3";
              return (
            <div className={`grid grid-cols-2 ${mdClass} gap-3`}>
              {feeItemTotals.map((item) => {
                const d = (item.description || "").toLowerCase();
                const tone = d.includes("interview")
                  ? "from-violet-50 border-violet-300"
                  : d.includes("admission") || d.includes("registration")
                    ? "from-sky-50 border-sky-300"
                    : item.isTuition || d.includes("tuition")
                      ? "from-teal-50 border-teal-300"
                      : "from-slate-50 border-slate-300";
                return (
                  <div
                    key={item.groupKey}
                    className={`rounded-xl border-2 bg-gradient-to-br ${tone} to-white p-3 min-h-[110px] flex flex-col shadow-sm`}
                  >
                    <p className="font-semibold text-sm text-slate-900 leading-tight">
                      {item.description}
                    </p>
                    <div className="mt-auto pt-3 space-y-1">
                      <div className="flex justify-between text-xs gap-2">
                        <span className="text-muted-foreground">Collected</span>
                        <span className="font-semibold text-emerald-800 tabular-nums">
                          {currency} {Number(item.allocated || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs gap-2">
                        <span className="text-muted-foreground">Pending</span>
                        <span className="font-semibold text-amber-800 tabular-nums">
                          {currency} {Number(item.pending || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
              );
            })()
          )}
        </CardContent>
      </Card>

      {/* Supporting tools — distinct jobs, not nav duplicates */}
      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-2">Supporting tools</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Optional setup and reporting. Day-to-day collect &amp; print lives in the top nav (Clearance, Record payment, Receipts).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              href: "/dashboard/modules/finance/payment-plans",
              label: "Payment plans",
              desc: "Define installments (e.g. 50/50 or monthly) applied when billing students.",
              icon: CreditCard,
              ring: "border-teal-200 bg-teal-50/50 hover:bg-teal-50",
              iconBg: "bg-teal-600",
            },
            {
              href: "/dashboard/modules/finance/student-assignments",
              label: "Assign fee structures",
              desc: "Link a student to a grade/term fee structure so invoices can be generated.",
              icon: ClipboardList,
              ring: "border-amber-200 bg-amber-50/50 hover:bg-amber-50",
              iconBg: "bg-amber-600",
            },
            {
              href: "/dashboard/modules/finance/post-balances",
              label: "Opening balances",
              desc: "Carry forward prior-term arrears when students join mid-year or migrate from paper books.",
              icon: Scale,
              ring: "border-violet-200 bg-violet-50/50 hover:bg-violet-50",
              iconBg: "bg-violet-600",
            },
            {
              href: "/dashboard/modules/finance/statements",
              label: "Student statements",
              desc: "Printable ledger of billed vs paid for a learner — for parents and clearance.",
              icon: ScrollText,
              ring: "border-sky-200 bg-sky-50/50 hover:bg-sky-50",
              iconBg: "bg-sky-600",
            },
          ].map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className={`group rounded-xl border-2 p-4 shadow-sm transition no-underline text-left ${tool.ring}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${tool.iconBg}`}
                >
                  <tool.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-900 group-hover:text-teal-900">
                    {tool.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {tool.desc}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Compact period snapshot */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Period snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {[
              { label: "Billed", value: stats.totalInvoiced, color: "text-slate-800" },
              { label: "Received", value: stats.totalRevenue, color: "text-emerald-700" },
              { label: "Outstanding", value: stats.totalOutstanding, color: "text-amber-700" },
              { label: "Overdue", value: stats.overdueBalance, color: "text-red-700" },
            ].map((row) => (
              <div key={row.label} className="rounded-lg border bg-slate-50/80 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{row.label}</p>
                <p className={`text-lg font-bold tabular-nums ${row.color}`}>
                  {loading ? "…" : `${currency} ${Number(row.value || 0).toLocaleString()}`}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
