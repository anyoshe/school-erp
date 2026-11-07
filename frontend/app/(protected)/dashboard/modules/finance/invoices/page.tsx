"use client";

import { FinanceNavLinks } from "../components/FinanceNav";
import Link from "next/link";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/utils/api";
import { Loader2, Search, Download, Eye, ArrowLeft } from "lucide-react";
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
  payments: Array<{
    id: string;
    amount: number;
    payment_method: string;
    reference_number: string;
    paid_at: string;
    paid_by: string | null;
  }>;
};

export default function InvoicesPage() {
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

      {/* Invoice Details Modal */}

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) closeDetail();
          else setDetailOpen(true);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span>
                {selectedInvoice
                  ? `Invoice ${selectedInvoice.invoice_number}`
                  : detailLoading
                    ? "Loading invoice…"
                    : "Invoice details"}
              </span>
              {selectedInvoice && (
                selectedInvoice.is_paid ? (
                  <Badge className="bg-secondary-100 text-secondary-700">Paid</Badge>
                ) : (
                  <Badge variant="destructive">Unpaid</Badge>
                )
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedInvoice
                ? `${selectedInvoice.student?.first_name || ""} ${selectedInvoice.student?.last_name || ""}`.trim()
                : detailLoading
                  ? "Fetching full bill and payments…"
                  : detailError || "Select an invoice from the list."}
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
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2 rounded-lg border bg-slate-50/80 p-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    Invoice info
                  </h4>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Term / Year</span>
                    <span className="font-medium text-right">
                      {selectedInvoice.term} {selectedInvoice.academic_year}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Generated</span>
                    <span className="font-medium">
                      {new Date(selectedInvoice.generated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Due date</span>
                    <span className="font-medium">
                      {new Date(selectedInvoice.due_date).toLocaleDateString()}
                    </span>
                  </div>
                  {selectedInvoice.installment_number ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Installment</span>
                      <span className="font-medium">#{selectedInvoice.installment_number}</span>
                    </div>
                  ) : null}
                  {selectedInvoice.payment_plan ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Payment plan</span>
                      <span className="font-medium text-right">
                        {selectedInvoice.payment_plan.name}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2 rounded-lg border bg-slate-50/80 p-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    Amounts
                  </h4>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Amount due</span>
                    <span className="font-medium">
                      KES {Number(selectedInvoice.amount_due).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Amount paid</span>
                    <span className="font-medium text-emerald-700">
                      KES {Number(selectedInvoice.amount_paid).toLocaleString()}
                    </span>
                  </div>
                  {Number(selectedInvoice.late_fee_applied) > 0 && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Late fee</span>
                      <span className="font-medium text-red-600">
                        KES {Number(selectedInvoice.late_fee_applied).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="border-t pt-2 mt-1 flex justify-between font-bold">
                    <span>Balance</span>
                    <span
                      className={
                        Number(selectedInvoice.balance) > 0 ? "text-amber-700" : "text-emerald-700"
                      }
                    >
                      KES {Number(selectedInvoice.balance).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {Array.isArray((selectedInvoice as any).lines) &&
                (selectedInvoice as any).lines.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm">Fee lines</h4>
                    <ul className="divide-y rounded-lg border text-sm">
                      {(selectedInvoice as any).lines.map((ln: any) => (
                        <li
                          key={ln.id || ln.description}
                          className="flex justify-between gap-2 px-3 py-2"
                        >
                          <span className="truncate">{ln.description || ln.item_name || "Item"}</span>
                          <span className="tabular-nums shrink-0">
                            KES {Number(ln.amount || 0).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 text-sm">Payment history</h4>
                  <div className="space-y-2">
                    {selectedInvoice.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex justify-between items-start bg-slate-50 border p-3 rounded-lg text-sm"
                      >
                        <div>
                          <p className="font-medium">{payment.payment_method}</p>
                          <p className="text-xs text-muted-foreground">
                            {payment.paid_at
                              ? new Date(payment.paid_at).toLocaleDateString()
                              : "—"}
                            {payment.reference_number ? ` · ${payment.reference_number}` : ""}
                          </p>
                        </div>
                        <p className="font-semibold text-emerald-700 tabular-nums">
                          +KES {Number(payment.amount).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!selectedInvoice.payments || selectedInvoice.payments.length === 0) && (
                <p className="text-sm text-muted-foreground">No payments recorded on this invoice yet.</p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="min-w-[7rem]" onClick={closeDetail}>
              Close
            </Button>
            <Button
              type="button"
              className="min-w-[7rem]"
              disabled={!selectedInvoice}
              onClick={() => window.print()}
            >
              <Download className="h-4 w-4 mr-2" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}