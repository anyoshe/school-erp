"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Settings = Record<string, any>;

export default function RiskSettingsPage() {
  const { currentSchool } = useCurrentSchool();
  const headers = useMemo(
    () => (currentSchool?.id ? { "X-School-ID": String(currentSchool.id) } : undefined),
    [currentSchool?.id]
  );
  const [form, setForm] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const res = await api.get("/risks/settings/", { headers });
      setForm(res.data);
    } catch {
      toast.error("Could not load risk settings");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (key: string, value: any) => setForm((prev) => ({ ...(prev || {}), [key]: value }));

  const save = async () => {
    if (!headers || !form) return;
    setSaving(true);
    try {
      const res = await api.patch("/risks/settings/", form, { headers });
      setForm(res.data);
      toast.success("Risk thresholds saved");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading risk settings…
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-3xl mx-auto">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/dashboard/modules/risks" className="underline">
            Risk control center
          </Link>
        </p>
        <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">
          <ShieldAlert className="h-6 w-6 text-amber-700" />
          Early-warning thresholds
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tune when fees, attendance, learning, and ops alerts fire for this school.
        </p>
      </div>

      <Card className="rounded-2xl border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Scanners</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
          {(
            [
              ["enable_fee", "Fee / revenue"],
              ["enable_attendance", "Attendance / retention"],
              ["enable_academic", "Academic trajectory"],
              ["enable_ops", "Ops / inventory"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <input
                type="checkbox"
                checked={Boolean(form[key])}
                onChange={(e) => set(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Fee rules</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Mid-term collection threshold (0–1)</Label>
            <Input
              className="mt-1"
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={form.mid_term_collection_threshold ?? 0.4}
              onChange={(e) => set("mid_term_collection_threshold", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Term elapsed before lag rule (0–1)</Label>
            <Input
              className="mt-1"
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={form.mid_term_elapsed_threshold ?? 0.4}
              onChange={(e) => set("mid_term_elapsed_threshold", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Attendance rules</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Consecutive absences</Label>
            <Input
              className="mt-1"
              type="number"
              min={1}
              value={form.consecutive_absent_days ?? 3}
              onChange={(e) => set("consecutive_absent_days", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Mon/Fri absences (30d)</Label>
            <Input
              className="mt-1"
              type="number"
              min={1}
              value={form.mon_fri_absent_count ?? 3}
              onChange={(e) => set("mon_fri_absent_count", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Chronic absences (60d)</Label>
            <Input
              className="mt-1"
              type="number"
              min={1}
              value={form.chronic_absent_60d ?? 7}
              onChange={(e) => set("chronic_absent_60d", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Rate rise delta (0–1)</Label>
            <Input
              className="mt-1"
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={form.absence_rate_delta ?? 0.15}
              onChange={(e) => set("absence_rate_delta", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Learning & ops</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">CAT drop points</Label>
            <Input
              className="mt-1"
              type="number"
              min={1}
              value={form.cat_drop_points ?? 15}
              onChange={(e) => set("cat_drop_points", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Burn multiplier</Label>
            <Input
              className="mt-1"
              type="number"
              step="0.05"
              min={1}
              value={form.burn_multiplier ?? 1.25}
              onChange={(e) => set("burn_multiplier", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Digest channel</Label>
            <select
              className="mt-1 w-full h-9 rounded-md border px-2 text-sm bg-background"
              value={form.digest_channel || "LOG"}
              onChange={(e) => set("digest_channel", e.target.value)}
            >
              <option value="LOG">Log only</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
              <option value="BOTH">WhatsApp + Email</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Digest item limit</Label>
            <Input
              className="mt-1"
              type="number"
              min={1}
              max={20}
              value={form.digest_limit ?? 5}
              onChange={(e) => set("digest_limit", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Button className="bg-amber-700 hover:bg-amber-800" disabled={saving} onClick={() => void save()}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
        Save thresholds
      </Button>
    </div>
  );
}
