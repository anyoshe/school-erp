"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FinanceNavLinks } from "../components/FinanceNav";
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
  paid_from_account: "",
  related_fee_category: "",
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

  const accountsQ = useQuery({
    queryKey: ["finance-accounts", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const res = await api.get("/finance/accounts/", {
        headers,
        params: { type: "ASSET" },
      });
      return asList(res.data);
    },
  });

  const balancesQ = useQuery({
    queryKey: ["account-balances", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const res = await api.get("/finance/account-balances/", {
        headers,
        params: { type: "ASSET" },
      });
      return Array.isArray(res.data?.accounts) ? res.data.accounts : [];
    },
  });

  const feeCatsQ = useQuery({
    queryKey: ["fee-categories", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const res = await api.get("/finance/categories/", { headers });
      return asList(res.data);
    },
  });

  const rows = expensesQ.data || [];
  const cats = catsQ.data || [];
  const vendors = vendorsQ.data || [];
  const accounts = accountsQ.data || [];
  const feeCats = feeCatsQ.data || [];
  const balances = balancesQ.data || [];

  const total = useMemo(
    () => rows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0),
    [rows]
  );

  const saveExpense = async () => {
    if (!form.title.trim() || !form.amount || Number(form.amount) <= 0) {
      toast.error("Title and amount are required");
      return;
    }
    if (!form.paid_from_account) {
      toast.error("Select which account the money is paid from");
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
          paid_to: form.paid_to || "",
          reference_number: form.reference_number || "",
          description: form.description || "",
          paid_from_account: form.paid_from_account || null,
          related_fee_category: form.related_fee_category || null,
        },
        { headers }
      );
      toast.success("Expense recorded");
      setOpen(false);
      setForm(emptyForm);
      void qc.invalidateQueries({ queryKey: ["expenses"] });
      void qc.invalidateQueries({ queryKey: ["account-balances"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not save expense");
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    setSaving(true);
    try {
      await api.post(
        "/finance/expense-categories/",
        { name: newCat.trim(), description: "" },
        { headers }
      );
      toast.success("Category added");
      setNewCat("");
      void qc.invalidateQueries({ queryKey: ["expense-categories"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not add category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      <FinanceNavLinks />
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
          <p className="text-sm text-muted-foreground">
            Operating spend drawn from cash, bank or M-Pesa — linked to fee groups when relevant
          </p>
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

      {/* Account positions */}
      <div className="grid sm:grid-cols-3 gap-3">
        {(balances.length ? balances : accounts).slice(0, 6).map((a: any) => {
          const hasBal = a.balance !== undefined && a.balance !== null;
          const bal = hasBal ? Number(a.balance) : null;
          return (
            <Card key={a.id || a.code} className="border-slate-200">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  {a.code ? `${a.code} · ` : ""}
                  {a.name}
                </p>
                <p
                  className={`text-xl font-bold tabular-nums ${
                    bal != null && bal < 0 ? "text-rose-700" : "text-emerald-800"
                  }`}
                >
                  {bal != null
                    ? `${currency} ${bal.toLocaleString()}`
                    : balancesQ.isLoading
                      ? "…"
                      : `${currency} 0`}
                </p>
                {a.inflow != null && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    In {Number(a.inflow).toLocaleString()} · Out{" "}
                    {Number(a.outflow || 0).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Expense entries</p>
            <p className="text-2xl font-bold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card className="border-rose-100">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total expenses recorded</p>
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
            <p className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="font-medium">No expenses yet</p>
              <p className="text-sm text-muted-foreground">
                Starter categories are ready (salaries, utilities, transport…). Record spend and
                choose the account money is taken from.
              </p>
              <Button
                type="button"
                className="mt-2 bg-emerald-600 text-white"
                onClick={() => setOpen(true)}
              >
                Record first expense
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Paid from</th>
                    <th className="px-3 py-2">Fee group</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">{r.expense_date}</td>
                      <td className="px-3 py-2 font-medium">{r.title}</td>
                      <td className="px-3 py-2">{r.category_name || "—"}</td>
                      <td className="px-3 py-2">{r.paid_from_account_name || "—"}</td>
                      <td className="px-3 py-2">{r.related_fee_category_name || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-rose-800">
                        {currency} {Number(r.amount || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record expense */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. October teaching salaries"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount *</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Expense category</Label>
              <Select
                value={form.category || "none"}
                onValueChange={(v) => setForm({ ...form, category: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="none">—</SelectItem>
                  {cats.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Paid from account *</Label>
              <Select
                value={form.paid_from_account || "none"}
                onValueChange={(v) =>
                  setForm({ ...form, paid_from_account: v === "none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Cash / Bank / M-Pesa" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="none">Select account</SelectItem>
                  {accounts.map((a: any) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.code} · {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                This reduces the selected pot so the dashboard shows what is left.
              </p>
            </div>
            <div>
              <Label>Related fee group (optional)</Label>
              <Select
                value={form.related_fee_category || "none"}
                onValueChange={(v) =>
                  setForm({ ...form, related_fee_category: v === "none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="e.g. Transport, Tuition" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="none">None</SelectItem>
                  {feeCats.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Use when the cost is funded by a fee line (fuel → Transport, food → Meals).
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Payment method</Label>
                <Select
                  value={form.payment_method}
                  onValueChange={(v) => setForm({ ...form, payment_method: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
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
                  <SelectContent className="max-h-60 overflow-y-auto">
                    <SelectItem value="none">—</SelectItem>
                    {vendors.map((v: any) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Paid to</Label>
              <Input
                value={form.paid_to}
                onChange={(e) => setForm({ ...form, paid_to: e.target.value })}
                placeholder="Payee if no vendor"
              />
            </div>
            <div>
              <Label>Reference</Label>
              <Input
                value={form.reference_number}
                onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                placeholder="Receipt / cheque no."
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="min-w-[8.5rem] h-10"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-w-[8.5rem] h-10 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={saving}
              onClick={saveExpense}
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  Saving…
                </span>
              ) : (
                "Save expense"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Categories */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Expense categories</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Starter kit is created automatically. Add more below if needed.
          </p>
          <ul className="text-sm divide-y rounded-lg border max-h-60 overflow-y-auto">
            {cats.map((c: any) => (
              <li key={c.id} className="px-3 py-2">
                <span className="font-medium">{c.name}</span>
                {c.description ? (
                  <span className="block text-xs text-muted-foreground">{c.description}</span>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="New category name"
            />
            <Button type="button" disabled={saving} onClick={addCategory}>
              Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
