"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Banknote, Plus } from "lucide-react";
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

function asList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export default function FinanceClearancePage() {
  const { currentSchool } = useCurrentSchool();
  const schoolId = currentSchool?.id;
  const currency = currentSchool?.currency_symbol || currentSchool?.currency || "KES";
  const headers = schoolId ? { "X-School-ID": String(schoolId) } : undefined;
  const qc = useQueryClient();

  const [payOpen, setPayOpen] = useState(false);
  const [row, setRow] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [saving, setSaving] = useState(false);
  const [extraName, setExtraName] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [addingExtra, setAddingExtra] = useState(false);

  const listQ = useQuery({
    queryKey: ["awaiting-clearance", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const res = await api.get("/finance/awaiting-clearance/", { headers });
      return asList(res.data?.results ?? res.data);
    },
  });

  const openPay = (r: any) => {
    setRow(r);
    setAmount(r.balance > 0 ? String(r.balance) : r.total_due > 0 ? String(r.total_due) : "");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setMethod("CASH");
    setReference("");
    const invs = r.invoices || [];
    setInvoiceId(invs[0] ? String(invs[0].id) : "");
    setExtraName("");
    setExtraAmount("");
    setPayOpen(true);
  };

  const addExtra = async () => {
    if (!row?.id) return;
    if (!extraName.trim() || !extraAmount || Number(extraAmount) <= 0) {
      toast.error("Enter item name and amount");
      return;
    }
    setAddingExtra(true);
    try {
      const res = await api.post(
        `/finance/awaiting-clearance/${row.id}/add-item/`,
        { description: extraName.trim(), amount: extraAmount },
        { headers }
      );
      const billing = res.data?.billing;
      if (billing) {
        setRow((prev: any) => ({
          ...prev,
          ...billing,
          structure: billing.structure ?? prev.structure,
          lines: billing.lines ?? prev.lines,
          invoices: billing.invoices ?? prev.invoices,
          total_due: billing.total_due,
          total_paid: billing.total_paid,
          balance: billing.balance,
        }));
        setAmount(String(billing.balance ?? billing.total_due ?? ""));
        if (billing.invoices?.[0]) setInvoiceId(String(billing.invoices[0].id));
      }
      setExtraName("");
      setExtraAmount("");
      toast.success("Extra fee item added");
      qc.invalidateQueries({ queryKey: ["awaiting-clearance"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not add item");
    } finally {
      setAddingExtra(false);
    }
  };

  const submit = async () => {
    if (!paymentDate) {
      toast.error("Payment date is required");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter amount received");
      return;
    }
    if (!invoiceId) {
      toast.error("No invoice — create a fee structure for this grade, then reopen");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post(
        "/finance/payments/",
        {
          invoice: invoiceId,
          amount,
          payment_method: method,
          payment_date: paymentDate,
          reference_number: reference,
          notes: `Finance clearance — ${row?.admission_number || ""}`,
        },
        { headers }
      );
      toast.success(
        `Payment recorded${res.data?.receipt_number ? ` · ${res.data.receipt_number}` : ""}`
      );
      setPayOpen(false);
      qc.invalidateQueries({ queryKey: ["awaiting-clearance"] });
      qc.invalidateQueries({ queryKey: ["owner-standing"] });
    } catch (e: any) {
      const d = e?.response?.data;
      toast.error(
        d?.payment_date?.[0] || d?.detail || (typeof d === "object" ? JSON.stringify(d) : "Payment failed")
      );
    } finally {
      setSaving(false);
    }
  };

  const rows = listQ.data || [];
  const totalDue = useMemo(
    () => rows.reduce((s: number, r: any) => s + Number(r.balance || 0), 0),
    [rows]
  );

  const lines = row?.lines || [];
  const invoices = row?.invoices || [];

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/modules/finance">
            <ArrowLeft className="h-4 w-4 mr-1" /> Finance
          </Link>
        </Button>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Banknote className="h-6 w-6 text-emerald-700" />
            Awaiting finance clearance
          </h1>
          <p className="text-sm text-muted-foreground">
            Fees load from the structure for the learner&apos;s grade, year and term. Add extra items
            (uniform, assessment book, etc.) before receiving payment.
          </p>
        </div>
      </div>

      <Card className="border-amber-100 bg-amber-50/50">
        <CardContent className="p-4 flex flex-wrap justify-between items-center gap-3">
          <span className="text-sm font-medium">Learners waiting</span>
          <span className="text-lg font-bold">{rows.length}</span>
          <span className="text-sm text-muted-foreground ml-auto">Open balances</span>
          <span className="text-lg font-bold">
            {currency} {totalDue.toLocaleString()}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b bg-slate-50/80">
          <CardTitle className="text-base">Clearance queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {listQ.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading structures & balances…</p>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No one awaiting clearance.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 border-b">
                    <th className="py-3 px-4">Admission #</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Grade</th>
                    <th className="py-3 px-4">Structure</th>
                    <th className="py-3 px-4 text-right">Expected</th>
                    <th className="py-3 px-4 text-right">Balance</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono text-xs">{r.admission_number}</td>
                      <td className="py-3 px-4 font-medium">{r.full_name}</td>
                      <td className="py-3 px-4">{r.grade || "—"}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground max-w-[180px]">
                        {r.structure?.name || (
                          <span className="text-rose-600">No structure for grade</span>
                        )}
                        {r.matched_term ? (
                          <span className="block">
                            {r.matched_term} · {r.matched_year}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {Number(r.total_due || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums">
                        {Number(r.balance || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" className="bg-emerald-600 text-white" onClick={() => openPay(r)}>
                          Receive payment
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Clearance — {row?.admission_number} {row?.full_name}
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border bg-slate-50 p-3 text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Grade:</span> {row?.grade || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Structure:</span>{" "}
              {row?.structure?.name || "Not found — create fee structure for this grade"}
            </p>
            <p>
              <span className="text-muted-foreground">Period:</span>{" "}
              {row?.matched_term || "—"} / {row?.matched_year || "—"}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Expected fee lines</p>
            {lines.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No lines yet. Ensure a fee structure exists for this grade/year/term.
              </p>
            ) : (
              <ul className="text-sm border rounded-lg divide-y max-h-40 overflow-y-auto">
                {lines.map((ln: any) => (
                  <li key={ln.line_id} className="flex justify-between px-3 py-1.5">
                    <span>{ln.description}</span>
                    <span className="font-medium tabular-nums">
                      {Number(ln.amount || 0).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm font-semibold mt-2 flex justify-between">
              <span>Balance due</span>
              <span>
                {currency} {Number(row?.balance ?? 0).toLocaleString()}
              </span>
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-emerald-300 p-3 space-y-2">
            <p className="text-sm font-medium flex items-center gap-1">
              <Plus className="h-4 w-4" /> Add extra fee item
            </p>
            <p className="text-xs text-muted-foreground">
              e.g. Assessment book, uniform — for items not on the term structure.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 sm:col-span-1">
                <Label>Item name</Label>
                <Input
                  value={extraName}
                  onChange={(e) => setExtraName(e.target.value)}
                  placeholder="Assessment book"
                />
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={extraAmount}
                  onChange={(e) => setExtraAmount(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={addingExtra}
              onClick={addExtra}
            >
              {addingExtra ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add to bill"}
            </Button>
          </div>

          <div className="space-y-3 border-t pt-3">
            <div>
              <Label>Payment date *</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Invoice / term bill *</Label>
              <Select
                value={invoiceId || "none"}
                onValueChange={(v) => setInvoiceId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select…</SelectItem>
                  {invoices.map((inv: any) => (
                    <SelectItem key={inv.id} value={String(inv.id)}>
                      {inv.invoice_number} · {inv.term || "Term"} · bal{" "}
                      {Number(inv.balance ?? 0).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount received *</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="M-PESA">M-Pesa</SelectItem>
                  <SelectItem value="BANK">Bank</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              className="bg-emerald-600 text-white"
              onClick={submit}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
