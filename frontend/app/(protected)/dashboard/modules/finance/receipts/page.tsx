"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { resolveMediaUrl } from "@/utils/media";
import { Loader2, ArrowLeft, Printer, Search } from "lucide-react";

type PaymentRow = {
  id: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  receipt_number?: string;
  payment_date?: string;
  paid_at?: string;
  invoice_number?: string;
  student_name?: string;
  admission_number?: string;
  invoice?: any;
};

type Receipt = {
  payment_id: string;
  receipt_number: string;
  invoice_number: string;
  student_name: string;
  admission_number: string;
  grade?: string;
  payment_method: string;
  reference_number: string;
  amount: number;
  payment_date?: string;
  paid_at?: string;
  invoice_amount_due: number;
  invoice_amount_paid: number;
  invoice_balance: number;
  invoice_term: string;
  invoice_year: string;
  line_items: Array<{
    description: string;
    category: string;
    line_amount?: number;
    amount: number;
  }>;
  notes?: string;
  school?: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    logo_url?: string | null;
    currency?: string;
  };
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

function studentLabel(p: PaymentRow): string {
  if (p.student_name) return p.student_name;
  try {
    const s = p.invoice?.student;
    if (s?.first_name || s?.last_name) {
      return `${s.first_name || ""} ${s.last_name || ""}`.trim();
    }
    if (typeof s?.full_name === "string") return s.full_name;
  } catch { /* */ }
  return "Student";
}

export default function ReceiptPrintPage() {
  const { currentSchool } = useCurrentSchool();
  const schoolId = currentSchool?.id;
  const currency =
    currentSchool?.currency_symbol || currentSchool?.currency || "KES";
  const headers = schoolId ? { "X-School-ID": String(schoolId) } : undefined;
  const printRef = useRef<HTMLDivElement>(null);

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [search, setSearch] = useState("");

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/finance/payments/", {
        headers,
        params: { limit: 50 },
      });
      setPayments(asList(response.data));
    } catch (error) {
      console.error("Failed to fetch payments", error);
      toast.error("Unable to load payment history.");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  const loadReceipt = async (paymentId: string) => {
    setSelectedPaymentId(paymentId);
    setLoadingReceipt(true);
    setReceipt(null);
    try {
      const response = await api.get(`/finance/payments/${paymentId}/receipt/`, {
        headers,
      });
      setReceipt(response.data);
    } catch (error) {
      console.error("Failed to load receipt", error);
      toast.error("Unable to load receipt details.");
    } finally {
      setLoadingReceipt(false);
    }
  };

  const printReceipt = () => {
    if (!receipt || !printRef.current) {
      toast.error("Select a receipt first.");
      return;
    }
    const html = printRef.current.innerHTML;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast.error("Allow pop-ups to print");
      return;
    }
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt ${receipt.receipt_number}</title>
<style>
  body { font-family: system-ui, sans-serif; color: #0f172a; margin: 24px; }
  .receipt { max-width: 720px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; }
  .head { display: flex; gap: 16px; align-items: center; border-bottom: 2px solid #0f766e; padding-bottom: 16px; margin-bottom: 16px; }
  .logo { width: 72px; height: 72px; object-fit: contain; }
  h1 { font-size: 18px; margin: 0; }
  .muted { color: #64748b; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  th { color: #64748b; font-weight: 600; }
  .right { text-align: right; }
  .totals { margin-top: 16px; text-align: right; }
  .totals strong { font-size: 18px; }
  .foot { margin-top: 28px; font-size: 11px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
  @media print { body { margin: 0; } .receipt { border: none; } }
</style></head><body>${html}
<script>window.onload=function(){window.print();}</script></body></html>`);
    w.document.close();
  };

  const filtered = payments.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      studentLabel(p).toLowerCase().includes(q) ||
      (p.admission_number || "").toLowerCase().includes(q) ||
      (p.invoice_number || p.invoice?.invoice_number || "").toLowerCase().includes(q) ||
      (p.receipt_number || "").toLowerCase().includes(q)
    );
  });

  const logoSrc =
    receipt?.school?.logo_url ||
    (currentSchool?.logo ? resolveMediaUrl(currentSchool.logo as any) : null);
  const schoolName = receipt?.school?.name || currentSchool?.name || "School";
  const cur = receipt?.school?.currency || currency;

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/modules/finance">
            <ArrowLeft className="h-4 w-4 mr-1" /> Finance
          </Link>
        </Button>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-2xl font-bold tracking-tight">Payment receipts</h1>
          <p className="text-sm text-muted-foreground">
            Print official receipts for school fee collections and balance payments.
          </p>
        </div>
        <Button
          type="button"
          className="bg-emerald-700 text-white"
          disabled={!receipt}
          onClick={printReceipt}
        >
          <Printer className="h-4 w-4 mr-1" /> Print receipt
        </Button>
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50/80 pb-3">
            <CardTitle className="text-base">Payment history</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name, adm #, receipt…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No payments found.</p>
            ) : (
              <ul className="divide-y">
                {filtered.map((p) => {
                  const active = selectedPaymentId === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => loadReceipt(p.id)}
                        className={`w-full text-left px-4 py-3 hover:bg-emerald-50/60 transition ${
                          active ? "bg-emerald-50 border-l-4 border-emerald-600" : ""
                        }`}
                      >
                        <p className="font-semibold text-sm">{studentLabel(p)}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.admission_number ? `${p.admission_number} · ` : ""}
                          {p.invoice_number || p.invoice?.invoice_number || "Invoice"}
                        </p>
                        <p className="text-sm mt-1 flex justify-between">
                          <span className="tabular-nums font-medium">
                            {cur} {Number(p.amount || 0).toLocaleString()}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {p.payment_date ||
                              (p.paid_at ? String(p.paid_at).slice(0, 10) : "")}
                          </span>
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50/80 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Receipt preview</CardTitle>
            {receipt && (
              <Button type="button" size="sm" variant="outline" onClick={printReceipt}>
                <Printer className="h-4 w-4 mr-1" /> Print
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {loadingReceipt ? (
              <p className="py-16 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading receipt…
              </p>
            ) : !receipt ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Select a payment from the list to preview and print the receipt.
              </p>
            ) : (
              <div ref={printRef}>
                <div className="receipt max-w-xl mx-auto border border-slate-200 rounded-xl p-6 bg-white">
                  <div className="head flex gap-4 items-center border-b-2 border-teal-700 pb-4 mb-4">
                    {logoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoSrc} alt="" className="logo w-16 h-16 object-contain" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-800 font-bold text-lg">
                        {(schoolName || "S").slice(0, 1)}
                      </div>
                    )}
                    <div>
                      <h1 className="text-lg font-bold text-slate-900">{schoolName}</h1>
                      {receipt.school?.address ? (
                        <p className="muted text-xs text-slate-500">{receipt.school.address}</p>
                      ) : null}
                      <p className="muted text-xs text-slate-500">
                        {[receipt.school?.phone, receipt.school?.email].filter(Boolean).join(" · ")}
                      </p>
                      <p className="text-sm font-semibold text-teal-800 mt-1">OFFICIAL FEE RECEIPT</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div>
                      <p className="text-xs text-slate-500">Receipt No.</p>
                      <p className="font-mono font-semibold">{receipt.receipt_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Date</p>
                      <p className="font-semibold">
                        {receipt.payment_date ||
                          (receipt.paid_at ? String(receipt.paid_at).slice(0, 10) : "—")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Student</p>
                      <p className="font-semibold">{receipt.student_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Admission No.</p>
                      <p className="font-semibold">{receipt.admission_number || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Class / Grade</p>
                      <p className="font-semibold">{receipt.grade || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Term / Year</p>
                      <p className="font-semibold">
                        {receipt.invoice_term || "—"} · {receipt.invoice_year || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Invoice</p>
                      <p className="font-mono text-sm">{receipt.invoice_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Method</p>
                      <p className="font-semibold">
                        {receipt.payment_method}
                        {receipt.reference_number ? ` · ${receipt.reference_number}` : ""}
                      </p>
                    </div>
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-slate-500 border-b">
                        <th className="py-2">Description</th>
                        <th className="py-2">Category</th>
                        <th className="py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(receipt.line_items || []).map((ln, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-2">{ln.description}</td>
                          <td className="py-2 text-slate-500">{ln.category}</td>
                          <td className="py-2 text-right tabular-nums">
                            {Number(ln.amount || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="totals mt-4 space-y-1 text-sm text-right">
                    <p>
                      Invoice total: {cur}{" "}
                      {Number(receipt.invoice_amount_due || 0).toLocaleString()}
                    </p>
                    <p>
                      Total paid on invoice: {cur}{" "}
                      {Number(receipt.invoice_amount_paid || 0).toLocaleString()}
                    </p>
                    <p>
                      Balance: {cur}{" "}
                      {Number(receipt.invoice_balance || 0).toLocaleString()}
                    </p>
                    <p className="text-lg font-bold text-teal-900 pt-1">
                      Amount received: {cur} {Number(receipt.amount || 0).toLocaleString()}
                    </p>
                  </div>

                  {receipt.notes ? (
                    <p className="text-xs text-slate-500 mt-3">Notes: {receipt.notes}</p>
                  ) : null}

                  <div className="foot mt-8 text-xs text-slate-500 border-t border-dashed border-slate-300 pt-3 flex justify-between">
                    <span>Computer-generated receipt · Valid without signature</span>
                    <span>Thank you</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
