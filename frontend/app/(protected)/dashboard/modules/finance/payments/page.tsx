"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { FinanceNavLinks } from "../components/FinanceNav";
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
  student_name?: string;
  student_admission?: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  is_paid: boolean;
  term?: string;
  academic_year?: string;
};

type InvoiceLine = {
  id: string;
  description: string;
  category?: string;
  amount: number;
  paid_amount: number;
  remaining_balance: number;
};

type InvoicePayment = {
  id: string;
  amount: number;
  payment_method: string;
  payment_date?: string | null;
  line_allocations: Array<{
    line_id?: string;
    description?: string;
    amount: number;
  }>;
};

type InvoiceDetailResponse = {
  balance?: number;
  unallocated_paid?: number;
  lines?: Array<{
    id: string | number;
    description?: string;
    category_name?: string;
    category?: string;
    amount?: number;
    paid_amount?: number;
    remaining_balance?: number;
  }>;
  payments?: Array<{
    id: string;
    amount: number;
    payment_method: string;
    payment_date?: string | null;
    line_allocations?: InvoicePayment["line_allocations"];
  }>;
};

type PaymentListItem = {
  id: string;
  amount: number;
  payment_date?: string | null;
  paid_at?: string | null;
  payment_method: string;
  receipt_number?: string;
  reference_number?: string;
};

function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data !== null && typeof data === "object") {
    const o = data as { results?: unknown; data?: unknown };
    if (Array.isArray(o.results)) return o.results as T[];
    if (Array.isArray(o.data)) return o.data as T[];
  }
  return [];
}

export default function PaymentsPage() {
  const { currentSchool } = useCurrentSchool();
  const schoolId = currentSchool?.id;
  const currency = currentSchool?.currency_symbol || currentSchool?.currency || "KES";
  const headers = schoolId ? { "X-School-ID": String(schoolId) } : undefined;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentListItem[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [loadingPay, setLoadingPay] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(true);

  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([]);
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>([]);
  const [unallocatedPaid, setUnallocatedPaid] = useState(0);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [loadingLines, setLoadingLines] = useState(false);
  const [lineLoadError, setLineLoadError] = useState("");

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
      const list = asList<Invoice>(res.data).filter(
        (inv) => Number(inv.balance ?? 0) > 0 || !inv.is_paid
      );
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
      setPayments(asList<PaymentListItem>(res.data));
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

  const onSelectInvoice = async (id: string) => {
    setSelectedInvoice(id);
    setInvoiceLines([]);
    setInvoicePayments([]);
    setUnallocatedPaid(0);
    setAllocations({});
    setLineLoadError("");
    const inv = invoices.find((i) => String(i.id) === String(id));
    if (inv) {
      const bal = Number(
        inv.balance ??
          Math.max(0, Number(inv.amount_due || 0) - Number(inv.amount_paid || 0))
      );
      setPaymentAmount(bal > 0 ? String(bal) : "");
    }
    if (!id) return;
    setLoadingLines(true);
    try {
      const res = await api.get(`/finance/invoices/${id}/`, { headers });
      const detail = res.data as InvoiceDetailResponse;
      const lines = Array.isArray(detail?.lines) ? detail.lines : [];
      const mapped = lines.map((ln) => ({
        id: String(ln.id),
        description: ln.description || "Fee item",
        category: ln.category_name || ln.category || "",
        amount: Number(ln.amount || 0),
        paid_amount: Number(ln.paid_amount || 0),
        remaining_balance: Number(
          ln.remaining_balance ??
            Math.max(0, Number(ln.amount || 0) - Number(ln.paid_amount || 0))
        ),
      }));
      setInvoiceLines(mapped);
      setInvoicePayments(
        Array.isArray(detail?.payments)
          ? detail.payments.map((payment) => ({
              ...payment,
              line_allocations: Array.isArray(payment.line_allocations)
                ? payment.line_allocations
                : [],
            }))
          : []
      );
      setUnallocatedPaid(Number(detail?.unallocated_paid || 0));
      const currentBalance = Number(detail?.balance);
      if (Number.isFinite(currentBalance)) {
        setPaymentAmount(currentBalance > 0 ? String(currentBalance) : "");
      }
    } catch (e) {
      console.error("Could not load invoice payment details", e);
      setLineLoadError("Could not load this invoice's fee-item balances. Try selecting it again.");
      setInvoiceLines([]);
      toast.error("Could not load invoice fee-item balances");
    } finally {
      setLoadingLines(false);
    }
  };

  const allocTotal = Object.values(allocations).reduce(
    (s, v) => s + (Number(v) || 0),
    0
  );
  const overallocatedLines = invoiceLines.filter(
    (line) =>
      Math.round((Number(allocations[line.id]) || 0) * 100) >
      Math.round(line.remaining_balance * 100)
  );

  const applyProportional = () => {
    const amt = Number(paymentAmount) || 0;
    if (amt <= 0 || invoiceLines.length === 0) return;
    const remainingTotal = invoiceLines.reduce((s, l) => s + l.remaining_balance, 0);
    if (remainingTotal <= 0) return;
    const amountToAllocate = Math.min(amt, remainingTotal);
    const next: Record<string, string> = {};
    let remaining = amountToAllocate;
    invoiceLines.forEach((ln, i) => {
      if (i === invoiceLines.length - 1) {
        const share = Math.min(ln.remaining_balance, remaining);
        next[ln.id] = String(Math.round(share * 100) / 100);
      } else {
        const share = Math.min(
          ln.remaining_balance,
          Math.round((ln.remaining_balance / remainingTotal) * amountToAllocate * 100) / 100
        );
        next[ln.id] = String(share);
        remaining -= share;
      }
    });
    setAllocations(next);
  };

  const applyToFirst = () => {
    const amt = Number(paymentAmount) || 0;
    if (amt <= 0 || invoiceLines.length === 0) return;
    const next: Record<string, string> = {};
    let remaining = amt;
    invoiceLines.forEach((ln) => {
      const amount = Math.min(ln.remaining_balance, remaining);
      next[ln.id] = String(Math.round(amount * 100) / 100);
      remaining -= amount;
    });
    setAllocations(next);
  };

  const clearAllocations = () => setAllocations({});

  const handleRecordPayment = async () => {
    if (!selectedInvoice) {
      toast.error("Select an invoice");
      return;
    }
    if (!paymentDate) {
      toast.error("Payment date is required — pick the date money was received");
      return;
    }
    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (lineLoadError) {
      toast.error("Reload the invoice fee-item balances before recording payment.");
      return;
    }

    setSubmitting(true);
    try {
      const line_allocations = invoiceLines
        .map((ln) => ({
          line_id: ln.id,
          description: ln.description,
          category: ln.category || "",
          amount: Number(allocations[ln.id] || 0),
        }))
        .filter((r) => r.amount > 0);

      if (invoiceLines.length > 0) {
        const sum = line_allocations.reduce((s, r) => s + r.amount, 0);
        if (Math.abs(sum - amt) > 0.05) {
          toast.error(
            `Allocation total (${sum.toLocaleString()}) must equal payment (${amt.toLocaleString()}).`
          );
          setSubmitting(false);
          return;
        }
        if (overallocatedLines.length > 0) {
          toast.error(
            `Allocation exceeds the remaining balance for ${overallocatedLines[0].description}.`
          );
          setSubmitting(false);
          return;
        }
      }

      const res = await api.post(
        "/finance/payments/",
        {
          invoice: selectedInvoice,
          amount: amt,
          payment_method: paymentMethod,
          payment_date: paymentDate,
          reference_number: referenceNumber || "",
          notes: notes || "",
          ...(line_allocations.length ? { line_allocations } : {}),
        },
        { headers }
      );
      toast.success(
        `Payment recorded${res.data?.receipt_number ? ` · ${res.data.receipt_number}` : ""}`
      );
      setSelectedInvoice("");
      setPaymentAmount("");
      setReferenceNumber("");
      setNotes("");
      setInvoiceLines([]);
      setInvoicePayments([]);
      setUnallocatedPaid(0);
      setAllocations({});
      setLineLoadError("");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      void loadInvoices();
      void loadPayments();
    } catch (err: unknown) {
      console.error(err);
      const responseData = (err as { response?: { data?: unknown } })?.response?.data;
      let msg = "Failed to record payment";
      if (typeof responseData === "string") {
        msg = responseData;
      } else if (responseData !== null && typeof responseData === "object") {
        const data = responseData as Record<string, unknown>;
        for (const field of ["detail", "amount", "payment_date", "line_allocations"]) {
          const value = data[field];
          if (typeof value === "string") {
            msg = value;
            break;
          }
          if (Array.isArray(value) && value.length > 0) {
            msg = String(value[0]);
            break;
          }
        }
        if (msg === "Failed to record payment") msg = JSON.stringify(responseData);
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const priorPayments = [...invoicePayments].sort((a, b) =>
    (a.payment_date || "").localeCompare(b.payment_date || "")
  );

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-5xl mx-auto">
      <FinanceNavLinks />
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/modules/finance">
            <ArrowLeft className="h-4 w-4 mr-1" /> Finance
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Record term payments</h1>
          <p className="text-sm text-muted-foreground">
            Always set the payment date to the day money was actually received.
          </p>
        </div>
      </div>

      <Card className="border-emerald-200 shadow-sm">
        <CardHeader className="bg-emerald-50/80 border-b">
          <CardTitle className="text-base">Receive payment</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4 pt-4">
          {/* DATE FIRST — always visible */}
          <div className="sm:col-span-2 rounded-xl border-2 border-emerald-600/30 bg-white p-4">
            <Label className="text-base font-semibold text-emerald-900">
              Payment date *
            </Label>
            <Input
              type="date"
              className="mt-2 max-w-xs text-base h-11"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground mt-2">
              Pick the real collection date (including backdated fees for past terms).
            </p>
          </div>

          <div className="sm:col-span-2">
            <Label>Open invoice *</Label>
            {loadingInv ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices…
              </p>
            ) : (
              <Select
                value={selectedInvoice || "none"}
                onValueChange={(v) => onSelectInvoice(v === "none" ? "" : v)}
              >
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
            <Input
              className="mt-2 max-w-sm"
              placeholder="Filter by name / admission #…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {selectedInvoice && (
            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Allocate payment to fee items</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" size="sm" variant="outline" onClick={applyProportional}>
                    Split by ratio
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={applyToFirst}>
                    Apply to first item
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={clearAllocations}>
                    Clear
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Review previous allocations and remaining balances, then allocate the full payment.
                Receipts will show how this payment was applied.
              </p>
              {priorPayments.length > 0 && (
                <div className="rounded-lg border bg-white p-2 space-y-2">
                  <p className="text-xs font-semibold">Previous payments (oldest first)</p>
                  {priorPayments.map((payment) => (
                    <div key={payment.id} className="border-t pt-1.5 text-xs">
                      <p className="font-medium">
                        {payment.payment_date || "Date unavailable"} · {payment.payment_method} ·{" "}
                        {Number(payment.amount || 0).toLocaleString()}
                      </p>
                      {payment.line_allocations.length > 0 ? (
                        <p className="text-muted-foreground">
                          {payment.line_allocations
                            .map(
                              (allocation) =>
                                `${allocation.description || "Fee item"}: ${Number(
                                  allocation.amount || 0
                                ).toLocaleString()}`
                            )
                            .join(" · ")}
                        </p>
                      ) : (
                        <p className="text-amber-700">
                          No fee-item allocation was recorded for this payment.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {unallocatedPaid > 0 && (
                <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
                  {unallocatedPaid.toLocaleString()} of previous payments has no recorded
                  fee-item allocation. Item balances below only subtract payments with a
                  recorded allocation.
                </p>
              )}
              {loadingLines ? (
                <p className="text-xs text-muted-foreground">Loading fee items…</p>
              ) : lineLoadError ? (
                <p className="text-xs text-destructive">{lineLoadError}</p>
              ) : invoiceLines.length === 0 ? (
                <p className="text-xs text-muted-foreground">No line items on this invoice.</p>
              ) : (
                <ul className="space-y-1.5">
                  {invoiceLines.map((ln) => (
                    <li
                      key={ln.id}
                      className="grid grid-cols-[1fr_110px] gap-2 items-center text-sm bg-white rounded-lg border px-2 py-1.5"
                    >
                      <span>
                        {ln.description}
                        {ln.category ? (
                          <span className="text-xs text-muted-foreground"> · {ln.category}</span>
                        ) : null}
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          Billed {ln.amount.toLocaleString()} · previously allocated{" "}
                          {ln.paid_amount.toLocaleString()} · remaining{" "}
                          {ln.remaining_balance.toLocaleString()}
                        </span>
                      </span>
                      <Input
                        type="number"
                        min="0"
                        max={ln.remaining_balance}
                        step="0.01"
                        className="h-8"
                        placeholder="0"
                        value={allocations[ln.id] ?? ""}
                        onChange={(e) =>
                          setAllocations((prev) => ({ ...prev, [ln.id]: e.target.value }))
                        }
                      />
                      {Math.round((Number(allocations[ln.id]) || 0) * 100) >
                        Math.round(ln.remaining_balance * 100) && (
                        <span className="col-span-2 text-xs text-destructive">
                          Allocation exceeds this item&apos;s remaining balance.
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {invoiceLines.length > 0 && (
                <p
                  className={`text-xs font-medium ${
                    Math.abs(allocTotal - Number(paymentAmount || 0)) < 0.05
                      ? "text-emerald-700"
                      : "text-amber-700"
                  }`}
                >
                  Allocated: {allocTotal.toLocaleString()}
                  {paymentAmount
                    ? ` / payment ${Number(paymentAmount).toLocaleString()}`
                    : ""}
                </p>
              )}
            </div>
          )}

          <div>
            <Label>Amount *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
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
            <Label>Reference (MPESA / bank ref)</Label>
            <Input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <Button
              type="button"
              disabled={
                submitting ||
                loadingLines ||
                Boolean(lineLoadError) ||
                overallocatedLines.length > 0
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[160px]"
              onClick={handleRecordPayment}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save payment"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent payments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingPay ? (
            <p className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
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
                        {p.payment_date ||
                          (p.paid_at ? String(p.paid_at).slice(0, 10) : "—")}
                      </td>
                      <td className="py-2 px-4 font-mono text-xs">
                        {p.receipt_number || p.reference_number || "—"}
                      </td>
                      <td className="py-2 px-4">{p.payment_method}</td>
                      <td className="py-2 px-4 text-right font-semibold tabular-nums">
                        {currency} {Number(p.amount || 0).toLocaleString()}
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
