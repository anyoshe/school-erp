"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RiskAlert = {
  id: string;
  category: string;
  severity: string;
  title: string;
  detail: string;
  action_path?: string;
  student?: { id: string; name: string; admission_number?: string } | null;
};

type RiskToday = {
  counts?: { open?: number; fee?: number; high?: number };
  alerts?: RiskAlert[];
};

const severityStyle: Record<string, string> = {
  HIGH: "bg-red-50 text-red-800 border-red-200",
  MEDIUM: "bg-amber-50 text-amber-900 border-amber-200",
  LOW: "bg-slate-50 text-slate-700 border-slate-200",
};

export function RiskAttentionCard() {
  const { currentSchool } = useCurrentSchool();
  const router = useRouter();
  const [data, setData] = useState<RiskToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = true) => {
      if (!currentSchool?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<RiskToday>("/risks/today/", {
          params: { limit: 8, refresh: refresh ? "1" : "0" },
          headers: { "X-School-ID": String(currentSchool.id) },
          timeout: 20000,
        });
        setData(res.data);
      } catch (e: any) {
        setError(e?.response?.data?.detail || "Could not load risk alerts");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [currentSchool?.id]
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  const alerts = data?.alerts || [];
  const open = data?.counts?.open ?? alerts.length;
  const high = data?.counts?.high ?? 0;

  return (
    <Card className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-white to-white shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base md:text-lg flex items-center gap-2 text-amber-950">
            <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0" />
            Needs attention today
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Early warnings — fee default risk first. Act before term-end pressure.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={loading}
          onClick={() => load(true)}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border bg-white px-2.5 py-1 font-medium">
            {open} open
          </span>
          <span className="rounded-full border border-red-200 bg-red-50 text-red-800 px-2.5 py-1 font-medium">
            {high} high
          </span>
          <span className="rounded-full border bg-white px-2.5 py-1 text-muted-foreground">
            Fee risks: {data?.counts?.fee ?? 0}
          </span>
        </div>

        {loading && !data ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Scanning fee risks…
          </p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : alerts.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900">
            No open fee risks right now. Keep recording payments — we&apos;ll flag overdue and mid-term lags automatically.
          </div>
        ) : (
          <ul className="space-y-2">
            {alerts.slice(0, 6).map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => router.push(a.action_path || "/dashboard/modules/finance")}
                  className={`w-full text-left rounded-xl border px-3 py-2.5 transition hover:shadow-sm ${
                    severityStyle[a.severity] || severityStyle.LOW
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 opacity-80" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">
                          {a.severity}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide opacity-70">{a.category}</span>
                      </div>
                      <p className="font-semibold text-sm leading-snug mt-0.5">{a.title}</p>
                      <p className="text-xs opacity-80 line-clamp-2 mt-0.5">{a.detail}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => router.push("/dashboard/modules/finance")}
          >
            Open finance
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => router.push("/dashboard/modules/finance/payments")}
          >
            Record payment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
