"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Loader2, Plus, Trash2 } from "lucide-react";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FinanceNavLinks } from "../components/FinanceNav";

type Plan = {
  id: number | string;
  name: string;
  plan_type: string;
  number_of_installments: number;
  days_interval?: number;
  description?: string;
  is_active?: boolean;
  is_recommended?: boolean;
};

const PLAN_TYPES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "termly", label: "Termly" },
  { value: "semester", label: "Semester" },
  { value: "full", label: "Full payment" },
  { value: "custom", label: "Custom / partial" },
];

function asList(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as any;
    if (Array.isArray(o.results)) return o.results;
    if (Array.isArray(o.data)) return o.data;
  }
  return [];
}

export default function PaymentPlansPage() {
  const { currentSchool } = useCurrentSchool();
  const headers = useMemo(
    () => (currentSchool?.id ? { "X-School-ID": String(currentSchool.id) } : undefined),
    [currentSchool?.id]
  );

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    plan_type: "monthly",
    number_of_installments: 3,
    days_interval: 30,
    description: "",
    is_recommended: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/finance/payment-plans/", { headers });
      setPlans(asList(res.data));
    } catch {
      toast.error("Failed to load payment plans");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Plan name is required");
    if (form.number_of_installments < 1) return toast.error("At least 1 installment");
    setSubmitting(true);
    try {
      await api.post(
        "/finance/payment-plans/",
        {
          name: form.name.trim(),
          plan_type: form.plan_type,
          number_of_installments: Number(form.number_of_installments),
          days_interval: Number(form.days_interval) || 30,
          description: form.description,
          is_recommended: form.is_recommended,
          is_active: true,
        },
        { headers }
      );
      toast.success("Payment plan created");
      setForm({
        name: "",
        plan_type: "monthly",
        number_of_installments: 3,
        days_interval: 30,
        description: "",
        is_recommended: false,
      });
      await load();
    } catch (err: any) {
      const d = err?.response?.data;
      toast.error(typeof d === "string" ? d : d?.detail || JSON.stringify(d) || "Create failed");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: number | string) => {
    if (!confirm("Delete this payment plan?")) return;
    try {
      await api.delete(`/finance/payment-plans/${id}/`, { headers });
      toast.success("Plan removed");
      await load();
    } catch {
      toast.error("Could not delete — it may be linked to assignments");
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-6xl mx-auto">
      <FinanceNavLinks />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarClock className="h-6 w-6 text-teal-700" /> Payment plans
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Installment templates (e.g. full, 50/50, monthly). Applied when assigning fee structures
          or generating invoices.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="rounded-2xl border lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">New plan</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="space-y-3">
              <div>
                <Label className="text-xs">Name *</Label>
                <Input
                  className="mt-1"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Termly 3 installments"
                />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <select
                  className="mt-1 w-full h-9 rounded-md border px-2 text-sm bg-background"
                  value={form.plan_type}
                  onChange={(e) => setForm({ ...form, plan_type: e.target.value })}
                >
                  {PLAN_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Installments</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={1}
                    value={form.number_of_installments}
                    onChange={(e) =>
                      setForm({ ...form, number_of_installments: Number(e.target.value) || 1 })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Days between</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={1}
                    value={form.days_interval}
                    onChange={(e) =>
                      setForm({ ...form, days_interval: Number(e.target.value) || 30 })
                    }
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Input
                  className="mt-1"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Shown when choosing a plan"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_recommended}
                  onChange={(e) => setForm({ ...form, is_recommended: e.target.checked })}
                />
                Mark as recommended
              </label>
              <Button type="submit" className="w-full bg-teal-700 hover:bg-teal-800" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Create plan
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Plans ({plans.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No plans yet — create one on the left.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Installments</th>
                      <th className="px-3 py-2">Interval</th>
                      <th className="px-3 py-2 w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((p) => (
                      <tr key={String(p.id)} className="border-t">
                        <td className="px-3 py-2 font-medium">
                          {p.name}
                          {p.is_recommended ? (
                            <span className="ml-2 text-[10px] uppercase text-teal-700">Recommended</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 capitalize">{p.plan_type}</td>
                        <td className="px-3 py-2">{p.number_of_installments}</td>
                        <td className="px-3 py-2">{p.days_interval ?? "—"} days</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="text-red-600 hover:text-red-800"
                            onClick={() => remove(p.id)}
                            aria-label="Delete plan"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
