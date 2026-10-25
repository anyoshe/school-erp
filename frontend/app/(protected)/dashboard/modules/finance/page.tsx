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
  Calendar
} from "lucide-react";
import api from "@/utils/api";
import { toast } from "sonner";
import Link from "next/link";
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

function FinanceNavLinks() {
  const links = [
    { href: "/dashboard/modules/finance/clearance", label: "Clearance" },
    { href: "/dashboard/modules/finance/payments", label: "Record payment" },
    { href: "/dashboard/modules/finance/receipts", label: "Receipts" },
    { href: "/dashboard/modules/finance/invoices", label: "Invoices" },
    { href: "/dashboard/modules/finance/fee-structures", label: "Fee structures" },
    { href: "/dashboard/modules/finance/standing", label: "P&L" },
    { href: "/dashboard/modules/finance/expenses", label: "Expenses" },
    { href: "/dashboard/modules/finance/bills", label: "Bills" },
    { href: "/dashboard/modules/finance/income-receipts", label: "Pre-enroll income" },
  ];
  return (
    <nav className="mb-5 flex flex-wrap items-center justify-end gap-1 sm:gap-1.5">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 shadow-sm hover:border-teal-600/40 hover:bg-teal-50 hover:text-teal-900 transition no-underline"
        >
          {l.label}
        </Link>
      ))}
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
      } else {
        toast.error("Failed to load finance dashboard");
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

      {/* Itemized Revenue by Fee Group */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Money by fee group</CardTitle>
          <p className="text-xs text-muted-foreground font-normal">
            Interview & admission income, plus term collections (tuition and other items) for the selected period.
          </p>
        </CardHeader>
        <CardContent>
          {feeItemTotals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No collections or invoices in this period yet.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {feeItemTotals.map((item) => (
                <div
                  key={item.groupKey}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <p className="font-semibold text-sm text-slate-900">{item.description}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Collected</p>
                      <p className="font-semibold text-emerald-700 tabular-nums">
                        {currency} {Number(item.allocated || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pending</p>
                      <p className="font-semibold text-amber-700 tabular-nums">
                        {currency} {Number(item.pending || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {Number(item.total || 0) > 0 ? (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Billed {currency} {Number(item.total).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Secondary actions not in top nav */}
      <div className="flex flex-wrap gap-2">
        {[
          { href: "/dashboard/modules/finance/payment-plans", label: "Payment plans" },
          { href: "/dashboard/modules/finance/student-assignments", label: "Assign fees" },
          { href: "/dashboard/modules/finance/post-balances", label: "Post balances" },
          { href: "/dashboard/modules/finance/statements", label: "Statements" },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:border-teal-600/40 hover:bg-teal-50 hover:text-teal-900 transition no-underline"
          >
            {action.label}
          </Link>
        ))}
      </div>

      {/* Quick Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 className="font-semibold mb-4">Financial Health</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total Billed:</span><span>{currency} {stats.totalAssigned.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Admission Payments:</span><span className="text-primary-700">{currency} {stats.totalAdmissionPayments.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Received:</span><span className="text-secondary-600 font-medium">{currency} {stats.totalRevenue.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Outstanding:</span><span className="text-amber-600">{currency} {stats.totalOutstanding.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Overdue:</span><span className="text-red-600">{currency} {stats.overdueBalance.toLocaleString()}</span></div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Workflow Checklist</h4>
            <div className="space-y-3 text-sm">
              {[
                "Fee structures created",
                "Payment plans defined",
                "Students assigned fees",
                "Invoices auto-generated",
                "Payments tracked"
              ].map((item, i) => (
                <label key={i} className="flex items-center gap-2">
                  <input type="checkbox" disabled checked className="accent-secondary" />
                  <span>✓ {item}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
