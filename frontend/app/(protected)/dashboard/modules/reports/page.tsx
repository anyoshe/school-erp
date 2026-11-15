"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import api from "@/utils/api";
import { RiskAttentionCard } from "../../components/RiskAttentionCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

function money(v?: number | string | null) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return "—";
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function ReportsPage() {
  const { currentSchool } = useCurrentSchool();
  const [loading, setLoading] = useState(true);
  const [finance, setFinance] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [payroll, setPayroll] = useState<any>(null);

  const load = useCallback(async () => {
    if (!currentSchool?.id) return;
    setLoading(true);
    const headers = { "X-School-ID": String(currentSchool.id) };
    try {
      const [f, a, p] = await Promise.all([
        api.get("/finance/dashboard-summary/", { headers }).catch(() => ({ data: null })),
        api.get("/attendance/summary/", { headers }).catch(() =>
          api.get("/attendance/daily-summary/", { headers }).catch(() => ({ data: null }))
        ),
        api.get("/staff/payroll/", { headers, params: { limit: 20 } }).catch(() => ({ data: null })),
      ]);
      setFinance(f.data);
      setAttendance(a.data);
      const plist = Array.isArray(p.data) ? p.data : p.data?.results || [];
      setPayroll(plist);
    } finally {
      setLoading(false);
    }
  }, [currentSchool?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = finance?.stats || finance || {};
  const collected = stats.totalCollected ?? stats.collected ?? stats.total_collected;
  const invoiced = stats.totalInvoiced ?? stats.total_invoiced ?? stats.totalBilled;
  const outstanding = stats.totalOutstanding ?? stats.outstanding ?? stats.total_outstanding;
  const rate = stats.collectionRate ?? stats.collection_rate;

  const byGroup = finance?.revenueByFeeGroup || finance?.fee_groups || finance?.by_fee_group || [];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports &amp; Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Owner snapshot — collections, risks, attendance and payroll. Export detail from each module.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1">Refresh</span>
        </Button>
      </div>

      <RiskAttentionCard />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Collected</p>
            <p className="text-xl font-semibold tabular-nums">{loading ? "…" : money(collected)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Invoiced</p>
            <p className="text-xl font-semibold tabular-nums">{loading ? "…" : money(invoiced)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-xl font-semibold tabular-nums">{loading ? "…" : money(outstanding)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Collection rate</p>
            <p className="text-xl font-semibold tabular-nums">
              {loading
                ? "…"
                : rate != null
                  ? `${Number(rate).toFixed(1)}%`
                  : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {Array.isArray(byGroup) && byGroup.length > 0 ? (
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Money by fee group</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {byGroup.map((g: any, i: number) => (
              <div key={i} className="rounded-lg border px-3 py-2 text-sm">
                <p className="font-medium">{g.name || g.label || g.group || "Group"}</p>
                <p className="text-xs text-muted-foreground">
                  Collected {money(g.collected ?? g.collected_amount)} · Pending{" "}
                  {money(g.pending ?? g.pending_balance)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Attendance</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {attendance ? (
              <pre className="text-xs whitespace-pre-wrap bg-slate-50 rounded-lg p-3 overflow-auto max-h-40">
                {JSON.stringify(attendance, null, 2).slice(0, 800)}
              </pre>
            ) : (
              <p>
                Open Attendance for class % reports.{" "}
                <Link className="text-primary underline" href="/dashboard/modules/attendance">
                  Go to attendance
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent payroll rows</CardTitle>
          </CardHeader>
          <CardContent>
            {!payroll?.length ? (
              <p className="text-sm text-muted-foreground">
                No payroll rows.{" "}
                <Link className="text-primary underline" href="/dashboard/modules/hr">
                  HR → Payroll
                </Link>
              </p>
            ) : (
              <ul className="text-sm space-y-1">
                {payroll.slice(0, 8).map((r: any) => (
                  <li key={r.id} className="flex justify-between border-b border-slate-100 py-1">
                    <span>
                      {r.staff_name || r.staff?.full_name || "Staff"} ·{" "}
                      {String(r.month || "").slice(0, 7)}
                    </span>
                    <span className="tabular-nums">{money(r.net_pay ?? r.basic_salary)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Deep links</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {[
            {
              href: "/dashboard/modules/finance",
              title: "Finance standing & payments",
              sub: "Collections, clearance, expenses, reconcile",
            },
            {
              href: "/dashboard/modules/finance/statements",
              title: "Student fee statements",
              sub: "Balances and payment history",
            },
            {
              href: "/dashboard/modules/academics",
              title: "Marks & report cards",
              sub: "Markbooks, CSV, print forms",
            },
            {
              href: "/dashboard/modules/attendance",
              title: "Attendance",
              sub: "Daily register and absence patterns",
            },
            {
              href: "/dashboard/modules/library",
              title: "Library",
              sub: "Overdues, stock, digital resources",
            },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/40 transition"
            >
              <span>
                <span className="font-medium block">{l.title}</span>
                <span className="text-xs text-muted-foreground">{l.sub}</span>
              </span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
