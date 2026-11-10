"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FinanceNavLinks } from "../components/FinanceNav";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UtensilsCrossed, RefreshCw } from "lucide-react";

function money(v?: string | number | null) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return "—";
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function MealsLunchPage() {
  const { currentSchool } = useCurrentSchool();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    admission_number: "",
    plan_type: "TERM",
    amount: "",
    absence_rule: "CHARGE_FULL",
    academic_year: "",
    notes: "",
  });

  const listQ = useQuery({
    queryKey: ["lunch-enrollments", currentSchool?.id, q],
    queryFn: async () => {
      const { data } = await api.get("/finance/lunch/enrollments/", {
        params: q ? { q } : undefined,
      });
      return data as { count: number; results: any[] };
    },
    enabled: !!currentSchool?.id,
  });

  const kittyQ = useQuery({
    queryKey: ["lunch-kitty", currentSchool?.id],
    queryFn: async () => {
      const { data } = await api.get("/finance/lunch/kitty/");
      return data;
    },
    enabled: !!currentSchool?.id,
  });

  const ensureMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/finance/lunch/ensure-defaults/");
      return data;
    },
    onSuccess: () => {
      toast.success("Meals fee category & Lunch item ready");
      qc.invalidateQueries({ queryKey: ["lunch-kitty"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Failed"),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/finance/lunch/enrollments/", {
        admission_number: form.admission_number.trim(),
        plan_type: form.plan_type,
        amount: form.amount || "0",
        absence_rule: form.absence_rule,
        academic_year: form.academic_year,
        notes: form.notes,
        status: "ACTIVE",
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Learner added to lunch program");
      setForm((f) => ({ ...f, admission_number: "", notes: "" }));
      qc.invalidateQueries({ queryKey: ["lunch-enrollments"] });
      qc.invalidateQueries({ queryKey: ["lunch-kitty"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Could not enroll"),
  });

  const patchMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.patch(`/finance/lunch/enrollments/${id}/`, { status });
      return data;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["lunch-enrollments"] });
      qc.invalidateQueries({ queryKey: ["lunch-kitty"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Update failed"),
  });

  const rows = listQ.data?.results || [];
  const activeCount = useMemo(
    () => rows.filter((r) => r.status === "ACTIVE").length,
    [rows]
  );

  return (
    <div className="space-y-4">
      <FinanceNavLinks />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Finance</p>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6 text-teal-700" />
            Meals & lunch program
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Subscribe learners to lunch. Term packages select optional Meals lines at clearance.
            Kitchen spend and cook pay should use the Meals fee group so the kitty stays visible.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={ensureMut.isPending}
          onClick={() => ensureMut.mutate()}
        >
          {ensureMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Ensure Meals fee item
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Active subscriptions</p>
            <p className="text-xl font-semibold">{kittyQ.data?.active_subscriptions ?? activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Meals invoiced</p>
            <p className="text-xl font-semibold tabular-nums">{money(kittyQ.data?.meals_invoiced)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Collected (allocated)</p>
            <p className="text-xl font-semibold tabular-nums">
              {money(kittyQ.data?.meals_collected_allocated)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Kitchen expenses</p>
            <p className="text-xl font-semibold tabular-nums">{money(kittyQ.data?.kitchen_expenses)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Est. surplus {money(kittyQ.data?.estimated_surplus)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Subscribe learner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Admission number *</Label>
              <Input
                placeholder="PSS-2026-0001"
                value={form.admission_number}
                onChange={(e) => setForm({ ...form, admission_number: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Plan</Label>
                <select
                  className="w-full rounded-md border px-2 py-2 text-sm"
                  value={form.plan_type}
                  onChange={(e) => setForm({ ...form, plan_type: e.target.value })}
                >
                  <option value="TERM">Per term</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="DAILY">Daily rate</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Amount</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>If absent / doesn&apos;t eat</Label>
              <select
                className="w-full rounded-md border px-2 py-2 text-sm"
                value={form.absence_rule}
                onChange={(e) => setForm({ ...form, absence_rule: e.target.value })}
              >
                <option value="CHARGE_FULL">Still charge (place reserved)</option>
                <option value="CREDIT_UNUSED">Credit unused (policy / manual)</option>
                <option value="CHARGE_USAGE">Only days eaten (needs register later)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Academic year (optional)</Label>
              <Input
                placeholder="2026"
                value={form.academic_year}
                onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <Button
              className="w-full"
              disabled={createMut.isPending || !form.admission_number.trim()}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Activate lunch program
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Term plan: at clearance, Meals optional lines are selected automatically.
              Also add Lunch as optional on the fee structure with the term amount.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Subscriptions ({listQ.data?.count ?? 0})</CardTitle>
            <Input
              className="max-w-[180px] h-8"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </CardHeader>
          <CardContent>
            {listQ.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : !rows.length ? (
              <p className="text-sm text-muted-foreground py-6">
                No lunch subscriptions yet. Subscribe a learner by admission number.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-2">Learner</th>
                      <th className="py-2 pr-2">Plan</th>
                      <th className="py-2 pr-2 text-right">Amount</th>
                      <th className="py-2 pr-2">Status</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-2">
                          <div className="font-medium">{r.student_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.admission_number}
                            {r.grade ? ` · ${r.grade}` : ""}
                          </div>
                        </td>
                        <td className="py-2 pr-2">
                          {r.plan_type}
                          <div className="text-[11px] text-muted-foreground">{r.absence_rule}</div>
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">{money(r.amount)}</td>
                        <td className="py-2 pr-2">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              r.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700"
                                : r.status === "PAUSED"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            {r.status !== "ACTIVE" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={patchMut.isPending}
                                onClick={() => patchMut.mutate({ id: r.id, status: "ACTIVE" })}
                              >
                                Activate
                              </Button>
                            )}
                            {r.status === "ACTIVE" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={patchMut.isPending}
                                onClick={() => patchMut.mutate({ id: r.id, status: "PAUSED" })}
                              >
                                Pause
                              </Button>
                            )}
                            {r.status !== "ENDED" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                disabled={patchMut.isPending}
                                onClick={() => patchMut.mutate({ id: r.id, status: "ENDED" })}
                              >
                                End
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
