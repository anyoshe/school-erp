"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
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
  counts?: {
    open?: number;
    fee?: number;
    attendance?: number;
    academic?: number;
    ops?: number;
    high?: number;
  };
  alerts?: RiskAlert[];
};

const CATEGORY_ROUTES: Record<
  string,
  { href: string; label: string; countKey: keyof NonNullable<RiskToday["counts"]> }
> = {
  FEE: {
    href: "/dashboard/modules/finance",
    label: "Fees",
    countKey: "fee",
  },
  ATTENDANCE: {
    href: "/dashboard/modules/attendance",
    label: "Attendance",
    countKey: "attendance",
  },
  ACADEMIC: {
    href: "/dashboard/modules/academics",
    label: "Learning",
    countKey: "academic",
  },
  OPS: {
    href: "/dashboard/modules/risks",
    label: "Ops",
    countKey: "ops",
  },
};

function categoryHref(category: string, actionPath?: string) {
  if (actionPath) return actionPath;
  const key = (category || "").toUpperCase();
  if (CATEGORY_ROUTES[key]) return CATEGORY_ROUTES[key].href;
  if (key.includes("FEE") || key.includes("FINANCE")) return "/dashboard/modules/finance";
  if (key.includes("ATTEND")) return "/dashboard/modules/attendance";
  if (key.includes("ACADEM") || key.includes("LEARN")) return "/dashboard/modules/academics";
  return "/dashboard/modules/risks";
}

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
          params: { limit: 12, refresh: refresh ? "1" : "0" },
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

  // Top priorities only — full list lives in Risk center
  const topAlerts = [...alerts]
    .sort((a, b) => {
      const rank = (s: string) => (s === "HIGH" ? 0 : s === "MEDIUM" ? 1 : 2);
      return rank(a.severity) - rank(b.severity);
    })
    .slice(0, 3);

  const goRisks = (params?: string) => {
    router.push(params ? `/dashboard/modules/risks${params}` : "/dashboard/modules/risks");
  };

  return (
    <Card className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-white to-white shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle className="text-base md:text-lg flex items-center gap-2 text-amber-950">
            <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0" />
            Needs attention today
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Summary only — open a category or Risk center for the full list.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={loading}
          onClick={() => load(true)}
          aria-label="Refresh"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : loading && !data ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : open === 0 ? (
          <p className="text-sm font-medium rounded-xl p-3 bg-teal-50 text-teal-900">
            Nothing urgent right now. Keep an eye on Risk center for new signals.
          </p>
        ) : (
          <>
            {/* Aggregate chips — click opens module or filtered risk center */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => goRisks("?status=OPEN")}
                className="rounded-full border bg-white px-3 py-1.5 text-xs font-semibold hover:border-amber-400 transition-colors"
              >
                {open} open
              </button>
              {high > 0 && (
                <button
                  type="button"
                  onClick={() => goRisks("?status=OPEN&severity=HIGH")}
                  className="rounded-full border border-red-200 bg-red-50 text-red-800 px-3 py-1.5 text-xs font-semibold hover:bg-red-100 transition-colors"
                >
                  {high} high
                </button>
              )}
              {Object.entries(CATEGORY_ROUTES).map(([key, meta]) => {
                const n = Number(data?.counts?.[meta.countKey] ?? 0);
                if (n <= 0) return null;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => router.push(meta.href)}
                    className="rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-amber-400 hover:bg-amber-50/50 transition-colors inline-flex items-center gap-1"
                  >
                    {meta.label} {n}
                    <ChevronRight className="h-3 w-3 opacity-50" />
                  </button>
                );
              })}
            </div>

            {/* At most 3 compact one-liners */}
            {topAlerts.length > 0 && (
              <ul className="divide-y divide-amber-100 rounded-xl border border-amber-100 bg-white overflow-hidden">
                {topAlerts.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(categoryHref(a.category, a.action_path))
                      }
                      className="w-full text-left flex items-center gap-2 px-3 py-2.5 hover:bg-amber-50/60 transition-colors"
                    >
                      <AlertTriangle
                        className={`h-3.5 w-3.5 shrink-0 ${
                          a.severity === "HIGH" ? "text-red-600" : "text-amber-600"
                        }`}
                      />
                      <span className="text-sm text-stone-800 truncate flex-1">
                        <span className="text-[10px] font-bold uppercase text-stone-400 mr-1.5">
                          {a.severity}
                        </span>
                        {a.title}
                      </span>
                      <ChevronRight className="h-4 w-4 text-stone-300 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {open > topAlerts.length && (
              <p className="text-xs text-muted-foreground">
                +{open - topAlerts.length} more in Risk center
              </p>
            )}
          </>
        )}

        <div className="flex flex-wrap gap-2 pt-0.5">
          <Button
            type="button"
            size="sm"
            className="bg-amber-800 hover:bg-amber-900 text-white"
            onClick={() => goRisks("?status=OPEN")}
          >
            Open Risk center
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => router.push("/dashboard/modules/finance")}
          >
            Finance
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
