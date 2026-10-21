"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function asList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export default function ExpensesPage() {
  const { currentSchool } = useCurrentSchool();
  const schoolId = currentSchool?.id;
  const headers = schoolId ? { "X-School-ID": String(schoolId) } : undefined;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
    payment_method: "CASH",
    category: "",
    vendor: "",
    paid_to: "",
    reference_number: "",
    description: "",
  });

  const expensesQ = useQuery({
    queryKey: ["expenses", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const res = await api.get("/finance/expenses/", { headers });
      return asList(res.data);
    },
  });

  const catsQ = useQuery({
    queryKey: ["expense-categories", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const res = await api.get("/finance/expense-categories/", { headers });
      return asList(res.data);
    },
  });

  const vendorsQ = useQuery({
    queryKey: ["vendors", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const res = await api.get("/finance/vendors/", { headers });
      return asList(res.data);
    },
  });

  const save = async () => {
    if (!form.title.trim() || !form.amount) {
      toast.error("Title and amount required");
      return;
    }
    setSaving(true);
    try {
      await api.post(
        "/finance/expenses/",
        {
          title: form.title.trim(),
          amount: form.amount,
          expense_date: form.expense_date,
          payment_method: form.payment_method,
          category: form.category || null,
          vendor: form.vendor || null,
          paid_to: form.paid_to,
          reference_number: form.reference_number,
          description: form.description,
        },
        { headers }
      );
      toast.success("Expense recorded");
      setOpen(false);
      setForm({
        title: "",
        amount: "",
        expense_date: new Date().toISOString().slice(0, 10),
        payment_method: "CASH",
        category: "",
        vendor: "",
        paid_to: "",
        reference_number: "",
        description: "",
      });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["owner-standing"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async () => {
    const name = window.prompt("New expense category name");
    if (!name?.trim()) return;
    try {
      await api.post("/finance/expense-categories/", { name: name.trim() }, { headers });
      toast.success("Category created");
      qc.invalidateQueries({ queryKey: ["expense-categories"] });
    } catch {
      toast.error("Could not create category");
    }
  };

  const rows = expensesQ.data || [];
  const total = rows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/modules/finance">
            <ArrowLeft className="h-4 w-4 mr-1" /> Finance
          </Link>
        </Button>
        <h1 className="text-xl font-bold flex-1">School expenses</h1>
        <Button type="button" variant="outline" size="sm" onClick={addCategory}>
          + Category
        </Button>
        <Button
          type="button"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setOpen((v) => !v)}
        >
          <Plus className="h-4 w-4 mr-1" /> Record expense
        </Button>
      </div>

      {open && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New expense</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Electricity bill March"
              />
            </div>
            <div>
              <Label>Amount *</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={form.category || "none"}
                onValueChange={(v) => setForm({ ...form, category: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorised</SelectItem>
                  {(catsQ.data || []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment method</Label>
              <Select
                value={form.payment_method}
                onValueChange={(v) => setForm({ ...form, payment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK">Bank</SelectItem>
                  <SelectItem value="MPESA">M-Pesa</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vendor</Label>
              <Select
                value={form.vendor || "none"}
                onValueChange={(v) => setForm({ ...form, vendor: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(vendorsQ.data || []).map((v: any) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Paid to</Label>
              <Input
                value={form.paid_to}
                onChange={(e) => setForm({ ...form, paid_to: e.target.value })}
              />
            </div>
            <div>
              <Label>Reference</Label>
              <Input
                value={form.reference_number}
                onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={saving} onClick={save} className="bg-emerald-600 text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save expense"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Expenses</CardTitle>
          <p className="text-sm font-semibold">Total: {total.toLocaleString()}</p>
        </CardHeader>
        <CardContent>
          {expensesQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Date</th>
                    <th className="py-2">Title</th>
                    <th className="py-2">Category</th>
                    <th className="py-2">Method</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2 whitespace-nowrap">{r.expense_date}</td>
                      <td className="py-2">{r.title}</td>
                      <td className="py-2 text-muted-foreground">{r.category_name || "—"}</td>
                      <td className="py-2">{r.payment_method}</td>
                      <td className="py-2 text-right font-medium">
                        {Number(r.amount || 0).toLocaleString()}
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
  );
}
