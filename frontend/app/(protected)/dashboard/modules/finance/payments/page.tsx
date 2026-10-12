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
import { Loader2, Search, Plus } from "lucide-react";

type Invoice = {
  id: string;
  student: { id: string; first_name: string; last_name: string };
  invoice_number: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  is_paid: boolean;
};

type Payment = {
  id: string;
  invoice: { id: string; invoice_number: string };
  amount: number;
  payment_method: string;
  reference_number: string;
  paid_at: string;
  paid_by: string | null;
  notes: string;
};

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [selectedInvoice, setSelectedInvoice] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invoicesRes, paymentsRes] = await Promise.all([
        api.get("/finance/invoices/"),
        api.get("/finance/payments/"),
      ]);

      // Filter only unpaid invoices for the form
      const allInvoices = Array.isArray(invoicesRes.data)
        ? invoicesRes.data
        : invoicesRes.data.results || [];
      setInvoices(allInvoices.filter((inv: Invoice) => !inv.is_paid));

      // Get all payments for history
      const allPayments = Array.isArray(paymentsRes.data)
        ? paymentsRes.data
        : paymentsRes.data.results || [];
      setPayments(allPayments.sort((a: Payment, b: Payment) => 
        new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
      ));
    } catch (err) {
      console.error("Failed to fetch data", err);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice || paymentAmount <= 0) {
      toast.error("Please select an invoice and enter amount");
      return;
    }

    const invoice = invoices.find((inv) => inv.id === selectedInvoice);
    if (!invoice) return;

    if (paymentAmount > invoice.balance) {
      toast.error(`Payment cannot exceed balance of KES ${invoice.balance.toLocaleString()}`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/finance/payments/", {
        invoice: selectedInvoice,
        amount: paymentAmount,
        payment_method: paymentMethod,
        reference_number: referenceNumber,
        notes: notes,
      });

      toast.success("Payment recorded successfully");
      
      // Reset form and refresh data
      setSelectedInvoice("");
      setPaymentAmount(0);
      setPaymentMethod("CASH");
      setReferenceNumber("");
      setNotes("");
      setShowForm(false);
      
      await fetchData();
    } catch (err: any) {
      console.error("Failed to record payment", err);
      toast.error(err.response?.data?.detail || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.student.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.student.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalPending: invoices.reduce((sum, inv) => sum + parseFloat(inv.balance.toString()), 0),
    totalInvoices: invoices.length,
    totalPaymentsToday: payments
      .filter((p) => {
        const today = new Date();
        const paymentDate = new Date(p.paid_at);
        return (
          paymentDate.getFullYear() === today.getFullYear() &&
          paymentDate.getMonth() === today.getMonth() &&
          paymentDate.getDate() === today.getDate()
        );
      })
      .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0),
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
        <h1 className="text-3xl font-bold">Payments Management</h1>
        <p className="text-muted-foreground mt-2">
          Record and track student fee payments across all invoices
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              KES {stats.totalPending.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stats.totalInvoices} invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recorded Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary-600">
              KES {stats.totalPaymentsToday.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payments.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Record Payment Form */}
      <Card className={showForm ? "border-2 border-primary" : ""}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Record New Payment</CardTitle>
          {!showForm && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Payment
            </Button>
          )}
        </CardHeader>

        {showForm && (
          <CardContent className="space-y-6 pt-6">
            <div>
              <Label htmlFor="invoice-select">Select Invoice *</Label>
              <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
                <SelectTrigger id="invoice-select" className="mt-2">
                  <SelectValue placeholder="Choose an unpaid invoice" />
                </SelectTrigger>
                <SelectContent>
                  {filteredInvoices.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">No unpaid invoices</div>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoice_number} - {inv.student.first_name} {inv.student.last_name} (Balance:
                        KES {inv.balance.toLocaleString()})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedInvoice && (
              <div className="bg-primary-50 p-4 rounded-lg border border-primary-200">
                {(() => {
                  const inv = invoices.find((i) => i.id === selectedInvoice);
                  return inv ? (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Amount Due</p>
                        <p className="font-bold text-lg">KES {inv.amount_due.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Already Paid</p>
                        <p className="font-bold text-lg text-secondary-600">KES {inv.amount_paid.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Remaining Balance</p>
                        <p className="font-bold text-lg text-red-600">KES {inv.balance.toLocaleString()}</p>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Payment Amount (KES) *</Label>
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
                <Label htmlFor="method">Payment Method *</Label>
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

            <div>
              <Label htmlFor="reference">Reference Number (e.g., M-PESA code)</Label>
              <Input
                id="reference"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g., MPESA123ABC"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional details about this payment..."
                rows={2}
                className="mt-2"
              />
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={handleRecordPayment}
                disabled={submitting || !selectedInvoice || paymentAmount <= 0}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recording...
                  </>
                ) : (
                  "Record Payment"
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Unpaid Invoices List */}
      <Card>
        <CardHeader>
          <CardTitle>Unpaid Invoices ({filteredInvoices.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="search">Search</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by student or invoice #"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredInvoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">All invoices are paid!</p>
          ) : (
            <div className="space-y-2">
              {filteredInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <p className="font-semibold">
                      {inv.student.first_name} {inv.student.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">{inv.invoice_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">KES {inv.balance.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      of KES {inv.amount_due.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payments ({payments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No payments recorded yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left py-2 px-3">Invoice</th>
                    <th className="text-left py-2 px-3">Method</th>
                    <th className="text-left py-2 px-3">Reference</th>
                    <th className="text-right py-2 px-3">Amount</th>
                    <th className="text-left py-2 px-3">Paid By</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-3">
                        {new Date(payment.paid_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 font-medium">{payment.invoice.invoice_number}</td>
                      <td className="py-3 px-3">
                        <Badge variant="outline">{payment.payment_method}</Badge>
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">
                        {payment.reference_number || "—"}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-secondary-600">
                        KES {payment.amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-sm">{payment.paid_by || "System"}</td>
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
