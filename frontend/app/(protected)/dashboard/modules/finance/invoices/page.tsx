"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/utils/api";
import { Loader2, Search, Download, Eye } from "lucide-react";

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
    try {
      const response = await api.get(`/finance/invoices/${invoiceId}/`);
      setSelectedInvoice(response.data);
    } catch (err) {
      toast.error("Failed to load invoice details");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Invoices Management</h1>
        <p className="text-muted-foreground mt-2">
          Track, view, and manage student billing records
        </p>
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
                            <Badge className="bg-green-100 text-secondary-800">Paid</Badge>
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
      {selectedInvoice && (
        <Card className="border-2 border-primary">
          <CardHeader className="bg-primary-50">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Invoice {selectedInvoice.invoice_number}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedInvoice.student.first_name} {selectedInvoice.student.last_name}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setSelectedInvoice(null)}>
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Invoice Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Term:</span>
                    <span className="font-medium">{selectedInvoice.term} {selectedInvoice.academic_year}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Generated:</span>
                    <span className="font-medium">{new Date(selectedInvoice.generated_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due Date:</span>
                    <span className="font-medium">{new Date(selectedInvoice.due_date).toLocaleDateString()}</span>
                  </div>
                  {selectedInvoice.installment_number && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Installment:</span>
                      <span className="font-medium">{selectedInvoice.installment_number}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Financial Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount Due:</span>
                    <span className="font-medium">KES {selectedInvoice.amount_due.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-medium text-secondary-600">KES {selectedInvoice.amount_paid.toLocaleString()}</span>
                  </div>
                  {selectedInvoice.late_fee_applied > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Late Fee:</span>
                      <span className="font-medium text-red-600">KES {selectedInvoice.late_fee_applied.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                    <span>Balance:</span>
                    <span className={selectedInvoice.balance > 0 ? "text-red-600" : "text-secondary-600"}>
                      KES {selectedInvoice.balance.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Payment History</h4>
                <div className="space-y-2">
                  {selectedInvoice.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex justify-between items-start bg-gray-50 p-3 rounded text-sm"
                    >
                      <div>
                        <p className="font-medium">{payment.payment_method}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(payment.paid_at).toLocaleDateString()} • {payment.reference_number}
                        </p>
                      </div>
                      <p className="font-semibold text-secondary-600">+KES {payment.amount.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t pt-4 flex gap-3">
              <Button onClick={() => window.print()}>
                <Download className="h-4 w-4 mr-2" />
                Print Invoice
              </Button>
              <Button variant="outline" onClick={() => setSelectedInvoice(null)}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
