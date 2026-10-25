"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { resolveMediaUrl, stripLogoBackground } from "@/utils/media";
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
    allocated?: boolean;
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

/** Shared styles — preview and print use the same rules so output matches. */
const RECEIPT_CSS = `
  * { box-sizing: border-box; }
  .rcpt {
    width: 100%;
    max-width: 148mm;
    margin: 0 auto;
    padding: 12mm 10mm;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    color: #0f172a;
    font-size: 10pt;
    line-height: 1.35;
    text-align: center;
  }
  .rcpt-logo-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 8px;
  }
  .rcpt-logo {
    width: 96px;
    height: 96px;
    object-fit: contain;
    background: transparent;
  }
  .rcpt-logo-fallback {
    width: 88px;
    height: 88px;
    border-radius: 12px;
    background: #f0fdfa;
    border: 1px solid #99f6e4;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    color: #0f766e;
    font-size: 28px;
  }
  .rcpt-school {
    font-size: 14pt;
    font-weight: 700;
    margin: 0 0 2px;
    letter-spacing: 0.01em;
  }
  .rcpt-contact {
    font-size: 8.5pt;
    color: #64748b;
    margin: 0;
  }
  .rcpt-rule {
    border: none;
    border-top: 2px solid #0f766e;
    margin: 10px 0 8px;
  }
  .rcpt-title {
    font-size: 11pt;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #0f766e;
    margin: 0 0 10px;
  }
  .rcpt-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 20px;
    text-align: left;
    margin: 0 auto 12px;
    max-width: 85%;
    width: 85%;
    justify-content: center;
  }
  .rcpt-meta > div {
    text-align: left;
  }
  .rcpt-meta .lbl {
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
    margin: 0;
    text-align: left;
  }
  .rcpt-meta .val {
    font-size: 9.5pt;
    font-weight: 600;
    margin: 0;
    text-align: left;
  }
  .rcpt-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 9.5pt;
    margin-bottom: 10px;
  }
  .rcpt-table th {
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
    border-bottom: 1px solid #94a3b8;
    padding: 4px 2px;
    font-weight: 600;
  }
  .rcpt-table th.num, .rcpt-table td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .rcpt-table td {
    padding: 4px 2px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }
  .rcpt-cat {
    color: #94a3b8;
    font-size: 8pt;
  }
  .rcpt-summary {
    text-align: left;
    margin: 0 auto;
    max-width: 100%;
  }
  .rcpt-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 9.5pt;
    padding: 2px 0;
  }
  .rcpt-row strong { font-weight: 600; }
  .rcpt-paid {
    margin-top: 8px;
    padding: 8px 12px;
    background: #f0fdfa;
    border: 1px solid #5eead4;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 700;
    font-size: 12pt;
    color: #115e59;
  }
  .rcpt-foot {
    margin-top: 14px;
    padding-top: 8px;
    border-top: 1px dashed #94a3b8;
    font-size: 7.5pt;
    color: #64748b;
    display: flex;
    justify-content: space-between;
  }
  @page { size: A5 portrait; margin: 8mm; }
  @media print {
    body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rcpt { max-width: none; padding: 0; }
  }
`;

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
  return `${cur} ${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
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
    const html = printRef.current.outerHTML;
    const w = window.open("", "_blank", "width=640,height=900");
    if (!w) {
      toast.error("Allow pop-ups to print");
      return;
    }
    w.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>Receipt ${receipt.receipt_number}</title>
<style>${RECEIPT_CSS}</style>
</head><body>${html}
<script>window.onload=function(){window.print();}</script>
</body></html>`);
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

  const rawLogoSrc =
    receipt?.school?.logo_url ||
    (currentSchool?.logo ? resolveMediaUrl(currentSchool.logo as any) : null);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLogoSrc(null);
    if (!rawLogoSrc) return;
    (async () => {
      const cleaned = await stripLogoBackground(rawLogoSrc);
      if (cancelled) return;
      setLogoSrc(cleaned || rawLogoSrc);
    })();
    return () => {
      cancelled = true;
    };
  }, [rawLogoSrc]);

  const schoolName = receipt?.school?.name || currentSchool?.name || "School";
  const cur = receipt?.school?.currency || currency;
  const dateStr =
    receipt?.payment_date ||
    (receipt?.paid_at ? String(receipt.paid_at).slice(0, 10) : "—");
  const hasAlloc = (receipt?.line_items || []).some((l) => l.allocated);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      <style dangerouslySetInnerHTML={{ __html: RECEIPT_CSS }} />

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/modules/finance">
            <ArrowLeft className="h-4 w-4 mr-1" /> Finance
          </Link>
        </Button>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-2xl font-bold tracking-tight">Payment receipts</h1>
          <p className="text-sm text-muted-foreground">
            Preview and print match exactly (A5).
          </p>
        </div>
        <Button
          type="button"
          className="bg-emerald-700 text-white"
          disabled={!receipt}
          onClick={printReceipt}
        >
          <Printer className="h-4 w-4 mr-1" /> Print
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
                      <p className="font-semibold text-sm leading-tight">
                        {studentLabel(p)}
                      </p>
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
            <CardTitle className="text-base">Preview (same as print)</CardTitle>
            {receipt && (
              <Button type="button" size="sm" variant="outline" onClick={printReceipt}>
                <Printer className="h-4 w-4 mr-1" /> Print
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 flex justify-center bg-slate-100/60">
            {loadingReceipt ? (
              <p className="py-16 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading…
              </p>
            ) : !receipt ? (
              <p className="py-16 text-sm text-muted-foreground">
                Select a payment to preview the receipt.
              </p>
            ) : (
              <div className="bg-white shadow-md border border-slate-200 w-full max-w-[148mm]">
                <div className="rcpt" ref={printRef}>
                  <div className="rcpt-logo-wrap">
                    {logoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoSrc} alt={schoolName} className="rcpt-logo" />
                    ) : (
                      <div className="rcpt-logo-fallback">
                        {(schoolName || "S").slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <p className="rcpt-school">{schoolName}</p>
                  {receipt.school?.address ? (
                    <p className="rcpt-contact">{receipt.school.address}</p>
                  ) : null}
                  <p className="rcpt-contact">
                    {[receipt.school?.phone, receipt.school?.email]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <hr className="rcpt-rule" />
                  <p className="rcpt-title">FEE RECEIPT</p>

                  <div className="rcpt-meta">
                    <div>
                      <p className="lbl">Receipt No.</p>
                      <p className="val">{receipt.receipt_number}</p>
                    </div>
                    <div>
                      <p className="lbl">Date</p>
                      <p className="val">{dateStr}</p>
                    </div>
                    <div>
                      <p className="lbl">Student</p>
                      <p className="val">{receipt.student_name}</p>
                    </div>
                    <div>
                      <p className="lbl">Admission No.</p>
                      <p className="val">{receipt.admission_number || "—"}</p>
                    </div>
                    <div>
                      <p className="lbl">Class</p>
                      <p className="val">{receipt.grade || "—"}</p>
                    </div>
                    <div>
                      <p className="lbl">Term / Year</p>
                      <p className="val">
                        {receipt.invoice_term || "—"} · {receipt.invoice_year || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="lbl">Invoice</p>
                      <p className="val" style={{ fontFamily: "ui-monospace, monospace", fontSize: "9pt" }}>
                        {receipt.invoice_number}
                      </p>
                    </div>
                    <div>
                      <p className="lbl">Method</p>
                      <p className="val">
                        {receipt.payment_method}
                        {receipt.reference_number
                          ? ` · ${receipt.reference_number}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <table className="rcpt-table">
                    <thead>
                      <tr>
                        <th>Fee item</th>
                        <th className="num">
                          {hasAlloc ? "This payment" : "Billed"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(receipt.line_items || []).map((ln, i) => (
                        <tr key={i}>
                          <td>
                            {ln.description}
                            {ln.category ? (
                              <span className="rcpt-cat"> · {ln.category}</span>
                            ) : null}
                          </td>
                          <td className="num">
                            {Number(ln.amount || ln.line_amount || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="rcpt-summary">
                    <div className="rcpt-row">
                      <span>Invoice total</span>
                      <strong>{money(receipt.invoice_amount_due, cur)}</strong>
                    </div>
                    <div className="rcpt-row">
                      <span>Paid to date</span>
                      <strong>{money(receipt.invoice_amount_paid, cur)}</strong>
                    </div>
                    <div className="rcpt-row">
                      <span>Balance due</span>
                      <strong>{money(receipt.invoice_balance, cur)}</strong>
                    </div>
                    <div className="rcpt-paid">
                      <span>Amount received</span>
                      <span>{money(receipt.amount, cur)}</span>
                    </div>
                  </div>

                  <div className="rcpt-foot">
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
