"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import api from "@/utils/api";
import { Loader2, Search, ChevronDown } from "lucide-react";

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  current_class?: { id: string; name: string; short_name: string } | null;
  fee_structure?: string | null;
};

type FeeStructureItem = {
  id: number;
  amount: number;
  item: number;
  item_details: {
    id: number;
    name: string;
    category_name: string;
    is_optional: boolean;
  };
  category_name: string;
};

type FeeStructure = {
  id: string;
  name: string;
  grade_level: string;
  academic_year: string;
  period_name: string;
  total_amount: number;
  structure_items?: FeeStructureItem[];
  available_optional_items?: Array<{ id: string; name: string; is_optional: boolean }>;
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
  student: { id: string; first_name: string; last_name: string };
  fee_structure: {
    id: string;
    name: string;
    grade_level: string;
    academic_year: string;
    period_name: string;
    total_amount: number;
  };
  payment_plan?: string | null;
  waiver_amount: number;
  waiver_reason: string;
  is_waived: boolean;
  assigned_at: string;
  effective_total: number;
  optional_items_details?: Array<{ id: number; name: string }>;
  item_amounts?: Record<string, number>;
};

export default function StudentAssignmentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<FeeAssignment[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // Form state
  const [selectedFeeStructure, setSelectedFeeStructure] = useState<string>("");
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState<string>("");
  const [waiverAmount, setWaiverAmount] = useState<number>(0);
  const [waiverReason, setWaiverReason] = useState<string>("");
  const [isWaived, setIsWaived] = useState<boolean>(false);
  const [selectedOptionalItems, setSelectedOptionalItems] = useState<string[]>([]);
  const [itemAmountOverrides, setItemAmountOverrides] = useState<Record<string, number>>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);  const [generatingInvoices, setGeneratingInvoices] = useState<Set<string>>(new Set());  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [studentsRes, assignmentsRes, structuresRes, plansRes] = await Promise.all([
        api.get("/students/"),
        api.get("/finance/student-assignments/"),
        api.get("/finance/structures/"),
        api.get("/finance/payment-plans/"),
      ]);

      setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : studentsRes.data.results || []);
      setAssignments(Array.isArray(assignmentsRes.data) ? assignmentsRes.data : assignmentsRes.data.results || []);
      setFeeStructures(Array.isArray(structuresRes.data) ? structuresRes.data : structuresRes.data.results || []);
      setPaymentPlans(Array.isArray(plansRes.data) ? plansRes.data : plansRes.data.results || []);
    } catch (err) {
      console.error("Failed to fetch initial data", err);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.admission_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    
    // Pre-fill form if student already has an assignment
    const existing = assignments.find((a) => a.student.id === student.id);
    if (existing) {
      setSelectedFeeStructure(existing.fee_structure.id);
      setSelectedPaymentPlan(existing.payment_plan || "");
      setWaiverAmount(existing.waiver_amount);
      setWaiverReason(existing.waiver_reason);
      setIsWaived(existing.is_waived);
      setSelectedOptionalItems(
        existing.optional_items_details?.map((item) => String(item.id)) || []
      );
      setItemAmountOverrides(existing.item_amounts || {});
    } else {
      // Reset form
      setSelectedFeeStructure(student.fee_structure || "");
      setSelectedPaymentPlan("");
      setWaiverAmount(0);
      setWaiverReason("");
      setIsWaived(false);
      setSelectedOptionalItems([]);
      setItemAmountOverrides({});
    }
  };

  const handleToggleOptionalItem = (itemId: string) => {
    setSelectedOptionalItems((prev) => {
      const next = prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId];
      if (!next.includes(itemId) && itemAmountOverrides[itemId] !== undefined) {
        return next;
      }
      const currentValue = itemAmountOverrides[itemId];
      if (currentValue === undefined && currentFeeStructure) {
        const structureItem = currentFeeStructure.structure_items?.find((si) => String(si.item) === itemId);
        if (structureItem) {
          setItemAmountOverrides((prevAmounts) => ({
            ...prevAmounts,
            [itemId]: Number(structureItem.amount || 0),
          }));
        }
      }
      return next;
    });
  };

  const handleGenerateInvoices = async (assignmentId: string) => {
    setGeneratingInvoices((prev) => new Set([...prev, assignmentId]));
    try {
      await api.post(`/finance/student-assignments/${assignmentId}/generate-invoice/`);
      toast.success("Invoices generated successfully");
      // Refresh assignments to reflect invoice count
      await fetchInitialData();
    } catch (err: any) {
      console.error("Failed to generate invoices", err);
      toast.error(err.response?.data?.detail || "Failed to generate invoices");
    } finally {
      setGeneratingInvoices((prev) => {
        const next = new Set(prev);
        next.delete(assignmentId);
        return next;
      });
    }
  };

  const handleAssignFees = async () => {
    if (!selectedStudent || !selectedFeeStructure) {
      toast.error("Please select a student and fee structure");
      return;
    }

    setIsSubmitting(true);
    try {
      const existing = assignments.find((a) => a.student.id === selectedStudent.id);
      const payload = {
        student: selectedStudent.id,
        fee_structure: selectedFeeStructure,
        payment_plan: selectedPaymentPlan || null,
        waiver_amount: waiverAmount,
        waiver_reason: waiverReason,
        is_waived: isWaived,
        selected_optional_items: selectedOptionalItems,
        item_amounts: itemAmountOverrides,
      };

      if (existing) {
        // Update existing assignment
        await api.patch(`/finance/student-assignments/${existing.id}/`, payload);
        toast.success("Fee assignment updated successfully");
      } else {
        // Create new assignment
        await api.post("/finance/student-assignments/", payload);
        toast.success("Fee assignment created successfully");
      }

      // Refresh data
      const res = await api.get("/finance/student-assignments/");
      setAssignments(Array.isArray(res.data) ? res.data : res.data.results || []);
      setSelectedStudent(null);
    } catch (err: any) {
      console.error("Failed to assign fees", err);
      toast.error(err.response?.data?.detail || "Failed to assign fees");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentFeeStructure = feeStructures.find((fs) => fs.id === selectedFeeStructure);
  const assignedToStudent = assignments.find((a) => a.student.id === selectedStudent?.id);

  useEffect(() => {
    if (!currentFeeStructure) {
      setItemAmountOverrides({});
      return;
    }

    const defaults = currentFeeStructure.structure_items?.reduce(
      (acc, si) => ({
        ...acc,
        [String(si.item)]: Number(si.amount ?? 0),
      }),
      {} as Record<string, number>
    ) || {};

    setItemAmountOverrides((prev) => ({ ...defaults, ...prev }));
  }, [currentFeeStructure?.id]);

  const previewEffectiveTotal = currentFeeStructure
    ? Math.max(
        0,
        (currentFeeStructure.structure_items || []).reduce((sum, si) => {
          const itemId = String(si.item);
          const isOptional = si.item_details?.is_optional;
          const selected = !isOptional || selectedOptionalItems.includes(itemId);
          if (!selected) {
            return sum;
          }
          return sum + Number(itemAmountOverrides[itemId] ?? si.amount ?? 0);
        }, 0) - waiverAmount
      )
    : 0;

  // Shell first — never block the whole module on network
  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-xl border bg-stone-50 px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading data…
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold">Assign Fees to Students</h1>
        <p className="text-muted-foreground mt-2">
          Personalize fee structures, payment plans, waivers, and optional items for each student.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Search & Selection */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Select Student</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="student-search">Search by Name or Admission No</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="student-search"
                  placeholder="Type to search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2 border rounded-lg p-3">
              {filteredStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No students found</p>
              ) : (
                filteredStudents.map((student) => {
                  const hasAssignment = assignments.some((a) => a.student.id === student.id);
                  const isSelected = selectedStudent?.id === student.id;

                  return (
                    <button
                      key={student.id}
                      onClick={() => handleSelectStudent(student)}
                      className={`w-full text-left p-3 rounded-lg border transition ${
                        isSelected
                          ? "bg-primary-100 border-primary-300"
                          : "bg-white border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="font-medium text-sm">
                        {student.first_name} {student.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {student.admission_number}
                      </div>
                      {hasAssignment && (
                        <div className="text-xs text-secondary-600 mt-1">✓ Has assignment</div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Fee Assignment Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedStudent
                ? `Assign Fees to ${selectedStudent.first_name} ${selectedStudent.last_name}`
                : "Select a Student"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedStudent ? (
              <p className="text-muted-foreground text-center py-8">Select a student to assign fees</p>
            ) : (
              <div className="space-y-6">
                {/* Fee Structure Selection */}
                <div>
                  <Label htmlFor="fee-structure">Fee Structure *</Label>
                  <Select value={selectedFeeStructure} onValueChange={setSelectedFeeStructure}>
                    <SelectTrigger id="fee-structure" className="mt-2">
                      <SelectValue placeholder="Select fee structure" />
                    </SelectTrigger>
                    <SelectContent>
                      {feeStructures.map((fs) => (
                        <SelectItem key={fs.id} value={fs.id}>
                          {fs.name} - KES {fs.total_amount?.toLocaleString() || "N/A"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Fee Structure Details */}
                {currentFeeStructure && (
                  <div className="bg-primary-50 p-4 rounded-lg border border-primary-200">
                    <h4 className="font-semibold text-sm mb-2">Fee Structure Details</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Academic Year:</span>
                        <p className="font-medium">{currentFeeStructure.academic_year}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Period:</span>
                        <p className="font-medium">{currentFeeStructure.period_name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Grade Level:</span>
                        <p className="font-medium">{currentFeeStructure.grade_level}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Amount:</span>
                        <p className="font-medium text-lg">KES {currentFeeStructure.total_amount?.toLocaleString() || "0"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Plan Selection */}
                <div>
                  <Label htmlFor="payment-plan">Payment Plan</Label>
                  <Select value={selectedPaymentPlan} onValueChange={setSelectedPaymentPlan}>
                    <SelectTrigger id="payment-plan" className="mt-2">
                      <SelectValue placeholder="Select payment plan (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentPlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} ({plan.number_of_installments} installments)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Waiver Section */}
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Checkbox
                      id="is-waived"
                      checked={isWaived}
                      onCheckedChange={(checked) => setIsWaived(Boolean(checked))}
                    />
                    <Label htmlFor="is-waived" className="cursor-pointer font-medium">
                      Apply Waiver / Discount
                    </Label>
                  </div>

                  {isWaived && (
                    <div className="space-y-3 bg-amber-50 p-4 rounded-lg">
                      <div>
                        <Label htmlFor="waiver-amount">Waiver Amount (KES)</Label>
                        <Input
                          id="waiver-amount"
                          type="number"
                          value={waiverAmount}
                          onChange={(e) => setWaiverAmount(Math.max(0, Number(e.target.value) || 0))}
                          min="0"
                          step="0.01"
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label htmlFor="waiver-reason">Reason for Waiver</Label>
                        <Textarea
                          id="waiver-reason"
                          placeholder="e.g., Scholar, financial hardship, bursary..."
                          value={waiverReason}
                          onChange={(e) => setWaiverReason(e.target.value)}
                          className="mt-2"
                          rows={2}
                        />
                      </div>

                      {currentFeeStructure && (
                        <div className="text-sm font-medium">
                          Amount after waiver: KES{" "}
                          {Math.max(0, (currentFeeStructure.total_amount || 0) - waiverAmount).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Fee Structure Components */}
                {currentFeeStructure?.structure_items && currentFeeStructure.structure_items.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm mb-3">Fee Structure Components</h4>
                    <div className="space-y-3">
                      {currentFeeStructure.structure_items.map((si) => {
                        const itemId = String(si.item);
                        const isOptional = si.item_details?.is_optional;
                        const selected = !isOptional || selectedOptionalItems.includes(itemId);
                        const amount = Number(itemAmountOverrides[itemId] ?? si.amount ?? 0);

                        return (
                          <div key={si.id} className="grid gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-[1fr_auto]">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{si.item_details.name}</span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                                  {isOptional ? "Optional" : "Mandatory"}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{si.category_name}</p>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                {isOptional ? (
                                  <Checkbox
                                    id={`optional-${si.id}`}
                                    checked={selected}
                                    onCheckedChange={() => handleToggleOptionalItem(itemId)}
                                  />
                                ) : (
                                  <span className="text-xs text-slate-500">Included</span>
                                )}
                                <Label htmlFor={`optional-${si.id}`} className="cursor-pointer text-sm">
                                  {isOptional ? "Include this item" : "Always included"}
                                </Label>
                              </div>
                              <Input
                                type="number"
                                value={amount}
                                onChange={(e) => {
                                  const value = Math.max(0, Number(e.target.value) || 0);
                                  setItemAmountOverrides((prev) => ({
                                    ...prev,
                                    [itemId]: value,
                                  }));
                                }}
                                min={0}
                                step="0.01"
                                disabled={isOptional && !selected}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 rounded-lg bg-primary-50 p-4 text-sm text-slate-800">
                      <div className="font-semibold">Assignment preview total</div>
                      <div className="text-xl font-bold mt-1">KES {previewEffectiveTotal.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        This includes mandatory items, selected optional items, and applied waiver.
                      </div>
                    </div>
                  </div>
                )}

                {/* Submission */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={handleAssignFees}
                    disabled={isSubmitting || !selectedFeeStructure}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : assignedToStudent ? (
                      "Update Assignment"
                    ) : (
                      "Create Assignment"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedStudent(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assigned Students Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Current Assignments ({assignments.length})</CardTitle>
          <p className="text-sm text-muted-foreground">Click to edit or generate invoices for each assignment</p>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No assignments yet</p>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => {
                        const stud = students.find((s) => s.id === assignment.student.id);
                        if (stud) handleSelectStudent(stud);
                      }}
                    >
                      <h4 className="font-semibold">
                        {assignment.student.first_name} {assignment.student.last_name}
                      </h4>
                      <p className="text-sm text-muted-foreground">{assignment.fee_structure.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">KES {assignment.effective_total.toLocaleString()}</p>
                      {assignment.is_waived && (
                        <p className="text-xs text-amber-600">Waived: KES {assignment.waiver_amount}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t">
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {assignment.payment_plan && <span>📋 Payment plan assigned</span>}
                      {assignment.is_waived && <span>🏷️ Waiver applied</span>}
                      <span>Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleGenerateInvoices(assignment.id)}
                      disabled={generatingInvoices.has(assignment.id)}
                      className="bg-primary hover:bg-primary-700"
                    >
                      {generatingInvoices.has(assignment.id) ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Generating...
                        </>
                      ) : (
                        "Generate Invoices"
                      )}
                    </Button>
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
