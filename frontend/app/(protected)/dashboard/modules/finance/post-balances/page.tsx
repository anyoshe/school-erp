"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import api from "@/utils/api";
import { Loader2, Search } from "lucide-react";
import Link from "next/link";

type Invoice = {
  id: string;
  student: { id: string; first_name: string; last_name: string };
  invoice_number: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  is_paid: boolean;
  due_date: string;
};

export default function PostBalancesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await api.get("/finance/invoices/");
      const invoiceData = Array.isArray(response.data)
        ? response.data
        : response.data?.results || [];

      setInvoices(invoiceData.filter((invoice: Invoice) => !invoice.is_paid));
    } catch (error) {
      console.error("Failed to load invoices", error);
      toast.error("Unable to load outstanding invoices");
    } finally {
      setLoading(false);
    }
  };

  const handlePostBalance = async () => {
    if (!selectedInvoice || paymentAmount <= 0) {
      toast.error("Please select an invoice and enter a payment amount.");
      return;
    }

    const invoice = invoices.find((inv) => inv.id === selectedInvoice);

    if (!invoice) {
      toast.error("Selected invoice could not be found.");
      return;
    }

    if (paymentAmount > invoice.balance) {
      toast.error(`Payment cannot exceed invoice balance of KES ${invoice.balance.toLocaleString()}`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/finance/payments/", {
        invoice: selectedInvoice,
        amount: paymentAmount,
        payment_method: paymentMethod,
        reference_number: referenceNumber,
        notes,
      });

      toast.success("Balance posted successfully.");
      setSelectedInvoice("");
      setPaymentAmount(0);
      setPaymentMethod("CASH");
      setReferenceNumber("");
      setNotes("");
      await fetchInvoices();
    } catch (error: any) {
      console.error("Failed to post balance", error);
      toast.error(error.response?.data?.detail || "Failed to post balance.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const searchText = searchQuery.toLowerCase();
    return (
      invoice.invoice_number.toLowerCase().includes(searchText) ||
      invoice.student.first_name.toLowerCase().includes(searchText) ||
      invoice.student.last_name.toLowerCase().includes(searchText)
    );
  });

  const totalOutstanding = invoices.reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0);

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
        <h1 className="text-3xl font-bold">Post Outstanding Balances</h1>
        <p className="text-muted-foreground mt-2">
          Record a payment against an outstanding invoice and keep account balances updated.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">KES {totalOutstanding.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground mt-2">Total amount pending across unpaid invoices.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/modules/finance/receipts">
              <Button variant="outline" className="w-full">
                View printable receipts
              </Button>
            </Link>
            <Link href="/dashboard/modules/finance/payments">
              <Button variant="outline" className="w-full">
                Open full payment history
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record Balance Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="invoice-select">Invoice *</Label>
            <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
              <SelectTrigger id="invoice-select" className="mt-2">
                <SelectValue placeholder="Choose an unpaid invoice" />
              </SelectTrigger>
              <SelectContent>
                {filteredInvoices.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No outstanding invoices found</div>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number} • {invoice.student.first_name} {invoice.student.last_name} • KES {invoice.balance.toLocaleString()}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedInvoice && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              {(() => {
                const inv = invoices.find((invoice) => invoice.id === selectedInvoice);
                if (!inv) return null;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Amount Due</p>
                      <p className="font-semibold text-lg">KES {inv.amount_due.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Paid So Far</p>
                      <p className="font-semibold text-lg text-secondary-600">KES {inv.amount_paid.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Outstanding</p>
                      <p className="font-semibold text-lg text-amber-600">KES {inv.balance.toLocaleString()}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Amount to Post</Label>
              <Input
                id="amount"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value) || 0)}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="method">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="method" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="M-PESA">M-PESA</SelectItem>
                  <SelectItem value="BANK">Bank Transfer</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="reference">Reference Number</Label>
              <Input
                id="reference"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Receipt or payment reference"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional payment notes"
                rows={3}
                className="mt-2"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Posting a payment here updates the invoice balance immediately.</p>
              <p>Use the receipt page to print or review receipts.</p>
            </div>
            <Button
              onClick={handlePostBalance}
              disabled={submitting || !selectedInvoice || paymentAmount <= 0}
              className="w-full sm:w-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                "Post Balance"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outstanding Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label htmlFor="search">Search invoices</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by student name or invoice number"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredInvoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">No outstanding invoices found.</p>
          ) : (
            <div className="space-y-3">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg border border-slate-200">
                  <div>
                    <p className="font-semibold">{invoice.student.first_name} {invoice.student.last_name}</p>
                    <p className="text-sm text-muted-foreground">Invoice {invoice.invoice_number}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p>Due: {new Date(invoice.due_date).toLocaleDateString()}</p>
                    <p>Paid: KES {invoice.amount_paid.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Outstanding</p>
                    <p className="text-xl font-semibold text-amber-600">KES {invoice.balance.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
