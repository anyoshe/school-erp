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
import { Badge } from "@/components/ui/badge";

function asList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export default function BillsPage() {
  const { currentSchool } = useCurrentSchool();
  const schoolId = currentSchool?.id;
  const headers = schoolId ? { "X-School-ID": String(schoolId) } : undefined;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendor: "",
    bill_number: "",
    amount: "",
    bill_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    description: "",
    category: "",
  });

  const billsQ = useQuery({
    queryKey: ["bills", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const res = await api.get("/finance/bills/", { headers });
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

  const catsQ = useQuery({
    queryKey: ["expense-categories", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const res = await api.get("/finance/expense-categories/", { headers });
      return asList(res.data);
    },
  });

  const ensureVendor = async () => {
    const name = window.prompt("New vendor / supplier name");
    if (!name?.trim()) return;
    try {
      const res = await api.post("/finance/vendors/", { name: name.trim() }, { headers });
      toast.success("Vendor created");
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setForm((f) => ({ ...f, vendor: String(res.data.id) }));
    } catch {
      toast.error("Could not create vendor");
    }
  };

  const save = async () => {
    if (!form.vendor || !form.bill_number || !form.amount) {
      toast.error("Vendor, bill number and amount required");
      return;
    }
    setSaving(true);
    try {
      await api.post(
        "/finance/bills/",
        {
          vendor: form.vendor,
          bill_number: form.bill_number.trim(),
          amount: form.amount,
          bill_date: form.bill_date,
          due_date: form.due_date || null,
          description: form.description,
          category: form.category || null,
        },
        { headers }
      );
      toast.success("Bill recorded");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["owner-standing"] });
    } catch (e: any) {
      const d = e?.response?.data;
      toast.error(typeof d === "object" ? JSON.stringify(d) : "Failed to save bill");
    } finally {
      setSaving(false);
    }
  };

  const payBill = async (bill: any) => {
    const raw = window.prompt(`Pay amount (balance ${bill.balance})`, String(bill.balance));
    if (raw == null) return;
    try {
      await api.post(
        `/finance/bills/${bill.id}/pay/`,
        {
          amount: raw,
          payment_date: new Date().toISOString().slice(0, 10),
          payment_method: "BANK",
          record_expense: true,
        },
        { headers }
      );
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["owner-standing"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Payment failed");
    }
  };

  const rows = billsQ.data || [];
  const openPayables = rows
    .filter((b: any) => !["PAID", "CANCELLED"].includes(b.status))
    .reduce((s: number, b: any) => s + Number(b.balance || 0), 0);

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/modules/finance">
            <ArrowLeft className="h-4 w-4 mr-1" /> Finance
          </Link>
        </Button>
        <h1 className="text-xl font-bold flex-1">Vendor bills / payables</h1>
        <Button type="button" variant="outline" size="sm" onClick={ensureVendor}>
          + Vendor
        </Button>
        <Button
          type="button"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setOpen((v) => !v)}
        >
          <Plus className="h-4 w-4 mr-1" /> New bill
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Open payables: <strong>{openPayables.toLocaleString()}</strong>
      </p>

      {open && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New vendor bill</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Vendor *</Label>
              <Select value={form.vendor || "none"} onValueChange={(v) => setForm({ ...form, vendor: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select…</SelectItem>
                  {(vendorsQ.data || []).map((v: any) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bill number *</Label>
              <Input value={form.bill_number} onChange={(e) => setForm({ ...form, bill_number: e.target.value })} />
            </div>
            <div>
              <Label>Amount *</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>Bill date</Label>
              <Input type="date" value={form.bill_date} onChange={(e) => setForm({ ...form, bill_date: e.target.value })} />
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category || "none"} onValueChange={(v) => setForm({ ...form, category: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(catsQ.data || []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={saving} onClick={save} className="bg-emerald-600 text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save bill"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bills</CardTitle>
        </CardHeader>
        <CardContent>
          {billsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bills yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Bill #</th>
                    <th className="py-2">Vendor</th>
                    <th className="py-2">Date</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2 text-right">Balance</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b: any) => (
                    <tr key={b.id} className="border-b border-slate-100">
                      <td className="py-2 font-mono text-xs">{b.bill_number}</td>
                      <td className="py-2">{b.vendor_name}</td>
                      <td className="py-2">{b.bill_date}</td>
                      <td className="py-2">
                        <Badge variant="outline">{b.status}</Badge>
                      </td>
                      <td className="py-2 text-right">{Number(b.amount || 0).toLocaleString()}</td>
                      <td className="py-2 text-right font-medium">
                        {Number(b.balance || 0).toLocaleString()}
                      </td>
                      <td className="py-2 text-right">
                        {b.status !== "PAID" && b.status !== "CANCELLED" && (
                          <Button type="button" size="sm" variant="outline" onClick={() => payBill(b)}>
                            Pay
                          </Button>
                        )}
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
