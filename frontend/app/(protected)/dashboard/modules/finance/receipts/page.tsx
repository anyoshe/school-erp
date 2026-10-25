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
  } catch { /* */ }
  return "Student";
}

function money(n: number, cur: string) {
  return `${cur} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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
      console.error(error);
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
      console.error(error);
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
    const w = window.open("", "_blank", "width=560,height=800");
    if (!w) {
      toast.error("Allow pop-ups to print");
      return;
    }
    w.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>Receipt ${receipt.receipt_number}</title>
<style>
  @page { size: A5 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", system-ui, sans-serif;
    color: #0f172a;
    margin: 0;
    font-size: 10.5pt;
    line-height: 1.25;
  }
  .sheet {
    width: 100%;
    max-width: 148mm;
    margin: 0 auto;
    padding: 0;
  }
  .head {
    display: grid;
    grid-template-columns: 48px 1fr;
    gap: 8px;
    align-items: center;
    border-bottom: 2px solid #0f766e;
    padding-bottom: 6px;
    margin-bottom: 8px;
  }
  .logo { width: 48px; height: 48px; object-fit: contain; }
  .logo-fallback {
    width: 48px; height: 48px; border-radius: 6px;
    background: #f0fdfa; border: 1px solid #99f6e4;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; color: #0f766e; font-size: 16px;
  }
  .school-name { font-size: 12pt; font-weight: 700; margin: 0; }
  .meta-line { font-size: 8pt; color: #64748b; margin: 1px 0 0; }
  .title {
    text-align: center; font-size: 10pt; font-weight: 700;
    letter-spacing: 0.06em; color: #0f766e; margin: 6px 0 8px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px 12px;
    margin-bottom: 8px;
    font-size: 9pt;
  }
  .grid .lbl { color: #64748b; font-size: 7.5pt; text-transform: uppercase; }
  .grid .val { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th {
    text-align: left; font-size: 7.5pt; text-transform: uppercase;
    color: #64748b; border-bottom: 1px solid #cbd5e1; padding: 3px 2px;
  }
  td { padding: 3px 2px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .summary {
    margin-top: 8px;
    border-top: 1px solid #cbd5e1;
    padding-top: 6px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 16px;
    font-size: 9pt;
  }
  .summary .amt { text-align: right; font-variant-numeric: tabular-nums; }
  .summary .paid {
    grid-column: 1 / -1;
    margin-top: 4px;
    padding: 6px 8px;
    background: #f0fdfa;
    border: 1px solid #99f6e4;
    border-radius: 4px;
    display: flex;
    justify-content: space-between;
    font-weight: 700;
    font-size: 11pt;
    color: #115e59;
  }
  .foot {
    margin-top: 10px;
    padding-top: 6px;
    border-top: 1px dashed #94a3b8;
    font-size: 7.5pt;
    color: #64748b;
    display: flex;
    justify-content: space-between;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head><body><div class="sheet">${html}</div>
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
  const dateStr =
    receipt?.payment_date ||
    (receipt?.paid_at ? String(receipt.paid_at).slice(0, 10) : "—");

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
            A5 official receipts — fee bill, amount received, and balance.
          </p>
        </div>
        <Button
          type="button"
          className="bg-emerald-700 text-white"
          disabled={!receipt}
          onClick={printReceipt}
        >
          <Printer className="h-4 w-4 mr-1" /> Print A5
        </Button>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-5">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50/80 pb-3">
            <CardTitle className="text-base">History</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-9"
                placeholder="Search…"
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
                {filtered.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => loadReceipt(p.id)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-emerald-50/60 transition ${
                        selectedPaymentId === p.id
                          ? "bg-emerald-50 border-l-4 border-emerald-600"
                          : ""
                      }`}
                    >
                      <p className="font-semibold text-sm leading-tight">{studentLabel(p)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.admission_number ? `${p.admission_number} · ` : ""}
                        {p.invoice_number || "Invoice"}
                      </p>
                      <p className="text-sm mt-0.5 flex justify-between">
                        <span className="font-medium tabular-nums">
                          {money(p.amount, cur)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {p.payment_date ||
                            (p.paid_at ? String(p.paid_at).slice(0, 10) : "")}
                        </span>
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50/80 flex flex-row items-center justify-between py-3">
            <CardTitle className="text-base">Preview (A5)</CardTitle>
            {receipt && (
              <Button type="button" size="sm" variant="outline" onClick={printReceipt}>
                <Printer className="h-4 w-4 mr-1" /> Print
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 flex justify-center bg-slate-100/50">
            {loadingReceipt ? (
              <p className="py-16 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading…
              </p>
            ) : !receipt ? (
              <p className="py-16 text-sm text-muted-foreground">
                Select a payment to preview the receipt.
              </p>
            ) : (
              <div
                className="bg-white shadow-md border border-slate-200 w-full max-w-[148mm] p-4"
                style={{ minHeight: "180mm" }}
              >
                <div ref={printRef}>
                  <div className="head" style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 8, alignItems: "center", borderBottom: "2px solid #0f766e", paddingBottom: 6, marginBottom: 8 }}>
                    {logoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoSrc} alt="" className="logo" style={{ width: 48, height: 48, objectFit: "contain" }} />
                    ) : (
                      <div className="logo-fallback" style={{ width: 48, height: 48, borderRadius: 6, background: "#f0fdfa", border: "1px solid #99f6e4", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#0f766e" }}>
                        {(schoolName || "S").slice(0, 1)}
                      </div>
                    )}
                    <div>
                      <p className="school-name" style={{ fontSize: "12pt", fontWeight: 700, margin: 0 }}>{schoolName}</p>
                      {receipt.school?.address ? (
                        <p className="meta-line" style={{ fontSize: "8pt", color: "#64748b", margin: "1px 0 0" }}>{receipt.school.address}</p>
                      ) : null}
                      <p className="meta-line" style={{ fontSize: "8pt", color: "#64748b", margin: 0 }}>
                        {[receipt.school?.phone, receipt.school?.email].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>

                  <p className="title" style={{ textAlign: "center", fontSize: "10pt", fontWeight: 700, letterSpacing: "0.06em", color: "#0f766e", margin: "6px 0 8px" }}>
                    FEE RECEIPT
                  </p>

                  <div className="grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 12px", marginBottom: 8, fontSize: "9pt" }}>
                    <div>
                      <div className="lbl" style={{ color: "#64748b", fontSize: "7.5pt" }}>Receipt No.</div>
                      <div className="val" style={{ fontWeight: 600 }}>{receipt.receipt_number}</div>
                    </div>
                    <div>
                      <div className="lbl" style={{ color: "#64748b", fontSize: "7.5pt" }}>Date</div>
                      <div className="val" style={{ fontWeight: 600 }}>{dateStr}</div>
                    </div>
                    <div>
                      <div className="lbl" style={{ color: "#64748b", fontSize: "7.5pt" }}>Student</div>
                      <div className="val" style={{ fontWeight: 600 }}>{receipt.student_name}</div>
                    </div>
                    <div>
                      <div className="lbl" style={{ color: "#64748b", fontSize: "7.5pt" }}>Admission No.</div>
                      <div className="val" style={{ fontWeight: 600 }}>{receipt.admission_number || "—"}</div>
                    </div>
                    <div>
                      <div className="lbl" style={{ color: "#64748b", fontSize: "7.5pt" }}>Class</div>
                      <div className="val" style={{ fontWeight: 600 }}>{receipt.grade || "—"}</div>
                    </div>
                    <div>
                      <div className="lbl" style={{ color: "#64748b", fontSize: "7.5pt" }}>Term / Year</div>
                      <div className="val" style={{ fontWeight: 600 }}>
                        {receipt.invoice_term || "—"} · {receipt.invoice_year || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="lbl" style={{ color: "#64748b", fontSize: "7.5pt" }}>Invoice</div>
                      <div className="val" style={{ fontWeight: 600, fontFamily: "monospace", fontSize: "8.5pt" }}>{receipt.invoice_number}</div>
                    </div>
                    <div>
                      <div className="lbl" style={{ color: "#64748b", fontSize: "7.5pt" }}>Method</div>
                      <div className="val" style={{ fontWeight: 600 }}>
                        {receipt.payment_method}
                        {receipt.reference_number ? ` · ${receipt.reference_number}` : ""}
                      </div>
                    </div>
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", fontSize: "7.5pt", textTransform: "uppercase", color: "#64748b", borderBottom: "1px solid #cbd5e1", padding: "3px 2px" }}>Fee item</th>
                        <th style={{ textAlign: "right", fontSize: "7.5pt", textTransform: "uppercase", color: "#64748b", borderBottom: "1px solid #cbd5e1", padding: "3px 2px" }}>{(receipt.line_items || []).some((l: any) => l.allocated) ? "This payment" : "Billed"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(receipt.line_items || []).map((ln, i) => (
                        <tr key={i}>
                          <td style={{ padding: "3px 2px", borderBottom: "1px solid #f1f5f9" }}>
                            {ln.description}
                            {ln.category ? (
                              <span style={{ color: "#94a3b8", fontSize: "7.5pt" }}> · {ln.category}</span>
                            ) : null}
                          </td>
                          <td className="num" style={{ textAlign: "right", padding: "3px 2px", borderBottom: "1px solid #f1f5f9", fontVariantNumeric: "tabular-nums" }}>
                            {Number(ln.amount || ln.line_amount || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="summary" style={{ marginTop: 8, borderTop: "1px solid #cbd5e1", paddingTop: 6, display: "grid", gridTemplateColumns: "1fr auto", gap: "2px 16px", fontSize: "9pt" }}>
                    <span>Invoice total</span>
                    <span className="amt" style={{ textAlign: "right" }}>{money(receipt.invoice_amount_due, cur)}</span>
                    <span>Paid to date</span>
                    <span className="amt" style={{ textAlign: "right" }}>{money(receipt.invoice_amount_paid, cur)}</span>
                    <span>Balance due</span>
                    <span className="amt" style={{ textAlign: "right", fontWeight: 600 }}>{money(receipt.invoice_balance, cur)}</span>
                    <div className="paid" style={{ gridColumn: "1 / -1", marginTop: 4, padding: "6px 8px", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 4, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "11pt", color: "#115e59" }}>
                      <span>Amount received</span>
                      <span>{money(receipt.amount, cur)}</span>
                    </div>
                  </div>

                  <div className="foot" style={{ marginTop: 10, paddingTop: 6, borderTop: "1px dashed #94a3b8", fontSize: "7.5pt", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                    <span>Computer-generated · Keep for your records</span>
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
