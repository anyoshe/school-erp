"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/utils/api";
import { useStudent } from "../hooks/useStudent";
import { studentService } from "../services/studentService";

type Guardian = {
  id: string;
  full_name: string;
  phone: string;
  relationship: string;
  email?: string;
};

type MedicalRecord = {
  id: string;
  blood_group?: string;
  genotype?: string;
  allergies?: string;
  chronic_conditions?: string;
  immunization_status?: string;
  emergency_doctor?: string;
  preferred_hospital?: string;
};

type PaymentPlan = {
  id: string;
  name: string;
  plan_type: string;
  number_of_installments: number;
  first_installment_percentage: number;
};

type FeeAssignment = {
  id: string;
  fee_structure?: string | null;
  fee_structure_id?: string | null;
  payment_plan?: PaymentPlan | null;
  waiver_amount: number;
  waiver_reason: string;
  is_waived: boolean;
  effective_total: number;
  selected_optional_items: Array<{ id: string; name: string }>;
};

type InvoiceSummary = {
  id: string;
  invoice_number: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  due_date: string;
  term: string;
  academic_year: string;
  is_paid: boolean;
  payment_plan?: { id: string; name: string } | null;
};

type PaymentSummary = {
  id: string;
  invoice_id: string;
  invoice_number: string;
  amount: number;
  payment_method: string;
  reference_number: string;
  paid_at: string;
  paid_by: string | null;
  notes: string;
};

type AdmissionPayment = {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  receipt_number: string;
};

type FinanceSummary = {
  outstanding_balance: number;
  effective_total: number;           // ← Added
  fee_structure_total: number;
  admission_amount: number;
  other_mandatory_amount: number;
  optional_total: number;
  net_admission_amount: number;
  total_due_now: number;
  deposit_paid: number;
  balance_due: number;
  currency: string;
  fee_assignment: FeeAssignment | null;
  invoices: InvoiceSummary[];
  payments: PaymentSummary[];
  admission_payments: AdmissionPayment[];
};

export default function StudentProfilePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { student, isLoading, refetch } = useStudent(id ?? "");
  const [isBusy, setIsBusy] = useState(false);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [medicalRecord, setMedicalRecord] = useState<MedicalRecord | null>(null);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
  const [assignmentPaymentPlanId, setAssignmentPaymentPlanId] = useState<string>("");
  const [assignmentWaiverAmount, setAssignmentWaiverAmount] = useState<number>(0);
  const [assignmentWaiverReason, setAssignmentWaiverReason] = useState<string>("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0);
  const [newPaymentMethod, setNewPaymentMethod] = useState<string>("CASH");
  const [newPaymentReference, setNewPaymentReference] = useState<string>("");
  const [newPaymentNotes, setNewPaymentNotes] = useState<string>("");
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    if (!student?.id) return;

    const fetchRelated = async () => {
      try {
        const [guardianRes, medicalRes] = await Promise.all([
          api.get(`/students/student-guardians/?student=${student.id}`),
          api.get(`/students/medical-records/?student=${student.id}`),
        ]);

        setGuardians(
          Array.isArray(guardianRes.data)
            ? guardianRes.data.map((x: any) => ({
              id: x.id,
              full_name: x.guardian?.full_name || x.full_name || "",
              phone: x.guardian?.phone || x.phone || "",
              relationship: x.guardian?.relationship || x.relationship || "",
              email: x.guardian?.email || x.email || "",
            }))
            : []
        );

        setMedicalRecord(Array.isArray(medicalRes.data) ? medicalRes.data[0] ?? null : null);
      } catch (err) {
        console.error("Failed to fetch guardians or medical details", err);
      }
    };


  // Fetch Finance Summary + Payment Plans reliably
  const fetchFinanceSummary = async () => {
    if (!student?.id) return;

    try {
      const [summaryRes, plansRes] = await Promise.all([
        api.get(`/students/${student.id}/finance-summary/`),
        api.get(`/finance/payment-plans/`)   // This should respect X-School-ID if your interceptor adds it
      ]);

      setFinanceSummary(summaryRes.data);

      // Safely set payment plans
      if (Array.isArray(plansRes.data)) {
        setPaymentPlans(plansRes.data);
      } else {
        setPaymentPlans([]);
      }
    } catch (err) {
      console.error("Failed to fetch finance summary or payment plans", err);
      toast.error("Failed to load payment plans");
      setPaymentPlans([]); // prevent undefined errors
    }
  };
    fetchRelated();
    fetchFinanceSummary();
  }, [student]);

  useEffect(() => {
    if (!financeSummary?.fee_assignment) return;

    setAssignmentPaymentPlanId(financeSummary.fee_assignment.payment_plan?.id || "");
    setAssignmentWaiverAmount(financeSummary.fee_assignment.waiver_amount || 0);
    setAssignmentWaiverReason(financeSummary.fee_assignment.waiver_reason || "");
  }, [financeSummary]);

  const updateFeeAssignment = async () => {
    if (!financeSummary?.fee_assignment?.id || !student?.id) return;
    setIsBusy(true);

    try {
      await api.patch(`/finance/student-assignments/${financeSummary.fee_assignment.id}/`, {
        payment_plan: assignmentPaymentPlanId || null,
        waiver_amount: assignmentWaiverAmount,
        waiver_reason: assignmentWaiverReason,
      });

      // Refetch finance summary
      const summaryRes = await api.get(`/students/${student.id}/finance-summary/`);
      setFinanceSummary(summaryRes.data);

      toast.success("Fee assignment updated successfully.");
    } catch (err) {
      console.error("Fee assignment update failed", err);
      toast.error("Unable to update fee assignment.");
    } finally {
      setIsBusy(false);
    }
  };

  const recordPayment = async () => {
    if (!selectedInvoiceId || newPaymentAmount <= 0 || !student?.id) return;
    setIsBusy(true);

    try {
      await api.post(`/finance/payments/`, {
        invoice: selectedInvoiceId,
        amount: newPaymentAmount,
        payment_method: newPaymentMethod,
        reference_number: newPaymentReference,
        notes: newPaymentNotes,
      });

      // Refetch finance summary
      const summaryRes = await api.get(`/students/${student.id}/finance-summary/`);
      setFinanceSummary(summaryRes.data);

      // Reset form
      setSelectedInvoiceId("");
      setNewPaymentAmount(0);
      setNewPaymentReference("");
      setNewPaymentNotes("");

      toast.success("Payment recorded successfully.");
    } catch (err) {
      console.error("Payment recording failed", err);
      toast.error("Unable to record payment.");
    } finally {
      setIsBusy(false);
    }
  };

  const uploadPhoto = async () => {
    if (!selectedPhotoFile || !student?.id) return;
    setIsBusy(true);

    try {
      const formData = new FormData();
      formData.append('photo', selectedPhotoFile);

      await api.patch(`/students/${student.id}/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      await refetch();
      setSelectedPhotoFile(null);
      toast.success("Photo uploaded successfully.");
    } catch (err) {
      console.error("Photo upload failed", err);
      toast.error("Unable to upload photo.");
    } finally {
      setIsBusy(false);
    }
  };

  const updateStatus = async (
    newStatus: "ACTIVE" | "GRADUATED" | "TRANSFERRED" | "SUSPENDED" | "EXPELLED"
  ) => {
    if (!student?.id) return;
    setIsBusy(true);

    try {
      await studentService.update(student.id, { status: newStatus });
      await refetch();
      toast.success(`Student status updated to ${newStatus}.`);
    } catch (err) {
      console.error("Status update failed", err);
      toast.error("Unable to update student status.");
    } finally {
      setIsBusy(false);
    }
  };

  if (!id) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">Student Profile</h1>
        <p className="text-gray-600">No student selected.</p>
      </div>
    );
  }

  if (isLoading || !student) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <Button variant="ghost" onClick={() => router.back()} className="w-fit gap-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle className="text-2xl">
              {student.full_name || `${student.first_name} ${student.last_name}`}
            </CardTitle>
            <p className="text-sm text-muted-foreground">Admission No: {student.admission_number || "N/A"}</p>
          </div>
          <Badge className="uppercase">{student.status || "UNKNOWN"}</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p><strong>Gender:</strong> {student.gender || "N/A"}</p>
              <p><strong>Date of Birth:</strong> {student.date_of_birth || "N/A"}</p>
              <p><strong>Nationality:</strong> {student.nationality || "N/A"}</p>
              <p><strong>Religion:</strong> {student.religion || "N/A"}</p>
              <p>
                <strong>Address:</strong>{" "}
                {(() => {
                  const fullAddress = [student.address, student.region, student.district]
                    .filter(Boolean)
                    .join(", ");
                  return fullAddress || "N/A";
                })()}
              </p>
            </div>

            <div className="space-y-2">
              <p><strong>Class:</strong> {student.current_class ? student.current_class.name || student.current_class.short_name || "N/A" : "N/A"}</p>
              <p><strong>Stream:</strong> {student.stream || "N/A"}</p>
              <p><strong>Boarding:</strong> {student.boarding_status || "N/A"}</p>
              <p><strong>Special Needs:</strong> {student.special_needs || "None"}</p>
              <p><strong>Admission Date:</strong> {student.admission_date || "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">


        {/* Financials Card - Dynamic Currency */}
        {/* Financials Card - FIXED & CLEAR */}
<Card>
  <CardHeader>
    <CardTitle>Financials</CardTitle>
  </CardHeader>
  <CardContent className="space-y-6">
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

      {/* Effective Total - Full Fee Obligation */}
      <div className="bg-slate-50 p-4 rounded-xl border">
        <p className="text-sm text-slate-600 font-medium">Effective Total</p>
        <p className="text-3xl font-bold text-slate-900 mt-1">
          {financeSummary
            ? `${financeSummary.currency} ${financeSummary.effective_total.toLocaleString()}`
            : "—"}
        </p>
        <p className="text-xs text-slate-500 mt-1">Mandatory + Selected Optionals</p>
      </div>

      {/* Deposit Paid */}
      <div className="bg-secondary-50 p-4 rounded-xl border border-green-100">
        <p className="text-sm text-secondary-600 font-medium">Deposit Paid</p>
        <p className="text-3xl font-bold text-secondary-700 mt-1">
          {financeSummary
            ? `${financeSummary.currency} ${financeSummary.deposit_paid.toLocaleString()}`
            : "—"}
        </p>
        <p className="text-xs text-green-500 mt-1">Initial enrollment payment</p>
      </div>

      {/* Remaining Balance - Most Important */}
      <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
        <p className="text-sm text-amber-600 font-medium">Remaining Balance</p>
        <p className="text-3xl font-bold text-amber-700 mt-1">
          {financeSummary
            ? `${financeSummary.currency} ${Math.max(
                0,
                financeSummary.balance_due ?? financeSummary.outstanding_balance ?? 0
              ).toLocaleString()}`
            : "—"}
        </p>
        <p className="text-xs text-amber-500 mt-1">Still to be paid</p>
      </div>

      {/* Outstanding Balance from Invoices */}
      <div className="bg-red-50 p-4 rounded-xl border border-red-100">
        <p className="text-sm text-red-600 font-medium">Outstanding Balance</p>
        <p className="text-3xl font-bold text-red-700 mt-1">
          {financeSummary
            ? `${financeSummary.currency} ${financeSummary.outstanding_balance.toLocaleString()}`
            : "—"}
        </p>
        <p className="text-xs text-red-500 mt-1">From unpaid invoices</p>
      </div>
    </div>

    {/* Fee Assignment Details */}
    {financeSummary?.fee_assignment && (
      <div className="border-t pt-6">
        <h4 className="font-semibold mb-3">Fee Assignment</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <p className="text-muted-foreground">Fee Structure</p>
            <p className="font-medium">{financeSummary.fee_assignment.fee_structure || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Payment Plan</p>
            <p className="font-medium">
              {financeSummary.fee_assignment.payment_plan?.name || "None"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Waiver</p>
            <p className="font-medium text-secondary-600">
              - {financeSummary.currency} {financeSummary.fee_assignment.waiver_amount.toLocaleString()}
              {financeSummary.fee_assignment.waiver_reason && (
                <span className="text-xs block">({financeSummary.fee_assignment.waiver_reason})</span>
              )}
            </p>
          </div>
        </div>
      </div>
    )}

    {/* Admission Payments */}
    {financeSummary?.admission_payments && financeSummary.admission_payments.length > 0 && (
      <div className="border-t pt-6">
        <h4 className="font-semibold mb-3">Admission Payments</h4>
        <div className="space-y-3">
          {financeSummary.admission_payments.map((payment, index) => (
            <div key={payment.id} className="flex justify-between items-center bg-secondary-50 p-3 rounded-lg">
              <div>
                <p className="font-medium">Payment #{index + 1}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(payment.payment_date).toLocaleDateString()} • {payment.receipt_number || payment.payment_method}
                </p>
              </div>
              <p className="font-semibold text-secondary-600">
                {financeSummary.currency} {payment.amount.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    )}
  </CardContent>
</Card>
        <Card>
          <CardHeader>
            <CardTitle>Medical</CardTitle>
          </CardHeader>
          <CardContent>
            <p><strong>Immunization:</strong> {medicalRecord?.immunization_status || "N/A"}</p>
            <p><strong>Blood Group:</strong> {medicalRecord?.blood_group || "N/A"}</p>
            <p><strong>Allergies:</strong> {medicalRecord?.allergies || "None"}</p>
            <p><strong>Chronic Conditions:</strong> {medicalRecord?.chronic_conditions || "None"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Guardians</CardTitle>
          </CardHeader>
          <CardContent>
            {guardians.length === 0 ? (
              <p className="text-sm text-muted-foreground">No guardian records found.</p>
            ) : (
              <div className="space-y-2">
                {guardians.map((g) => (
                  <div key={g.id} className="border rounded-lg p-2">
                    <p className="font-bold">{g.full_name}</p>
                    <p>{g.relationship}</p>
                    <p>{g.phone}</p>
                    <p>{g.email || "No email"}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Finance Management Section */}
      {financeSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fee Assignment Management - Fixed Payment Plans */}
<Card>
  <CardHeader>
    <CardTitle>Fee Assignment Management</CardTitle>
  </CardHeader>
  <CardContent className="space-y-5">
    <div>
      <Label htmlFor="payment-plan">Payment Plan</Label>
      <Select
        value={assignmentPaymentPlanId}
        onValueChange={setAssignmentPaymentPlanId}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select payment plan" />
        </SelectTrigger>
        <SelectContent>
          {paymentPlans.length > 0 ? (
            paymentPlans.map((plan) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name}
                {plan.plan_type && ` (${plan.plan_type})`}
                {plan.number_of_installments > 1 && ` — ${plan.number_of_installments} installments`}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="" disabled>
              No payment plans available
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      {paymentPlans.length === 0 && (
        <p className="text-xs text-amber-600 mt-1">
          No payment plans found. Please check school configuration.
        </p>
      )}
    </div>

    <div>
      <Label htmlFor="waiver-amount">Waiver Amount</Label>
      <Input
        id="waiver-amount"
        type="number"
        value={assignmentWaiverAmount}
        onChange={(e) => setAssignmentWaiverAmount(Number(e.target.value) || 0)}
        min="0"
        step="0.01"
      />
    </div>

    <div>
      <Label htmlFor="waiver-reason">Waiver Reason</Label>
      <Textarea
        id="waiver-reason"
        value={assignmentWaiverReason}
        onChange={(e) => setAssignmentWaiverReason(e.target.value)}
        placeholder="Reason for waiver (e.g. Staff child, Scholarship)..."
      />
    </div>

    <Button
      className="w-full"
      disabled={isBusy || !financeSummary?.fee_assignment?.id}
      onClick={updateFeeAssignment}
    >
      Update Fee Assignment
    </Button>
  </CardContent>
</Card>

          {/* Payment Recording */}
          <Card>
            <CardHeader>
              <CardTitle>Record New Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="invoice-select">Invoice</Label>
                <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {financeSummary.invoices.filter(inv => !inv.is_paid).map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number} - Balance: {financeSummary.currency} {invoice.balance.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="payment-amount">Payment Amount (KES)</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  value={newPaymentAmount}
                  onChange={(e) => setNewPaymentAmount(Number(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <Label htmlFor="payment-method">Payment Method</Label>
                <Select value={newPaymentMethod} onValueChange={setNewPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="M-PESA">M-PESA</SelectItem>
                    <SelectItem value="BANK">Bank Transfer</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="payment-reference">Reference Number</Label>
                <Input
                  id="payment-reference"
                  value={newPaymentReference}
                  onChange={(e) => setNewPaymentReference(e.target.value)}
                  placeholder="Receipt/MPESA code..."
                />
              </div>

              <div>
                <Label htmlFor="payment-notes">Notes</Label>
                <Textarea
                  id="payment-notes"
                  value={newPaymentNotes}
                  onChange={(e) => setNewPaymentNotes(e.target.value)}
                  placeholder="Additional notes..."
                />
              </div>

              <Button className="w-full" disabled={isBusy || !selectedInvoiceId || newPaymentAmount <= 0} onClick={recordPayment}>
                Record Payment
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoices and Payments History */}
      {financeSummary && (financeSummary.invoices.length > 0 || financeSummary.payments.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Invoices Section - Dynamic Currency */}
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <p className="text-sm text-muted-foreground">
                Formal invoices • Admission deposit of {financeSummary?.currency} {financeSummary?.deposit_paid.toLocaleString() || '0'} has been credited
              </p>
            </CardHeader>
            <CardContent>
              {financeSummary?.invoices.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">No invoices generated yet.</p>
              ) : (
                <div className="space-y-4">
                  {financeSummary.invoices.map((invoice) => {
                    const displayedBalance = Math.max(0, invoice.balance);

                    return (
                      <div key={invoice.id} className="border rounded-xl p-5">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="font-semibold text-lg">{invoice.invoice_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {invoice.term} {invoice.academic_year}
                            </p>
                          </div>
                          <Badge variant={displayedBalance <= 0 ? "default" : "destructive"}>
                            {displayedBalance <= 0 ? "Paid" : "Unpaid"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Originally Due</p>
                            <p className="font-medium">{financeSummary.currency} {invoice.amount_due.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Paid on Invoice</p>
                            <p className="font-medium">{financeSummary.currency} {invoice.amount_paid.toLocaleString()}</p>
                          </div>

                          <div className="col-span-2 pt-3 border-t mt-2">
                            <div className="flex justify-between items-center">
                              <p className="font-semibold">Current Balance After Deposit Credit</p>
                              <p className={`text-xl font-bold ${displayedBalance > 0 ? 'text-red-600' : 'text-secondary-600'}`}>
                                {financeSummary.currency} {displayedBalance.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div>
                            <p className="text-muted-foreground">Due Date</p>
                            <p className="font-medium">{new Date(invoice.due_date).toLocaleDateString()}</p>
                          </div>
                        </div>

                        {financeSummary.deposit_paid > 0 && displayedBalance < invoice.amount_due && (
                          <div className="mt-4 p-3 bg-primary-50 text-primary-800 text-xs rounded-lg">
                            ✓ {financeSummary.currency} {financeSummary.deposit_paid.toLocaleString()} admission deposit credited
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payments */}
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {financeSummary.payments.map((payment) => (
                  <div key={payment.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">KES {payment.amount.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">{payment.invoice_number}</p>
                      </div>
                      <Badge>{payment.payment_method}</Badge>
                    </div>
                    <div className="mt-2 text-sm">
                      <p>Reference: {payment.reference_number || "N/A"}</p>
                      <p>Date: {new Date(payment.paid_at).toLocaleDateString()}</p>
                      <p>Paid by: {payment.paid_by || "Unknown"}</p>
                      {payment.notes && <p>Notes: {payment.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Student Photo Management */}
      <Card>
        <CardHeader>
          <CardTitle>Student Photo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {student.photo ? (
            <div className="flex items-center space-x-4">
              <img
                src={student.photo}
                alt="Student photo"
                className="w-24 h-24 rounded-lg object-cover border"
              />
              <div>
                <p className="text-sm text-muted-foreground">Current photo uploaded</p>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedPhotoFile(e.target.files?.[0] || null)}
                  className="mt-2"
                />
                {selectedPhotoFile && (
                  <Button className="mt-2" disabled={isBusy} onClick={uploadPhoto}>
                    Change Photo
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-2">No photo uploaded</p>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setSelectedPhotoFile(e.target.files?.[0] || null)}
              />
              {selectedPhotoFile && (
                <Button className="mt-2" disabled={isBusy} onClick={uploadPhoto}>
                  Upload Photo
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Action Center</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Active", value: "ACTIVE" },
              { label: "Graduated", value: "GRADUATED" },
              { label: "Transferred", value: "TRANSFERRED" },
              { label: "Suspended", value: "SUSPENDED" },
              { label: "Expelled", value: "EXPELLED" },
            ].map((action) => (
              <Button
                key={action.value}
                variant="outline"
                size="sm"
                disabled={isBusy || student.status === action.value}
                onClick={() => updateStatus(action.value as any)}
              >
                {action.label}
              </Button>
            ))}
          </div>

          <Separator />
          <p className="text-sm text-muted-foreground">Use these controls to manage student lifecycle and transition paths after enrollment.</p>
        </CardContent>
      </Card>
    </div>
  );
}
