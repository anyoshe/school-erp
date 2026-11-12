"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Alert = {
  id: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  detail: string;
  action_path?: string;
  student?: { id: string; name: string; admission_number?: string } | null;
  updated_at?: string;
};

const sevClass: Record<string, string> = {
  HIGH: "bg-red-50 border-red-200 text-red-900",
  MEDIUM: "bg-amber-50 border-amber-200 text-amber-950",
  LOW: "bg-slate-50 border-slate-200 text-slate-800",
};

export default function RiskControlCenterPage() {
  const { currentSchool } = useCurrentSchool();
  const router = useRouter();
  const headers = useMemo(
    () => (currentSchool?.id ? { "X-School-ID": String(currentSchool.id) } : undefined),
    [currentSchool?.id]
  );

  const [status, setStatus] = useState("OPEN");
  const [category, setCategory] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [counts, setCounts] = useState({ open: 0, acknowledged: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {
        status,
        limit: "150",
      };
      if (category !== "ALL") params.category = category;
      if (severity !== "ALL") params.severity = severity;
      const res = await api.get("/risks/alerts/", { headers, params });
      setAlerts(res.data?.alerts || []);
      setCounts(res.data?.counts || { open: 0, acknowledged: 0, resolved: 0 });
    } catch {
      toast.error("Could not load alerts");
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [headers, status, category, severity]);

  useEffect(() => {
    void load();
  }, [load]);

  const rescan = async () => {
    if (!headers) return;
    setScanning(true);
    try {
      await api.post("/risks/scan/", {}, { headers });
      toast.success("Risk scan complete");
      await load();
    } catch {
      toast.error("Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const act = async (id: string, action: "ack" | "resolve" | "reopen") => {
    if (!headers) return;
    try {
      await api.post(`/risks/${id}/${action}/`, {}, { headers });
      toast.success(action === "ack" ? "Acknowledged" : action === "resolve" ? "Resolved" : "Reopened");
      await load();
    } catch {
      toast.error("Action failed");
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-amber-700" />
            Risk control center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review, acknowledge, and resolve early warnings across fees, attendance, learning, and ops.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/settings/school/risk")}>
            <Settings2 className="h-4 w-4 mr-1" /> Thresholds
          </Button>
          <Button size="sm" onClick={() => void rescan()} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Rescan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {(
          [
            ["OPEN", "Open", counts.open],
            ["ACKNOWLEDGED", "Acknowledged", counts.acknowledged],
            ["RESOLVED", "Resolved", counts.resolved],
          ] as const
        ).map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(key)}
            className={`rounded-xl border px-3 py-3 text-left transition ${
              status === key ? "border-amber-400 bg-amber-50 ring-1 ring-amber-200" : "bg-white hover:bg-muted/40"
            }`}
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{n}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="h-9 rounded-md border px-2 text-sm bg-background"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="ALL">All categories</option>
          <option value="FEE">Fees</option>
          <option value="ATTENDANCE">Attendance</option>
          <option value="ACADEMIC">Learning</option>
          <option value="OPS">Ops</option>
        </select>
        <select
          className="h-9 rounded-md border px-2 text-sm bg-background"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option value="ALL">All severities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      <Card className="rounded-2xl border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No alerts in this filter.</p>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className={`rounded-xl border px-3 py-3 ${sevClass[a.severity] || sevClass.LOW}`}
              >
                <div className="flex flex-wrap items-start gap-2 justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide opacity-80">
                      <span>{a.severity}</span>
                      <span>{a.category}</span>
                      <span>{a.status}</span>
                    </div>
                    <p className="font-semibold text-sm mt-0.5 flex items-start gap-1.5">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      {a.title}
                    </p>
                    <p className="text-xs opacity-80 mt-1 line-clamp-3">{a.detail}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {a.action_path ? (
                      <Button size="sm" variant="outline" onClick={() => router.push(a.action_path!)}>
                        Open
                      </Button>
                    ) : null}
                    {a.status === "OPEN" ? (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => void act(a.id, "ack")}>
                          Ack
                        </Button>
                        <Button size="sm" onClick={() => void act(a.id, "resolve")}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Resolve
                        </Button>
                      </>
                    ) : null}
                    {a.status === "ACKNOWLEDGED" ? (
                      <Button size="sm" onClick={() => void act(a.id, "resolve")}>
                        Resolve
                      </Button>
                    ) : null}
                    {a.status === "RESOLVED" ? (
                      <Button size="sm" variant="outline" onClick={() => void act(a.id, "reopen")}>
                        Reopen
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
