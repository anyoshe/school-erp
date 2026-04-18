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
  stats: Stats;
  revenueByPeriod: RevenueByPeriod;
  detectedTerm: string;
  detectedYear: string;
  feeGroupBreakdown: FeeItemTotal[];
}

export default function FinanceDashboard() {
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

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<DashboardSummaryResponse>("/finance/dashboard-summary/");
      const data = response.data;
      setStats(data.stats);
      setRevenueByPeriod(data.revenueByPeriod);
      setDetectedTerm(data.detectedTerm || "Term 1");
      setDetectedYear(data.detectedYear || new Date().getFullYear().toString());
      setFeeItemTotals(data.feeGroupBreakdown || []);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      toast.error("Failed to load finance dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const collectionRate = useCallback(() => {
    return stats.totalAssigned > 0
      ? ((stats.totalRevenue / stats.totalAssigned) * 100).toFixed(1)
      : "0";
  }, [stats.totalRevenue, stats.totalAssigned]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Finance Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Real-time overview of all school revenue and financial health
        </p>
      </div>

      {/* Total Revenue Collected So Far */}
      <Card className="border-green-600 bg-green-50/80 dark:bg-green-950/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl">Total Revenue Collected So Far</CardTitle>
          <TrendingUp className="h-6 w-6 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-5xl font-bold text-green-600 tracking-tight">
            {loading ? "..." : `KES ${stats.totalRevenue.toLocaleString()}`}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            All payments received (fees + admission fees)
          </p>
        </CardContent>
      </Card>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {loading ? "Loading..." : `KES ${stats.totalOutstanding.toLocaleString()}`}
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
              {loading ? "Loading..." : `KES ${stats.overdueBalance.toLocaleString()}`}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Past due date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {loading ? "Loading..." : `${collectionRate()}%`}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Of total invoiced</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students With Balance</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {loading ? "Loading..." : stats.studentsWithBalance}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Students with outstanding balances</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
            <BarChart2 className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">
              {loading ? "Loading..." : `KES ${stats.totalInvoiced.toLocaleString()}`}
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
              {loading ? "Loading..." : `KES ${stats.totalAdmissionPayments.toLocaleString()}`}
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
              { label: "This Session", value: revenueByPeriod.session },
              { label: `This Term (${detectedTerm})`, value: revenueByPeriod.term },
              { label: `This Year (${detectedYear})`, value: revenueByPeriod.year },
              { label: "All Time", value: revenueByPeriod.all },
            ].map((period, i) => (
              <div key={i} className="bg-green-50 dark:bg-green-950/70 p-5 rounded-xl border border-green-100 dark:border-green-900">
                <p className="text-sm text-muted-foreground">{period.label}</p>
                <p className="text-3xl font-bold mt-3 text-green-600">
                  KES {period.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Term is automatically detected from your active invoices and fee structures.
          </p>
        </CardContent>
      </Card>

      {/* Itemized Revenue by Fee Group */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue & Pending Balance by Fee Group</CardTitle>
        </CardHeader>
        <CardContent>
          {feeItemTotals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Fee group breakdown is not available yet. Generate invoices with item-level lines or assign student fees for detailed reporting.
            </p>
          ) : (
            <div className="space-y-3">
              {feeItemTotals.map((item) => (
                <div key={item.groupKey} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{item.isTuition ? "Tuition" : "Other fees"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Collected Amount</p>
                      <p className="text-lg font-semibold text-green-600">KES {item.allocated.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Pending Balance</p>
                      <p className="text-lg font-semibold text-amber-600">KES {item.pending.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { href: "/dashboard/modules/finance/fee-structures", label: "Manage Fee Structures", variant: "outline" as const },
          { href: "/dashboard/modules/finance/payment-plans", label: "Manage Payment Plans", variant: "default" as const, className: "bg-indigo-600 hover:bg-indigo-700" },
          { href: "/dashboard/modules/finance/student-assignments", label: "Assign Fees to Students", variant: "outline" as const },
          { href: "/dashboard/modules/finance/invoices", label: "View & Manage Invoices", variant: "outline" as const },
          { href: "/dashboard/modules/finance/payments", label: "Record Payments", variant: "default" as const, className: "bg-green-600 hover:bg-green-700" },
          { href: "/dashboard/modules/finance/post-balances", label: "Post Balances", variant: "default" as const, className: "bg-emerald-600 hover:bg-emerald-700" },
          { href: "/dashboard/modules/finance/receipts", label: "Print Receipts", variant: "outline" as const },
          { href: "/dashboard/modules/finance/reports", label: "View Reports", variant: "outline" as const },
        ].map((btn, i) => (
          <Link key={i} href={btn.href}>
            <Button className={`w-full ${btn.className || ""}`} variant={btn.variant}>
              {btn.label}
            </Button>
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
              <div className="flex justify-between"><span className="text-muted-foreground">Total Billed:</span><span>KES {stats.totalAssigned.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Admission Payments:</span><span className="text-blue-600">KES {stats.totalAdmissionPayments.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Received:</span><span className="text-green-600 font-medium">KES {stats.totalRevenue.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Outstanding:</span><span className="text-amber-600">KES {stats.totalOutstanding.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Overdue:</span><span className="text-red-600">KES {stats.overdueBalance.toLocaleString()}</span></div>
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
                  <input type="checkbox" disabled checked className="accent-green-600" />
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
