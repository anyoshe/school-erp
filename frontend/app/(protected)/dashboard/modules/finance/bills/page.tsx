"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Loader2, FileText } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function asList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export default function BillsPage() {
  const { currentSchool } = useCurrentSchool();
  const schoolId = currentSchool?.id;
  const currency = currentSchool?.currency_symbol || currentSchool?.currency || "KES";
  const headers = schoolId ? { "X-School-ID": String(schoolId) } : undefined;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payBill, setPayBill] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("BANK");
  const [vendorName, setVendorName] = useState("");
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

  const saveVendor = async () => {
    if (!vendorName.trim()) return;
    try {
      const res = await api.post("/finance/vendors/", { name: vendorName.trim() }, { headers });
      toast.success("Vendor created");
      setVendorName("");
      setVendorOpen(false);
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

  const openPay = (bill: any) => {
    setPayBill(bill);
    setPayAmount(String(bill.balance ?? bill.amount ?? ""));
    setPayMethod("BANK");
    setPayOpen(true);
  };

  const submitPay = async () => {
    if (!payBill) return;
    setSaving(true);
    try {
      await api.post(
        `/finance/bills/${payBill.id}/pay/`,
        {
          amount: payAmount,
          payment_date: new Date().toISOString().slice(0, 10),
          payment_method: payMethod,
          record_expense: true,
        },
        { headers }
      );
      toast.success("Payment recorded");
      setPayOpen(false);
      setPayBill(null);
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["owner-standing"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  const rows = billsQ.data || [];
  const openPayables = rows
    .filter((b: any) => !["PAID", "CANCELLED"].includes(b.status))
    .reduce((s: number, b: any) => s + Number(b.balance || 0), 0);

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
            <FileText className="h-6 w-6 text-teal-700" /> Vendor bills
          </h1>
          <p className="text-sm text-muted-foreground">Supplier invoices and payables</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setVendorOpen(true)}>
          + Vendor
        </Button>
        <Button
          type="button"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" /> New bill
        </Button>
      </div>

      <Card className="border-amber-100 bg-amber-50/40">
        <CardContent className="p-4 flex justify-between items-center">
          <span className="text-sm font-medium text-amber-950">Open payables</span>
          <span className="text-xl font-bold text-amber-950">
            {currency} {openPayables.toLocaleString()}
          </span>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="border-b bg-slate-50/80">
          <CardTitle className="text-base">Bills register</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {billsQ.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="font-medium">No bills yet</p>
              <p className="text-sm text-muted-foreground">
                Capture supplier invoices, then mark them paid as you settle.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b">
                    <th className="py-3 px-4">Bill #</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Balance</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b: any) => (
                    <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono text-xs">{b.bill_number}</td>
                      <td className="py-3 px-4">{b.vendor_name}</td>
                      <td className="py-3 px-4">{b.bill_date}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">{b.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {Number(b.amount || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums">
                        {Number(b.balance || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {b.status !== "PAID" && b.status !== "CANCELLED" && (
                          <Button type="button" size="sm" variant="outline" onClick={() => openPay(b)}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New vendor bill</DialogTitle>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3 py-2">
            <div>
              <Label>Vendor *</Label>
              <Select
                value={form.vendor || "none"}
                onValueChange={(v) => setForm({ ...form, vendor: v === "none" ? "" : v })}
              >
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
              <Input
                value={form.bill_number}
                onChange={(e) => setForm({ ...form, bill_number: e.target.value })}
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
              <Label>Bill date</Label>
              <Input
                type="date"
                value={form.bill_date}
                onChange={(e) => setForm({ ...form, bill_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Due date</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={form.category || "none"}
                onValueChange={(v) => setForm({ ...form, category: v === "none" ? "" : v })}
              >
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
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
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
              className="bg-emerald-600 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={vendorOpen} onOpenChange={setVendorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New vendor</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Name</Label>
            <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Supplier name" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setVendorOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveVendor} className="bg-emerald-600 text-white">
              Save vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay bill {payBill?.bill_number}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Balance: {currency} {Number(payBill?.balance || 0).toLocaleString()}
          </p>
          <div className="space-y-3">
            <div>
              <Label>Amount</Label>
              <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK">Bank</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="MPESA">M-Pesa</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={submitPay}
              className="bg-emerald-600 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
