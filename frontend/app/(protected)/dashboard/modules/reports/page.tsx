"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import api from "@/utils/api";
import { RiskAttentionCard } from "../../components/RiskAttentionCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3,
  Wallet,
  Users,
  ClipboardList,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Loader2,
} from "lucide-react";

type DashStats = {
  total_collected?: number;
  total_invoiced?: number;
  outstanding?: number;
  collection_rate?: number;
  students_with_balance?: number;
  [key: string]: unknown;
};

function money(v?: number | string | null) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return "—";
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function ReportsPage() {
  const { currentSchool } = useCurrentSchool();
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentSchool?.id) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get("/finance/dashboard-summary/", {
        headers: { "X-School-ID": String(currentSchool.id) },
      });
      const data = res.data || {};
      setStats(data.stats || data || {});
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Could not load finance summary");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [currentSchool?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const collected =
    stats?.total_collected ?? stats?.collected ?? stats?.received ?? 0;
  const invoiced = stats?.total_invoiced ?? stats?.total_billed ?? 0;
  const outstanding = stats?.outstanding ?? stats?.outstanding_balance ?? 0;
  const rate = stats?.collection_rate;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-textPrimary tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            Reports & Analytics
          </h1>
          <p className="text-textMuted mt-1 text-sm">
            Collections, balances and operational risks for{" "}
            {currentSchool?.name || "your school"}.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Refresh
        </Button>
      </div>

      {/* Money pulse */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Collected", value: money(collected as number), icon: Wallet },
          { label: "Total invoiced", value: money(invoiced as number), icon: ClipboardList },
          { label: "Outstanding", value: money(outstanding as number), icon: AlertTriangle },
          {
            label: "Collection rate",
            value:
              rate != null
                ? `${Number(rate).toFixed(1)}%`
                : invoiced
                  ? `${((Number(collected) / Number(invoiced)) * 100).toFixed(1)}%`
                  : "—",
            icon: Users,
          },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border shadow-sm rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Icon className="h-3.5 w-3.5" /> {label}
              </div>
              <p className="text-xl font-semibold tabular-nums">
                {loading ? "…" : value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}

      {/* Risk digest */}
      <RiskAttentionCard />

      {/* Quick reports */}
      <Card className="border shadow-sm rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Operational reports</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <Link
            href="/dashboard/modules/finance"
            className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/40 transition"
          >
            <span>
              <span className="font-medium block">Finance dashboard</span>
              <span className="text-xs text-muted-foreground">
                Collections by term, fee groups, P&amp;L
              </span>
            </span>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            href="/dashboard/modules/finance/clearance"
            className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/40 transition"
          >
            <span>
              <span className="font-medium block">Clearance queue</span>
              <span className="text-xs text-muted-foreground">
                Learners awaiting fee clearance
              </span>
            </span>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            href="/dashboard/modules/academics"
            className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/40 transition"
          >
            <span>
              <span className="font-medium block">Marks &amp; report cards</span>
              <span className="text-xs text-muted-foreground">
                Class markbooks, CSV import/export, print forms
              </span>
            </span>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            href="/dashboard/modules/attendance"
            className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/40 transition"
          >
            <span>
              <span className="font-medium block">Attendance reports</span>
              <span className="text-xs text-muted-foreground">
                Daily register and absence patterns
              </span>
            </span>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
