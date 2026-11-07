"use client";

import { FinanceNavLinks } from "../components/FinanceNav";
import Link from "next/link";

import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { resolveMediaUrl, stripLogoBackground } from "@/utils/media";
import { Loader2, Search, Download, Eye, ArrowLeft, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type Invoice = {
  id: string;
  student: { id: string; first_name: string; last_name: string };
  invoice_number: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  due_date: string;
  term: string;
  academic_year: string;
  is_paid: boolean;
  late_fee_applied: number;
  generated_at: string;
  payment_plan?: { id: string; name: string } | null;
  installment_number?: number;
};

type InvoiceDetail = Invoice & {
  payments?: Array<{
    id: string;
    amount: number;
    payment_method: string;
    reference_number?: string;
    paid_at?: string;
    payment_date?: string;
    paid_by?: string | null;
  }>;
  lines?: Array<{
    id?: string;
    description?: string;
    amount?: number;
    original_amount?: number;
    is_waived?: boolean;
    discount_amount?: number;
  }>;
  student?: Invoice["student"] & { admission_number?: string };
};

const INVOICE_PRINT_CSS = `
  * { box-sizing: border-box; }
  .inv {
    width: 100%;
    max-width: 180mm;
    margin: 0 auto;
    padding: 12mm 12mm;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    color: #0f172a;
    font-size: 10pt;
    line-height: 1.35;
  }
  .inv-logo-wrap { display: flex; justify-content: center; margin-bottom: 8px; }
  .inv-logo { width: 88px; height: 88px; object-fit: contain; background: transparent; }
  .inv-logo-fallback {
    width: 80px; height: 80px; border-radius: 12px; background: #f0fdfa;
    border: 1px solid #99f6e4; display: flex; align-items: center; justify-content: center;
    font-weight: 700; color: #0f766e; font-size: 26px;
  }
  .inv-school { text-align: center; font-size: 15pt; font-weight: 700; margin: 0 0 2px; }
  .inv-contact { text-align: center; font-size: 8.5pt; color: #64748b; margin: 0; }
  .inv-rule { border: none; border-top: 2px solid #0f766e; margin: 10px 0 8px; }
  .inv-title { text-align: center; font-size: 12pt; font-weight: 700; letter-spacing: 0.14em; color: #0f766e; margin: 0 0 12px; }
  .inv-meta {
    display: grid; grid-template-columns: 1fr 1fr; column-gap: 24px; row-gap: 8px;
    margin-bottom: 14px;
  }
  .inv-meta .lbl { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin: 0 0 1px; }
  .inv-meta .val { font-size: 9.5pt; font-weight: 600; margin: 0; overflow-wrap: anywhere; }
  .inv-status {
    display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 8pt; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
  }
  .inv-status.paid { background: #d1fae5; color: #065f46; }
  .inv-status.unpaid { background: #fef3c7; color: #92400e; }
  .inv-status.overdue { background: #fee2e2; color: #991b1b; }
  .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9.5pt; }
  .inv-table th {
    font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b;
    border-bottom: 1px solid #94a3b8; padding: 5px 4px; text-align: left; font-weight: 600;
  }
  .inv-table th.num, .inv-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .inv-table td { padding: 5px 4px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .inv-totals { margin-left: auto; width: 100%; max-width: 240px; margin-bottom: 12px; }
  .inv-totals .row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; font-size: 9.5pt; }
  .inv-totals .row.grand { border-top: 2px solid #0f766e; margin-top: 4px; padding-top: 6px; font-weight: 700; font-size: 11pt; }
  .inv-totals .bal { color: #b45309; }
  .inv-totals .ok { color: #047857; }
  .inv-foot { text-align: center; font-size: 8pt; color: #64748b; margin-top: 16px; }
  @media print {
    body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .inv { max-width: none; padding: 10mm; }
  }
`;

export default function InvoicesPage() {
  const { currentSchool } = useCurrentSchool();
  const currency = currentSchool?.currency_symbol || currentSchool?.currency || "KES";
  const printRef = useRef<HTMLDivElement>(null);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "unpaid" | "overdue">("all");
  const [filterTerm, setFilterTerm] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  
  const [terms, setTerms] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const raw =
      (currentSchool as any)?.logo_url ||
      (currentSchool?.logo ? resolveMediaUrl(currentSchool.logo as any) : null);
    if (!raw) {
      setLogoSrc(null);
      return;
    }
    (async () => {
      try {
        const cleaned = await stripLogoBackground(String(raw));
        if (!cancelled) setLogoSrc(cleaned || String(raw));
      } catch {
        if (!cancelled) setLogoSrc(String(raw));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentSchool?.id, (currentSchool as any)?.logo, (currentSchool as any)?.logo_url]);

  const printInvoice = () => {
    if (!selectedInvoice || !printRef.current) {
      toast.error("Nothing to print — open an invoice first");
      return;
    }
    // Clone node so we print a standalone document (Dialog portals can blank print)
    const clone = printRef.current.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("script").forEach((n) => n.remove());
    const html = clone.outerHTML;
    const title = String(selectedInvoice.invoice_number || "Invoice").replace(/[<>]/g, "");
    // Do not use noopener — it can yield a blank window where document.write is blocked
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) {
      toast.error("Allow pop-ups to print");
      return;
    }
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>${title}</title>
<style>${INVOICE_PRINT_CSS}</style>
</head><body>
${html}
<script>
  window.onload = function () {
    setTimeout(function () {
      try { window.focus(); window.print(); } catch (e) {}
    }, 250);
  };
</script>
</body></html>`);
    w.document.close();
  };


  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await api.get("/finance/invoices/");
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setInvoices(data);

      // Extract unique terms and years
      const uniqueTerms = [...new Set(data.map((inv: Invoice) => inv.term))].filter((t): t is string => typeof t === 'string').sort();
      const uniqueYears = [...new Set(data.map((inv: Invoice) => inv.academic_year))].filter((y): y is string => typeof y === 'string').sort().reverse();
      setTerms(uniqueTerms);
      setYears(uniqueYears);
    } catch (err) {
      console.error("Failed to fetch invoices", err);
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = invoices;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (inv) =>
          inv.student.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          inv.student.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (filterStatus === "paid") filtered = filtered.filter((inv) => inv.is_paid);
    if (filterStatus === "unpaid") filtered = filtered.filter((inv) => !inv.is_paid);
    if (filterStatus === "overdue") {
      const today = new Date();
      filtered = filtered.filter(
        (inv) => !inv.is_paid && new Date(inv.due_date) < today
      );
    }

    // Term filter
    if (filterTerm && filterTerm !== "all") filtered = filtered.filter((inv) => inv.term === filterTerm);

    // Year filter
    if (filterYear && filterYear !== "all") filtered = filtered.filter((inv) => inv.academic_year === filterYear);

    return filtered;
  };

  const filteredInvoices = applyFilters();

  const stats = {
    total: invoices.reduce((sum, inv) => sum + parseFloat(inv.amount_due.toString()), 0),
    paid: invoices.reduce((sum, inv) => sum + parseFloat(inv.amount_paid.toString()), 0),
    outstanding: invoices.reduce((sum, inv) => sum + parseFloat(inv.balance.toString()), 0),
    overdue: invoices
      .filter((inv) => !inv.is_paid && new Date(inv.due_date) < new Date())
      .reduce((sum, inv) => sum + parseFloat(inv.balance.toString()), 0),
  };

  const handleViewDetails = async (invoiceId: string) => {
    // Always open modal and reset so a new eye click replaces the previous invoice
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setSelectedInvoice(null);
    try {
      const response = await api.get(`/finance/invoices/${invoiceId}/`, { timeout: 15000 });
      setSelectedInvoice(response.data);
    } catch (err: any) {
      const msg =
        err?.code === "ECONNABORTED"
          ? "Invoice details timed out — try again"
          : err?.response?.data?.detail ||
            err?.message ||
            "Failed to load invoice details";
      setDetailError(String(msg));
      toast.error(String(msg));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedInvoice(null);
    setDetailError(null);
    setDetailLoading(false);
  };


  // Shell first — never block the whole module on network
  return (
    <div className="space-y-6">
      <FinanceNavLinks />
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-xl border bg-stone-50 px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading data…
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" className="h-8 px-2 -ml-2" asChild>
              <Link href="/dashboard/modules/finance" className="inline-flex items-center gap-1.5 text-slate-700">
                <ArrowLeft className="h-4 w-4" />
                Finance
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Invoices Management</h1>
          <p className="text-muted-foreground mt-2">
            Track, view, and manage student billing records
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {stats.total.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary-600">KES {stats.paid.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">KES {stats.outstanding.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">KES {stats.overdue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Name or invoice #"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                <SelectTrigger id="status" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="term">Term</Label>
              <Select value={filterTerm} onValueChange={setFilterTerm}>
                <SelectTrigger id="term" className="mt-2">
                  <SelectValue placeholder="All terms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All terms</SelectItem>
                  {terms.map((term) => (
                    <SelectItem key={term} value={term}>
                      {term}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="year">Year</Label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger id="year" className="mt-2">
                  <SelectValue placeholder="All years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All years</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices ({filteredInvoices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No invoices found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 px-3">Invoice #</th>
                    <th className="text-left py-2 px-3">Student</th>
                    <th className="text-left py-2 px-3">Term</th>
                    <th className="text-right py-2 px-3">Amount Due</th>
                    <th className="text-right py-2 px-3">Amount Paid</th>
                    <th className="text-right py-2 px-3">Balance</th>
                    <th className="text-left py-2 px-3">Due Date</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => {
                    const isOverdue = !invoice.is_paid && new Date(invoice.due_date) < new Date();

                    return (
                      <tr key={invoice.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-3 font-medium">{invoice.invoice_number}</td>
                        <td className="py-3 px-3">
                          {invoice.student.first_name} {invoice.student.last_name}
                        </td>
                        <td className="py-3 px-3 text-sm">
                          {invoice.term} {invoice.academic_year}
                        </td>
                        <td className="py-3 px-3 text-right font-medium">
                          KES {invoice.amount_due.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right text-secondary-600 font-medium">
                          KES {invoice.amount_paid.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-medium">
                          <span className={invoice.balance > 0 ? "text-amber-600" : "text-secondary-600"}>
                            KES {invoice.balance.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-sm">
                          {new Date(invoice.due_date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3">
                          {invoice.is_paid ? (
                            <Badge className="bg-secondary-100 text-secondary-800">Paid</Badge>
                          ) : isOverdue ? (
                            <Badge className="bg-red-100 text-red-800">Overdue</Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(invoice.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Invoice Details Modal — printable document */}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) closeDetail();
          else setDetailOpen(true);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span>
                {selectedInvoice
                  ? `Invoice ${selectedInvoice.invoice_number}`
                  : detailLoading
                    ? "Loading invoice…"
                    : "Invoice details"}
              </span>
            </DialogTitle>
            <DialogDescription>
              Preview matches print. Includes school logo, fee lines, payments, and balance.
            </DialogDescription>
          </DialogHeader>

          {detailLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          )}

          {!detailLoading && detailError && (
            <p className="text-sm text-red-600 py-6 text-center">{detailError}</p>
          )}

          {!detailLoading && selectedInvoice && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <style dangerouslySetInnerHTML={{ __html: INVOICE_PRINT_CSS }} />
              <div className="inv" ref={printRef}>
                <div className="inv-logo-wrap">
                  {logoSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoSrc} alt="" className="inv-logo" />
                  ) : (
                    <div className="inv-logo-fallback">
                      {(currentSchool?.name || "S").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <p className="inv-school">{currentSchool?.name || "School"}</p>
                <p className="inv-contact">
                  {[
                    (currentSchool as any)?.physical_address || (currentSchool as any)?.address,
                    (currentSchool as any)?.phone || (currentSchool as any)?.contact_phone,
                    (currentSchool as any)?.email || (currentSchool as any)?.contact_email,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Official fee invoice"}
                </p>
                <hr className="inv-rule" />
                <p className="inv-title">FEE INVOICE</p>

                {(() => {
                  const inv = selectedInvoice;
                  const due = Number(inv.amount_due || 0) + Number(inv.late_fee_applied || 0);
                  const paid = Number(inv.amount_paid || 0);
                  const bal = Number(inv.balance ?? Math.max(0, due - paid));
                  const overdue =
                    !inv.is_paid && inv.due_date && new Date(inv.due_date) < new Date();
                  const statusClass = inv.is_paid
                    ? "paid"
                    : overdue
                      ? "overdue"
                      : "unpaid";
                  const statusLabel = inv.is_paid
                    ? "Paid"
                    : overdue
                      ? "Overdue"
                      : "Pending";
                  const studentName = `${inv.student?.first_name || ""} ${inv.student?.last_name || ""}`.trim();
                  const lines =
                    Array.isArray(inv.lines) && inv.lines.length > 0
                      ? inv.lines
                      : [
                          {
                            description: `School fees · ${inv.term || ""} ${inv.academic_year || ""}`.trim(),
                            amount: Number(inv.amount_due || 0),
                          },
                        ];
                  return (
                    <>
                      <div className="inv-meta">
                        <div>
                          <p className="lbl">Invoice number</p>
                          <p className="val">{inv.invoice_number}</p>
                        </div>
                        <div>
                          <p className="lbl">Status</p>
                          <p className="val">
                            <span className={`inv-status ${statusClass}`}>{statusLabel}</span>
                          </p>
                        </div>
                        <div>
                          <p className="lbl">Student</p>
                          <p className="val">{studentName || "—"}</p>
                        </div>
                        <div>
                          <p className="lbl">Admission no.</p>
                          <p className="val">
                            {(inv.student as any)?.admission_number || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="lbl">Period</p>
                          <p className="val">
                            {inv.term || "—"} · {inv.academic_year || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="lbl">Due date</p>
                          <p className="val">
                            {inv.due_date
                              ? new Date(inv.due_date).toLocaleDateString()
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="lbl">Issued</p>
                          <p className="val">
                            {inv.generated_at
                              ? new Date(inv.generated_at).toLocaleDateString()
                              : "—"}
                          </p>
                        </div>
                        {inv.payment_plan?.name ? (
                          <div>
                            <p className="lbl">Payment plan</p>
                            <p className="val">{inv.payment_plan.name}</p>
                          </div>
                        ) : null}
                      </div>

                      <table className="inv-table">
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th className="num">Amount ({currency})</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((ln: any, i: number) => (
                            <tr key={ln.id || i}>
                              <td>
                                {ln.description || "Fee item"}
                                {ln.is_waived ? " (waived)" : ""}
                                {Number(ln.discount_amount || 0) > 0
                                  ? ` (discount ${Number(ln.discount_amount).toLocaleString()})`
                                  : ""}
                              </td>
                              <td className="num">
                                {Number(ln.amount || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                          {Number(inv.late_fee_applied) > 0 && (
                            <tr>
                              <td>Late fee</td>
                              <td className="num">
                                {Number(inv.late_fee_applied).toLocaleString()}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      <div className="inv-totals">
                        <div className="row">
                          <span>Total billed</span>
                          <span>
                            {currency} {due.toLocaleString()}
                          </span>
                        </div>
                        <div className="row">
                          <span>Amount paid</span>
                          <span className="ok">
                            {currency} {paid.toLocaleString()}
                          </span>
                        </div>
                        <div className={`row grand ${bal > 0 ? "bal" : "ok"}`}>
                          <span>Balance due</span>
                          <span>
                            {currency} {bal.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {inv.payments && inv.payments.length > 0 && (
                        <>
                          <p
                            style={{
                              fontWeight: 700,
                              fontSize: "9pt",
                              textAlign: "left",
                              margin: "8px 0 6px",
                              color: "#0f766e",
                            }}
                          >
                            PAYMENTS RECEIVED
                          </p>
                          <table className="inv-table">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Method</th>
                                <th>Reference</th>
                                <th className="num">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inv.payments.map((pay) => (
                                <tr key={pay.id}>
                                  <td>
                                    {pay.payment_date ||
                                      (pay.paid_at
                                        ? new Date(pay.paid_at).toLocaleDateString()
                                        : "—")}
                                  </td>
                                  <td>{pay.payment_method || "—"}</td>
                                  <td>{pay.reference_number || "—"}</td>
                                  <td className="num">
                                    {Number(pay.amount || 0).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      )}

                      <p className="inv-foot">
                        Please quote invoice <strong>{inv.invoice_number}</strong> when making
                        payment. This is a computer-generated invoice.
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2 print:hidden">
            <Button type="button" variant="outline" className="min-w-[7rem]" onClick={closeDetail}>
              Close
            </Button>
            <Button
              type="button"
              className="min-w-[7rem] bg-teal-700 hover:bg-teal-800"
              disabled={!selectedInvoice || detailLoading}
              onClick={printInvoice}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
