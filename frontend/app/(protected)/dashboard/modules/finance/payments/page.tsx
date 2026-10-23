"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Loader2, ArrowLeft, Plus } from "lucide-react";

type Invoice = {
  id: string;
  invoice_number: string;
  student?: string;
  student_name?: string;
  student_admission?: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  is_paid: boolean;
  term?: string;
  academic_year?: string;
  due_date?: string;
};

type Payment = {
  id: string;
  invoice?: { id: string; invoice_number?: string } | string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  payment_date?: string;
  paid_at?: string;
  receipt_number?: string;
  notes?: string;
};

function asList(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as any;
    if (Array.isArray(o.results)) return o.results;
    if (Array.isArray(o.data)) return o.data;
  }
  return [];
}

export default function PaymentsPage() {
  const { currentSchool } = useCurrentSchool();
  const schoolId = currentSchool?.id;
  const currency = currentSchool?.currency_symbol || currentSchool?.currency || "KES";
  const headers = schoolId ? { "X-School-ID": String(schoolId) } : undefined;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [loadingPay, setLoadingPay] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  const loadInvoices = useCallback(async () => {
    if (!schoolId) {
      setInvoices([]);
      setLoadingInv(false);
      return;
    }
    setLoadingInv(true);
    try {
      const res = await api.get("/finance/invoices/", {
        headers,
        params: { unpaid: "1" },
      });
      const list = asList(res.data).filter((inv: Invoice) => Number(inv.balance ?? 0) > 0 || !inv.is_paid);
      setInvoices(list);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load open invoices");
      setInvoices([]);
    } finally {
      setLoadingInv(false);
    }
  }, [schoolId]);

  const loadPayments = useCallback(async () => {
    if (!schoolId) {
      setPayments([]);
      setLoadingPay(false);
      return;
    }
    setLoadingPay(true);
    try {
      const res = await api.get("/finance/payments/", {
        headers,
        params: { limit: 30 },
      });
      setPayments(asList(res.data));
    } catch (e) {
      console.error(e);
      setPayments([]);
    } finally {
      setLoadingPay(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadInvoices();
    void loadPayments();
  }, [loadInvoices, loadPayments]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => {
      const name = (inv.student_name || "").toLowerCase();
      const adm = (inv.student_admission || "").toLowerCase();
      const num = (inv.invoice_number || "").toLowerCase();
      return name.includes(q) || adm.includes(q) || num.includes(q);
    });
  }, [invoices, searchQuery]);

  const onSelectInvoice = (id: string) => {
    setSelectedInvoice(id);
    const inv = invoices.find((i) => String(i.id) === String(id));
    if (inv) {
      const bal = Number(inv.balance ?? Math.max(0, Number(inv.amount_due || 0) - Number(inv.amount_paid || 0)));
      setPaymentAmount(bal > 0 ? String(bal) : "");
    }
  };

  const handleSubmit = async () => {
    if (!selectedInvoice) {
      toast.error("Select an invoice");
      return;
    }
    if (!paymentDate) {
      toast.error("Payment date is required");
      return;
    }
    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(
        "/finance/payments/",
        {
          invoice: selectedInvoice,
          amount: amt,
          payment_method: paymentMethod,
          payment_date: paymentDate,
          reference_number: referenceNumber,
          notes,
        },
        { headers }
      );
      toast.success(
        `Payment recorded${res.data?.receipt_number ? ` · ${res.data.receipt_number}` : ""}`
      );
      setShowForm(false);
      setSelectedInvoice("");
      setPaymentAmount("");
      setReferenceNumber("");
      setNotes("");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      void loadInvoices();
      void loadPayments();
    } catch (err: any) {
      const d = err?.response?.data;
      toast.error(
        d?.payment_date?.[0] ||
          d?.detail ||
          (typeof d === "object" ? JSON.stringify(d) : "Failed to record payment")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/modules/finance">
            <ArrowLeft className="h-4 w-4 mr-1" /> Finance
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Record term payments</h1>
          <p className="text-sm text-muted-foreground">
            Open invoices only. Payment date is required for the books.
          </p>
        </div>
        <Button
          type="button"
          className="bg-emerald-600 text-white"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="h-4 w-4 mr-1" />
          {showForm ? "Hide form" : "New payment"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receive payment</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Open invoice *</Label>
              {loadingInv ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices…
                </p>
              ) : (
                <Select value={selectedInvoice || "none"} onValueChange={(v) => onSelectInvoice(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select student invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select…</SelectItem>
                    {filtered.map((inv) => (
                      <SelectItem key={inv.id} value={String(inv.id)}>
                        {(inv.student_name || "Student") +
                          (inv.student_admission ? ` (${inv.student_admission})` : "") +
                          ` · ${inv.invoice_number} · bal ${Number(inv.balance || 0).toLocaleString()}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Payment date *</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use the real date money was received (required).
              </p>
            </div>
            <div>
              <Label>Amount *</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
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
              <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submitting}
                className="bg-emerald-600 text-white"
                onClick={handleSubmit}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save payment"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Open invoices</CardTitle>
          <Input
            className="max-w-xs"
            placeholder="Search name, admission #, invoice…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </CardHeader>
        <CardContent className="p-0">
          {loadingInv ? (
            <p className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No open balances.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 border-b">
                    <th className="py-2 px-4">Student</th>
                    <th className="py-2 px-4">Invoice</th>
                    <th className="py-2 px-4">Term</th>
                    <th className="py-2 px-4 text-right">Balance</th>
                    <th className="py-2 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-100">
                      <td className="py-2 px-4">
                        {inv.student_name || "—"}
                        {inv.student_admission ? (
                          <span className="block text-xs text-muted-foreground">
                            {inv.student_admission}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 px-4 font-mono text-xs">{inv.invoice_number}</td>
                      <td className="py-2 px-4 text-xs">
                        {inv.term || "—"} {inv.academic_year || ""}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold tabular-nums">
                        {currency} {Number(inv.balance || 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-4 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowForm(true);
                            onSelectInvoice(String(inv.id));
                          }}
                        >
                          Pay
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent payments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingPay ? (
            <p className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
            </p>
          ) : payments.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 border-b">
                    <th className="py-2 px-4">Date</th>
                    <th className="py-2 px-4">Receipt</th>
                    <th className="py-2 px-4">Method</th>
                    <th className="py-2 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-2 px-4">
                        {p.payment_date || (p.paid_at ? String(p.paid_at).slice(0, 10) : "—")}
                      </td>
                      <td className="py-2 px-4 font-mono text-xs">
                        {p.receipt_number || p.reference_number || "—"}
                      </td>
                      <td className="py-2 px-4">{p.payment_method}</td>
                      <td className="py-2 px-4 text-right font-semibold tabular-nums">
                        {Number(p.amount || 0).toLocaleString()}
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
