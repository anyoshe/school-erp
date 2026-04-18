"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import api from "@/utils/api";
import { Loader2 } from "lucide-react";

type Payment = {
  id: string;
  amount: number;
  payment_method: string;
  reference_number: string;
  paid_at: string;
  invoice: { id: string; invoice_number: string; student: { first_name: string; last_name: string } };
};

type Receipt = {
  payment_id: string;
  invoice_number: string;
  student_name: string;
  payment_method: string;
  reference_number: string;
  amount: number;
  paid_at: string;
  invoice_amount_due: number;
  invoice_amount_paid: number;
  invoice_balance: number;
  invoice_term: string;
  invoice_year: string;
  line_items: Array<{ description: string; category: string; amount: number }>; 
};

export default function ReceiptPrintPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await api.get("/finance/payments/?ordering=-paid_at");
      const paymentData = Array.isArray(response.data)
        ? response.data
        : response.data?.results || [];
      setPayments(paymentData);
    } catch (error) {
      console.error("Failed to fetch payments", error);
      toast.error("Unable to load payment history.");
    } finally {
      setLoading(false);
    }
  };

  const loadReceipt = async (paymentId: string) => {
    setSelectedPaymentId(paymentId);
    setLoadingReceipt(true);
    try {
      const response = await api.get(`/finance/payments/${paymentId}/receipt/`);
      setReceipt(response.data);
    } catch (error) {
      console.error("Failed to load receipt", error);
      toast.error("Unable to load receipt details.");
    } finally {
      setLoadingReceipt(false);
    }
  };

  const printReceipt = () => {
    if (!receipt) {
      toast.error("Select a receipt first.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast.error("Unable to open print window.");
      return;
    }

    const html = `
      <html>
        <head>
          <title>Receipt ${receipt.payment_id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1, h2, h3, h4, h5, h6 { margin: 0; }
            .header { margin-bottom: 18px; }
            .section { margin-bottom: 18px; }
            .field { display: flex; justify-content: space-between; margin-bottom: 6px; }
            .field strong { font-weight: 600; }
            .line-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
            .line-item:last-child { border-bottom: none; }
            .total { font-weight: 700; margin-top: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Payment Receipt</h1>
            <p>Receipt ID: ${receipt.payment_id}</p>
          </div>
          <div class="section">
            <div class="field"><strong>Student</strong><span>${receipt.student_name}</span></div>
            <div class="field"><strong>Invoice</strong><span>${receipt.invoice_number}</span></div>
            <div class="field"><strong>Amount Paid</strong><span>KES ${receipt.amount.toLocaleString()}</span></div>
            <div class="field"><strong>Payment Method</strong><span>${receipt.payment_method}</span></div>
            <div class="field"><strong>Reference</strong><span>${receipt.reference_number || 'N/A'}</span></div>
            <div class="field"><strong>Date</strong><span>${new Date(receipt.paid_at).toLocaleDateString()}</span></div>
          </div>
          <div class="section">
            <h3>Invoice Summary</h3>
            <div class="field"><span>Amount Due</span><span>KES ${receipt.invoice_amount_due.toLocaleString()}</span></div>
            <div class="field"><span>Amount Paid</span><span>KES ${receipt.invoice_amount_paid.toLocaleString()}</span></div>
            <div class="field"><strong>Balance</strong><strong>KES ${receipt.invoice_balance.toLocaleString()}</strong></div>
            <div class="field"><span>Term</span><span>${receipt.invoice_term} ${receipt.invoice_year}</span></div>
          </div>
          <div class="section">
            <h3>Line Items</h3>
            ${receipt.line_items.map(item => `
              <div class="line-item">
                <span>${item.description}</span>
                <span>KES ${item.amount.toLocaleString()}</span>
              </div>
            `).join("")}
          </div>
          <div class="section total">
            <div class="field"><strong>Total Paid</strong><strong>KES ${receipt.amount.toLocaleString()}</strong></div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Receipts</h1>
        <p className="text-muted-foreground mt-2">
          Review payment receipts and print them for student records.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin h-8 w-8 text-slate-500" />
              </div>
            ) : payments.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center">No payments available to print yet.</p>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 p-4 rounded-lg border border-slate-200">
                    <div>
                      <p className="font-semibold">{payment.invoice.student.first_name} {payment.invoice.student.last_name}</p>
                      <p className="text-sm text-muted-foreground">{payment.invoice.invoice_number}</p>
                      <p className="text-sm mt-1">{new Date(payment.paid_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline">{payment.payment_method}</Badge>
                      <p className="font-semibold text-right">KES {payment.amount.toLocaleString()}</p>
                      <Button
                        size="sm"
                        variant={selectedPaymentId === payment.id ? "secondary" : "outline"}
                        onClick={() => loadReceipt(payment.id)}
                      >
                        View Receipt
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receipt Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingReceipt ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin h-8 w-8 text-slate-500" />
              </div>
            ) : receipt ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Receipt ID</span>
                    <span>{receipt.payment_id}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Student</span>
                    <span>{receipt.student_name}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Invoice</span>
                    <span>{receipt.invoice_number}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Payment Date</span>
                    <span>{new Date(receipt.paid_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Reference</span>
                    <span>{receipt.reference_number || "—"}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Amount Due</span>
                    <span>KES {receipt.invoice_amount_due.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Amount Paid</span>
                    <span>KES {receipt.invoice_amount_paid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-amber-600">
                    <span>Remaining Balance</span>
                    <span>KES {receipt.invoice_balance.toLocaleString()}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-semibold mb-3">Line Items</p>
                  <div className="space-y-2">
                    {receipt.line_items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No detailed line items available.</p>
                    ) : (
                      receipt.line_items.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm border-b border-slate-100 pb-2 last:border-none">
                          <span>{item.description}</span>
                          <span>KES {item.amount.toLocaleString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <Button onClick={printReceipt} className="w-full">
                  Print Receipt
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Select a payment from the list to preview and print the receipt.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
