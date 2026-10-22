"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Loader2, Wallet } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

function asList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

const emptyForm = {
  title: "",
  amount: "",
  expense_date: new Date().toISOString().slice(0, 10),
  payment_method: "CASH",
  category: "",
  vendor: "",
  paid_to: "",
  reference_number: "",
  description: "",
};

export default function ExpensesPage() {
  const { currentSchool } = useCurrentSchool();
  const schoolId = currentSchool?.id;
  const currency = currentSchool?.currency_symbol || currentSchool?.currency || "KES";
  const headers = schoolId ? { "X-School-ID": String(schoolId) } : undefined;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

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
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["owner-standing"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  const saveCategory = async () => {
    if (!newCat.trim()) return;
    try {
      await api.post("/finance/expense-categories/", { name: newCat.trim() }, { headers });
      toast.success("Category created");
      setNewCat("");
      setCatOpen(false);
      qc.invalidateQueries({ queryKey: ["expense-categories"] });
    } catch {
      toast.error("Could not create category");
    }
  };

  const rows = expensesQ.data || [];
  const total = rows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/modules/finance">
            <ArrowLeft className="h-4 w-4 mr-1" /> Finance
          </Link>
        </Button>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6 text-emerald-700" /> Expenses
          </h1>
          <p className="text-sm text-muted-foreground">Operating spend for the school</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setCatOpen(true)}>
          Categories
        </Button>
        <Button
          type="button"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" /> Record expense
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Entries</p>
            <p className="text-2xl font-bold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2 border-rose-100">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total recorded</p>
            <p className="text-2xl font-bold text-rose-800">
              {currency} {total.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="border-b bg-slate-50/80">
          <CardTitle className="text-base">Expense register</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {expensesQ.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="font-medium">No expenses yet</p>
              <p className="text-sm text-muted-foreground">
                Record utilities, salaries, supplies and other school costs.
              </p>
              <Button type="button" className="mt-2 bg-emerald-600 text-white" onClick={() => setOpen(true)}>
                Record first expense
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b bg-white">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="py-3 px-4 whitespace-nowrap">{r.expense_date}</td>
                      <td className="py-3 px-4 font-medium">{r.title}</td>
                      <td className="py-3 px-4 text-muted-foreground">{r.category_name || "—"}</td>
                      <td className="py-3 px-4">{r.payment_method}</td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums">
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record expense</DialogTitle>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3 py-2">
            <div className="sm:col-span-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Electricity — March"
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
            <div className="sm:col-span-2">
              <Label>Reference</Label>
              <Input
                value={form.reference_number}
                onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={save}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Expense categories</DialogTitle>
          </DialogHeader>
          <ul className="text-sm space-y-1 max-h-40 overflow-y-auto border rounded-lg p-2">
            {(catsQ.data || []).length === 0 ? (
              <li className="text-muted-foreground px-1">No categories yet</li>
            ) : (
              (catsQ.data || []).map((c: any) => (
                <li key={c.id} className="px-1 py-1 border-b border-slate-50 last:border-0">
                  {c.name}
                </li>
              ))
            )}
          </ul>
          <div>
            <Label>New category</Label>
            <Input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="e.g. Utilities, Salaries, Food"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCatOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={saveCategory} className="bg-emerald-600 text-white">
              Add category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
