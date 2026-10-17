"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import api from "@/utils/api";
import { cn } from "@/lib/utils";
import { Application } from "@/types/admission";
import { fa } from "zod/v4/locales";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  applicationData: Application;
  onEnrolled?: (student: { id: string; full_name: string; admission_number: string }) => void;
}

interface ClassLogisticsStepProps {
  formData: Record<string, any>;
  applicationData: Application;
  updateForm: (field: string, value: any) => void;
  schoolHierarchy: "secondary" | "primary" | "simple";
}

// ─────────────────────────────────────────────────────────────
// Improved ClassLogisticsStep with clear Primary vs Secondary logic
// ─────────────────────────────────────────────────────────────
const ClassLogisticsStep = ({
  formData,
  applicationData,
  updateForm,
  schoolHierarchy,
}: ClassLogisticsStepProps) => (
  <div className="space-y-6">
    <h3 className="text-lg font-semibold">Class & Placement Logistics</h3>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Class / Grade - Always required */}
      <div>
        <Label>Class / Grade *</Label>
        <Input
          value={applicationData.class_applied?.name ?? ""}
          disabled
        />
      </div>

      {/* Section - Common to both (Boys/Girls or Lower/Upper Primary) */}
      <div>
        <Label>Section *</Label>
        <Input
          value={formData.section ?? ""}
          onChange={(e) => updateForm("section", e.target.value)}
          placeholder={
            schoolHierarchy === "secondary"
              ? "Boys, Girls, Mixed..."
              : "Lower Primary, Upper Primary, Red House..."
          }
        />
        <p className="text-xs text-muted-foreground mt-1">
          {schoolHierarchy === "secondary" ? "Gender or house grouping" : "Primary level or house"}
        </p>
      </div>

      {/* ────── SECONDARY SCHOOL FIELDS ────── */}
      {schoolHierarchy === "secondary" && (
        <>
          <div>
            <Label>Pathway</Label>
            <Select
              value={formData.pathway ?? ""}
              onValueChange={(val) => {
                updateForm("pathway", val);
                updateForm("track", "");   // Reset dependent fields
                updateForm("stream", "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Pathway (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STEM">STEM</SelectItem>
                <SelectItem value="ARTS">Arts</SelectItem>
                <SelectItem value="SOCIAL_SCIENCES">Social Sciences</SelectItem>
                <SelectItem value="TECHNICAL">Technical</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Senior secondary pathway (e.g. CBC)</p>
          </div>

          <div>
            <Label>Track</Label>
            <Input
              value={formData.track ?? ""}
              onChange={(e) => updateForm("track", e.target.value)}
              placeholder="e.g. Pure Sciences, Engineering, Humanities, Business..."
              disabled={!formData.pathway}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Specific track under the selected pathway
            </p>
          </div>
        </>
      )}

      {/* ────── STREAM FIELD - Different meaning per school type ────── */}
      <div>
        <Label>
          {schoolHierarchy === "secondary" ? "Stream (Class Division)" : "Stream"}
        </Label>
        <Input
          value={formData.stream ?? ""}
          onChange={(e) => updateForm("stream", e.target.value)}
          placeholder={
            schoolHierarchy === "secondary"
              ? "e.g. Blue, Orange, Green, 10A..."
              : "e.g. Green, Orange, A, B, Red..."
          }
        />
        <p className="text-xs text-muted-foreground mt-1">
          {schoolHierarchy === "secondary"
            ? "Final division/stream within track (e.g. Grade 10 Blue)"
            : "Used to divide classes in primary (e.g. Grade 1 Green / Grade 1 Orange)"}
        </p>
      </div>

      {/* Boarding Status */}
      <div>
        <Label>Boarding Status *</Label>
        <Select
          value={formData.boarding_status}
          onValueChange={(val) => {
            updateForm("boarding_status", val);
            if (val !== "BOARDING") {
              updateForm("house", "");
              updateForm("dorm_room", "");
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DAY">Day Scholar</SelectItem>
            <SelectItem value="BOARDING">Boarding</SelectItem>
            <SelectItem value="MIXED">Mixed (Boarding/Day)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.boarding_status === "BOARDING" && (
        <>
          <div>
            <Label>House *</Label>
            <Input
              value={formData.house ?? ""}
              onChange={(e) => updateForm("house", e.target.value)}
              placeholder="e.g. Lions, Eagles, Unity House"
            />
          </div>
          <div>
            <Label>Dorm Room *</Label>
            <Input
              value={formData.dorm_room ?? ""}
              onChange={(e) => updateForm("dorm_room", e.target.value)}
              placeholder="e.g. Dorm A – Room 101"
            />
          </div>
        </>
      )}

      {/* Transport Mode - unchanged */}
      <div>
        <Label>Transport Mode</Label>
        <Select
          value={formData.transport_mode}
          onValueChange={(val) => updateForm("transport_mode", val)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="walking">Walking</SelectItem>
            <SelectItem value="private">Private / Parent</SelectItem>
            <SelectItem value="school_bus">School Bus</SelectItem>
            <SelectItem value="public">Public Transport</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.transport_mode === "school_bus" && (
        <div>
          <Label>Bus Route / Stop</Label>
          <Input
            value={String(formData.transport_route ?? "")}
            onChange={(e) => updateForm("transport_route", e.target.value)}
            placeholder="e.g. Route 3 - Westlands Stop"
          />
        </div>
      )}
    </div>
  </div>
);

export default function EnrollmentWizardModal({
  open,
  onOpenChange,
  applicationId,
  applicationData,
  onEnrolled,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;
  const today = format(new Date(), "yyyy-MM-dd");

  const { currentSchool } = useCurrentSchool();

    // ────── SCHOOL HIERARCHY CONFIGURATION ──────
  const schoolHierarchy = useMemo<"secondary" | "primary" | "simple">(() => {
    const hierarchy = (currentSchool as any)?.hierarchy_mode;
    if (hierarchy === "primary" || hierarchy === "simple") {
      return hierarchy;
    }
    return "secondary";
  }, [currentSchool]);
  
  const [formData, setFormData] = useState<Record<string, any>>(() => ({
    first_name: applicationData.first_name || "",
    middle_name: applicationData.middle_name || "",
    last_name: applicationData.last_name || "",
    preferred_name: applicationData.preferred_name || "",
    gender: applicationData.gender || "",
    date_of_birth: applicationData.date_of_birth || "",
    nationality: applicationData.nationality || "Kenyan",
    religion: applicationData.religion || "",
    learner_id: applicationData.learner_id || "",

    birth_certificate_number: "",
    admission_number: "",
    auto_generate_admission: true,
    profile_photo: null as File | null,
    birth_certificate_file: null as File | null,
    passport_number: "",

    previous_school: applicationData.previous_school || "",
    previous_grade: "",
    transfer_letter: null,

    current_class: applicationData.class_applied?.id || "",
    section: "",
    pathway: "",
    track: "",
    stream: "",
    house: "",
    boarding_status: "DAY",
    dorm_room: "",
    transport_mode: "walking",
    transport_route: "",

    blood_group: applicationData.blood_group || "",
    allergies: applicationData.allergies || "",
    chronic_conditions: applicationData.chronic_conditions || "",
    disability: applicationData.disability || "",
    disability_type: "",
    special_needs_category: "",
    vaccination_status: "UNKNOWN",
    immunization_card: null,

    guardian_name: applicationData.primary_guardian_name || "",
    guardian_phone: applicationData.primary_guardian_phone || "",
    guardian_email: applicationData.primary_guardian_email || "",
    guardian_national_id: applicationData.primary_guardian_id_number || "",
    guardian_relation: applicationData.primary_guardian_relationship || "Parent",
    secondary_guardian_name: "",
    secondary_guardian_phone: "",
    secondary_guardian_email: "",
    secondary_guardian_national_id: "",
    emergency_name:
      applicationData.emergency_contact_name || applicationData.primary_guardian_name || "",
    emergency_phone:
      applicationData.emergency_contact_phone || applicationData.primary_guardian_phone || "",
    emergency_relation:
      applicationData.emergency_relationship || applicationData.primary_guardian_relationship || "",

    fee_structure_id: "",
    initial_payment_amount: 0,
    is_waived: false,
    waiver_amount: 0,
    waiver_reason: "",
    selected_optional_items: [],
    item_amounts: {} as Record<string, number>,
    sponsor_name: "",
    initial_payment_proof: null as File | null,
    initial_payment_reference: "",
    payment_plan: "",
    remaining_payment_due_date: today,
    notes: "",

    // ── New final fields ───────────────────────────────
    admission_date: today,
    terms_accepted: false,
    summary_confirmed: false,
  }));

  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [applicationCharges, setApplicationCharges] = useState<any[]>([]);
  const [chargesLoading, setChargesLoading] = useState(false);

  // 1. Add this to your State/useEffect at the top of the component
  const [optionalItems, setOptionalItems] = useState<any[]>([]);
  const [paymentPlans, setPaymentPlans] = useState<any[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<{
    initialPayment: number;
    balance: number;
    total: number;
    dueDates: string[];
    installments: Array<{ amount: number; dueDate: string }>;
  }>({
    initialPayment: 0,
    balance: 0,
    total: 0,
    dueDates: [],
    installments: [],
  });

  useEffect(() => {
    console.log("APPLICATION DATA received in wizard:", applicationData);
  }, [applicationData]);
  const currencySymbol = currentSchool?.currency_symbol || "Ksh";

  const calculatePayments = () => {
    const structure = feeStructures.find(
      (fs) => String(fs.id) === String(formData.fee_structure_id)
    );

    if (!structure) {
      setPaymentBreakdown({ initialPayment: 0, balance: 0, total: 0, dueDates: [], installments: [] });
      return;
    }

    // === 1. Build Total Due correctly every time ===
    let totalDue = 0;

    const allItems = structure.structure_items || [];
    const admissionItemIds = new Set(
      allItems
        .filter((si: any) => {
          const category = (si.category_name || si.item_details?.category_name || "").trim();
          return category === "Admission & Registration";
        })
        .map((si: any) => String(si.item?.id || si.item))
    );

    const optionalItemIdsSet = new Set(
      (structure.available_optional_items || [])
        .map((id: any) => String(id))
        .filter((id: string) => !admissionItemIds.has(id))
    );

    // Add MANDATORY items only; admission items are always mandatory during enrollment
    allItems.forEach((si: any) => {
      const itemId = String(si.item?.id || si.item);
      if (!optionalItemIdsSet.has(itemId) || admissionItemIds.has(itemId)) {
        totalDue += Number(si.amount || 0);
      }
    });

    // Add SELECTED optional items (exclude admission items even if they were listed as optional)
    formData.selected_optional_items.forEach((id: string) => {
      const itemId = String(id);
      if (admissionItemIds.has(itemId)) {
        return;
      }

      const matching = allItems.find((si: any) =>
        String(si.item?.id || si.item) === itemId
      );

      if (matching) {
        totalDue += Number(matching.amount || 0);
      }
    });

    // Apply waiver
    if (formData.is_waived) {
      totalDue = Math.max(0, totalDue - Number(formData.waiver_amount || 0));
    }

    const depositAllocated = getItemAmountTotal(formData.item_amounts || {});
    const initialPaid = depositAllocated > 0
      ? depositAllocated
      : Number(formData.initial_payment_amount || 0);
    const balance = Math.max(0, totalDue - initialPaid);

    // Get plan
    const selectedPlan = paymentPlans.find(
      (p) => String(p.id) === String(formData.payment_plan)
    );

    let installments: Array<{ amount: number; dueDate: string }> = [];
    const startDate = new Date();

    if (balance > 0) {
      if (!selectedPlan || selectedPlan.number_of_installments <= 1 || selectedPlan.plan_type === "custom") {
        const dueDate = formData.remaining_payment_due_date || format(new Date(startDate.getTime() + (30 * 24 * 60 * 60 * 1000)), "yyyy-MM-dd");
        installments.push({
          amount: Number(balance.toFixed(2)),
          dueDate,
        });
      } else {
        const numInstallments = selectedPlan.number_of_installments;
        let daysInterval = Number(selectedPlan.days_interval) || 30;

        // Force correct interval for weekly plans
        if (selectedPlan.name?.toLowerCase().includes("weekly")) {
          daysInterval = 7;
        }

        let baseAmount = Math.floor(balance / numInstallments);
        let remaining = balance;

        for (let i = 1; i <= numInstallments; i++) {
          const amount = (i === numInstallments) ? remaining : baseAmount;

          const due = new Date(startDate);
          due.setDate(due.getDate() + i * daysInterval);

          installments.push({
            amount: Number(amount.toFixed(2)),
            dueDate: format(due, "yyyy-MM-dd"),
          });

          remaining -= amount;
        }
      }
    }

    setPaymentBreakdown({
      initialPayment: initialPaid,
      balance: Number(balance.toFixed(2)),
      total: Number(totalDue.toFixed(2)),
      dueDates: installments.map(i => i.dueDate),
      installments,
    });
  };

  useEffect(() => {
    if (formData.fee_structure_id) {
      calculatePayments();
    }
  }, [
    formData.fee_structure_id,
    formData.payment_plan,
    formData.selected_optional_items,
    formData.is_waived,
    formData.waiver_amount,
    formData.initial_payment_amount,
    formData.item_amounts,
    formData.remaining_payment_due_date,
  ]);

  useEffect(() => {
    const structure = feeStructures.find(
      (fs) => String(fs.id) === String(formData.fee_structure_id)
    );
    if (!structure) return;

    const depositTarget = Number(formData.initial_payment_amount || 0);
    if (depositTarget <= 0) return;

    const currentTotal = getItemAmountTotal(formData.item_amounts || {});
    const currentIds = new Set(Object.keys(formData.item_amounts || {}));
    const relevantItems = getSelectedFeeItems(structure);
    const relevantIds = new Set(relevantItems.map((si: any) => String(si.item?.id || si.item)));

    const missingItem = relevantItems.some((si: any) => !currentIds.has(String(si.item?.id || si.item)));
    const hasExtraKeys = Array.from(currentIds).some((id) => !relevantIds.has(id));

    if (currentTotal === 0 || missingItem || hasExtraKeys) {
      const defaultAllocations = getDefaultDepositAllocations(structure, depositTarget);
      updateForm("item_amounts", defaultAllocations);
    }
  }, [
    feeStructures,
    formData.fee_structure_id,
    formData.selected_optional_items,
    formData.is_waived,
    formData.waiver_amount,
    formData.initial_payment_amount,
  ]);


  useEffect(() => {
    const classId = applicationData?.class_applied?.id;

    if (!open || !classId) return;

    const asList = (data: any): any[] => {
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.results)) return data.results;
      if (Array.isArray(data?.data)) return data.data;
      return [];
    };

    const rank = (s: any) => {
      const p = String(s.period_name || "").toLowerCase();
      const m = p.match(/(\d+)/);
      if (m) return Number(m[1]);
      if (p.includes("term 1") || p.includes("semester 1")) return 1;
      return 99;
    };

    const loadFinanceData = async () => {
      setFeeLoading(true);
      setFeeError(null);
      try {
        // Fast path: lite list (no nested line items) + payment plans only.
        // Detail for one structure is loaded by the fee_structure_id effect below.
        const [structuresRes, plansRes] = await Promise.all([
          api.get("/finance/structures/", {
            params: {
              grade_level: classId,
              is_active: true,
            },
            timeout: 20000,
          }),
          api.get("/finance/payment-plans/", { timeout: 15000 }).catch(() => ({ data: [] })),
        ]);

        let list = asList(structuresRes.data).filter(
          (s: any) =>
            !s.grade_level ||
            String(s.grade_level) === String(classId) ||
            String(s.grade_level?.id) === String(classId)
        );

        list = [...list].sort(
          (a, b) => rank(a) - rank(b) || String(a.name || "").localeCompare(String(b.name || ""))
        );

        setFeeStructures(list);
        setOptionalItems([]); // come from structure detail available_optional_items
        const plans = asList(plansRes.data);
        setPaymentPlans(plans);

        if (list.length > 0) {
          setFormData((prev) => {
            if (prev.fee_structure_id && list.some((s) => String(s.id) === String(prev.fee_structure_id))) {
              return prev;
            }
            return { ...prev, fee_structure_id: String(list[0].id) };
          });
        } else {
          setFeeError(
            "No active fee structure for this grade in Finance. Create one under Finance → Fee structures (same as used on the offer letter)."
          );
        }

        if (plans.length > 0) {
          setFormData((prev) => {
            if (prev.payment_plan) return prev;
            const rec = plans.find((p: any) => p.is_recommended) || plans[0];
            return { ...prev, payment_plan: String(rec.id) };
          });
        }
      } catch (err) {
        console.error(err);
        setFeeError("Failed to load fee structures from Finance");
        toast.error("Failed to load financial data from Finance");
      } finally {
        setFeeLoading(false);
      }
    };

    loadFinanceData();
  }, [open, applicationData?.class_applied?.id]);

  // Ensure interview/admission charges exist (N/A by default if school amounts are 0)
  useEffect(() => {
    if (!open || !applicationId) return;
    let cancelled = false;
    (async () => {
      setChargesLoading(true);
      try {
        const res = await api.post(`/admissions/applications/${applicationId}/ensure-charges/`);
        if (!cancelled) setApplicationCharges(res.data?.charges || []);
      } catch (e) {
        console.warn("ensure-charges failed", e);
        if (!cancelled) setApplicationCharges([]);
      } finally {
        if (!cancelled) setChargesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, applicationId]);

  // Load line items only for the selected structure (1 request, not N)
  useEffect(() => {
    const id = formData.fee_structure_id;
    if (!open || !id) return;
    const existing = feeStructures.find((s) => String(s.id) === String(id));
    if (existing && Array.isArray(existing.structure_items) && existing.structure_items.length > 0) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/finance/structures/${id}/`, { timeout: 20000 });
        if (cancelled || !res.data) return;
        setFeeStructures((prev) => {
          const idx = prev.findIndex((s) => String(s.id) === String(id));
          if (idx === -1) return [...prev, res.data];
          const next = [...prev];
          next[idx] = { ...prev[idx], ...res.data };
          return next;
        });
      } catch (e) {
        console.warn("structure detail failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, formData.fee_structure_id]);


  const getAdmissionCategoryName = () => "Admission & Registration";

  const getSelectedFeeItems = (structure: any) => {
    if (!structure) return [];

    const allItems = structure.structure_items || [];
    const admissionCategory = getAdmissionCategoryName();
    const admissionItemIds = new Set(
      allItems
        .filter((si: any) => {
          const cat = (si.category_name || si.item_details?.category_name || "").trim();
          return cat === admissionCategory;
        })
        .map((si: any) => String(si.item?.id || si.item))
    );

    const optionalItemIds = new Set(
      (structure.available_optional_items || [])
        .map((id: any) => String(id))
        .filter((id: string) => !admissionItemIds.has(id))
    );

    const selectedOptionalIds = new Set(
      (formData.selected_optional_items || []).map((id: any) => String(id))
    );

    return allItems.filter((si: any) => {
      const itemId = String(si.item?.id || si.item);
      const isOptional = optionalItemIds.has(itemId);
      return !isOptional || selectedOptionalIds.has(itemId) || admissionItemIds.has(itemId);
    });
  };

  const getAdmissionNetByItem = (structure: any) => {
    const items = (structure?.structure_items || []).filter((si: any) => {
      const cat = (si.category_name || si.item_details?.category_name || "").trim();
      return cat === getAdmissionCategoryName();
    });

    const admissionTotal = items.reduce((sum: number, si: any) => sum + Number(si.amount || 0), 0);
    const waiverAmount = formData.is_waived ? Number(formData.waiver_amount || 0) : 0;

    return items.reduce((map: Record<string, number>, si: any) => {
      const itemId = String(si.item?.id || si.item);
      if (admissionTotal > 0 && waiverAmount > 0) {
        const share = Number(si.amount || 0) / admissionTotal;
        const itemWaiver = Number((waiverAmount * share).toFixed(2));
        map[itemId] = Math.max(0, Number(si.amount || 0) - itemWaiver);
      } else {
        map[itemId] = Number(si.amount || 0);
      }
      return map;
    }, {} as Record<string, number>);
  };

  const getAllocationItemCost = (si: any, netAdmissionByItem: Record<string, number>) => {
    const itemId = String(si.item?.id || si.item);
    return netAdmissionByItem[itemId] ?? Number(si.amount || 0);
  };

  const getItemAmountTotal = (amounts: Record<string, number>) =>
    Object.values(amounts || {}).reduce((sum, value) => sum + Number(value || 0), 0);

  const getDepositAmount = () => Number(formData.initial_payment_amount || 0);
  const getAllocatedDepositTotal = () => getItemAmountTotal(formData.item_amounts || {});
  const isItemAllocationValid = () => {
    const depositAmount = getDepositAmount();
    const allocatedTotal = getAllocatedDepositTotal();
    if (allocatedTotal === 0) return true;
    return Math.abs(depositAmount - allocatedTotal) < 0.01;
  };

  const getDefaultDepositAllocations = (structure: any, depositAmount: number) => {
    if (!structure || depositAmount <= 0) return {};

    const items = getSelectedFeeItems(structure);
    const netAdmissionByItem = getAdmissionNetByItem(structure);
    const admissionItemIds = new Set(
      (structure.structure_items || [])
        .filter((si: any) => {
          const cat = (si.category_name || si.item_details?.category_name || "").trim();
          return cat === getAdmissionCategoryName();
        })
        .map((si: any) => String(si.item?.id || si.item))
    );

    let remaining = Number(depositAmount || 0);
    const allocations: Record<string, number> = {};

    const sortedItems = [...items].sort((a, b) => {
      const aId = String(a.item?.id || a.item);
      const bId = String(b.item?.id || b.item);
      const aPriority = admissionItemIds.has(aId) ? 0 : 1;
      const bPriority = admissionItemIds.has(bId) ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return aId.localeCompare(bId);
    });

    for (const si of sortedItems) {
      if (remaining <= 0) break;
      const itemId = String(si.item?.id || si.item);
      const cost = getAllocationItemCost(si, netAdmissionByItem);
      const allocated = Math.min(cost, remaining);
      if (allocated > 0) {
        allocations[itemId] = allocated;
        remaining -= allocated;
      }
    }

    return allocations;
  };

  const updateForm = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateApplicationCharge = async (
    chargeType: string,
    payload: Record<string, any>
  ) => {
    try {
      const res = await api.patch(
        `/admissions/applications/${applicationId}/charges/${chargeType}/`,
        payload
      );
      setApplicationCharges((prev) => {
        const rest = prev.filter((c) => c.charge_type !== chargeType);
        return [...rest, res.data];
      });
      toast.success(`${chargeType === "INTERVIEW" ? "Interview" : "Admission"} fee updated`);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not update charge");
    }
  };

  const lineLabel = (si: any) =>
    si.item_name || si.item_details?.name || si.name || "Fee item";
  const lineCat = (si: any) =>
    si.category_name || si.item_details?.category_name || "Fees";


  const validateStep = (step: number) => {
    switch (step) {
      case 1:
        const hasPhoto = !!formData.profile_photo || !!applicationData.photo;
        return (
          formData.first_name &&
          formData.last_name &&
          formData.date_of_birth &&
          formData.gender &&
          (formData.birth_certificate_number || formData.passport_number) &&
          hasPhoto &&
          formData.birth_certificate_file
        );
      case 2:
        return true;

      case 3:
        const isBoarding = formData.boarding_status === "BOARDING";
        return (
          formData.current_class &&
          formData.section?.trim() &&
          (!isBoarding || (formData.house?.trim() && formData.dorm_room?.trim()))
          // Pathway/track/stream are optional for flexibility
        );

      case 4:
        return formData.vaccination_status;
      case 5:
        return formData.guardian_name && formData.guardian_phone && formData.guardian_national_id;

      case 6: {
        const deposit = Number(formData.initial_payment_amount || 0);
        const hasPaymentProof =
          deposit <= 0 ||
          String(formData.initial_payment_reference || "").trim().length > 2 ||
          !!formData.initial_payment_proof;

        const waiverIsValid =
          !formData.is_waived ||
          String(formData.waiver_reason || "").trim().length >= 2;

        const allocationValid = isItemAllocationValid();
        const paymentPlanOk =
          paymentPlans.length === 0 || !!formData.payment_plan;

        const isValid =
          !!formData.fee_structure_id &&
          paymentPlanOk &&
          formData.terms_accepted === true &&
          formData.summary_confirmed === true &&
          hasPaymentProof &&
          waiverIsValid &&
          allocationValid;

        return isValid;
      }
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    } else {
      if (currentStep === 6 && !isItemAllocationValid()) {
        toast.error("Deposit allocation total must equal the entered amount before enrollment.");
      } else {
        toast.error("Please complete all required fields.");
      }
    }
  };

  const handlePrev = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = new FormData();

      // Handle all fields properly
      Object.entries(formData).forEach(([key, value]) => {
        if (value === null || value === undefined) return;

        if (key === "selected_optional_items" && Array.isArray(value)) {
          value.forEach((id) => payload.append("selected_optional_items", String(id)));
        }
        else if (value instanceof File) {
          payload.append(key, value);
        }
        else if (typeof value === "boolean") {
          // Critical: Django accepts "true" / "false" as strings for BooleanField
          payload.append(key, value ? "true" : "false");
        }
        else if (typeof value === "number" || !isNaN(Number(value))) {
          payload.append(key, String(value));
        }
        else {
          payload.append(key, String(value));
        }
      });

      // Explicit mapping for important fields (safety)
      if (formData.fee_structure_id) {
        payload.set("fee_structure", String(formData.fee_structure_id));
      }

      if (formData.payment_plan) {
        payload.set("payment_plan", String(formData.payment_plan));   // This is important
      }

      const allocationTotal = getItemAmountTotal(formData.item_amounts || {});
      if (allocationTotal > 0) {
        payload.set("initial_payment_amount", String(allocationTotal));
      }

      if (formData.item_amounts && typeof formData.item_amounts === "object") {
        payload.set("item_amounts", JSON.stringify(formData.item_amounts));
      }

      // Manual admission number
      if (!formData.auto_generate_admission && formData.admission_number) {
        payload.set("admission_number", formData.admission_number);
      }

      console.log("[ENROLL] Sending payload keys:", Array.from(payload.keys())); // Debug

      const res = await api.post(
        `/admissions/applications/${applicationId}/enroll/`,
        payload,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      toast.success("Student enrolled successfully!");

      const studentId = res.data.id ||
        res.data.student_id ||
        res.data.student ||
        applicationData.student;

      if (studentId) {
        onEnrolled?.({
          id: String(studentId),
          full_name: res.data.full_name ?? res.data.student_name,
          admission_number: res.data.admission_number,
        });
      } else {
        toast.warning("Student enrolled, but ID not returned. Refresh the list.");
      }

      onOpenChange(false);

    } catch (err: any) {
      const data = err?.response?.data;
      console.error("Enrollment error full response:", data || err?.message || err);
      let msg = "Enrollment failed";
      if (typeof data === "string" && data.trim()) msg = data.slice(0, 200);
      else if (data?.detail) msg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      else if (data && typeof data === "object") {
        const parts = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
        if (parts.length) msg = parts.join(" · ");
      } else if (err?.message) msg = err.message;
      if (err?.response?.status) msg = `[${err.response.status}] ${msg}`;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ClassLogisticsStep is defined outside the component to avoid remounts on every render.

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Student Identification</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "First Name *", key: "first_name", disabled: true },
                { label: "Middle Name", key: "middle_name", disabled: true },
                { label: "Last Name *", key: "last_name", disabled: true },
                { label: "Preferred Name", key: "preferred_name" },
                { label: "Gender *", key: "gender", disabled: true },
                { label: "Date of Birth *", key: "date_of_birth", type: "date", disabled: true },
                { label: "Nationality", key: "nationality", disabled: true },
                { label: "Learner ID / UPI", key: "learner_id", disabled: false },
                { label: "Birth Certificate Number *", key: "birth_certificate_number" },
                { label: "Passport Number (non-Citizen)", key: "passport_number" },
              ].map(({ label, key, type = "text", disabled = false }) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input
                    type={type}
                    value={(formData[key] ?? "") as string}
                    onChange={(e) => !disabled && updateForm(key, e.target.value)}
                    placeholder={disabled ? undefined : `Enter ${label.toLowerCase().replace("*", "")}`}
                    disabled={disabled}
                  />
                </div>
              ))}
            </div>
            {/* ── New fields ── */}
            <div className="md:col-span-2">
              <Label>Admission Number</Label>
              {(() => {
                const fmt = (currentSchool as any)?.admission_number_format || "PREFIX_SEQ";
                const prefix = ((currentSchool as any)?.admission_prefix || "PSS").trim();
                const pad = Number((currentSchool as any)?.admission_seq_padding || 3);
                const example =
                  fmt === "PREFIX_SEQ"
                    ? `${prefix}${"1".padStart(pad, "0")}`
                    : fmt === "YEAR_SEQ"
                      ? `${new Date().getFullYear()}-${"1".padStart(pad, "0")}`
                      : fmt === "PREFIX_YEAR_SEQ"
                        ? `${prefix}-${new Date().getFullYear()}-${"1".padStart(pad, "0")}`
                        : "manual entry";
                const isCustom = fmt === "CUSTOM";
                return (
                  <>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">
                      School format:{" "}
                      <span className="font-medium text-foreground">
                        {fmt === "PREFIX_SEQ"
                          ? "Prefix + sequence"
                          : fmt === "YEAR_SEQ"
                            ? "Year + sequence"
                            : fmt === "PREFIX_YEAR_SEQ"
                              ? "Prefix + year + sequence"
                              : "Manual only"}
                      </span>
                      {prefix ? (
                        <>
                          {" "}
                          · prefix <span className="font-mono font-semibold">{prefix}</span>
                        </>
                      ) : null}
                      {" "}
                      · e.g. <span className="font-mono">{example}</span>
                      . Numbers are unique per school.
                    </p>
                    {!isCustom && (
                      <div className="flex items-center gap-3 mt-1">
                        <Checkbox
                          id="auto-gen"
                          checked={formData.auto_generate_admission !== false}
                          onCheckedChange={(v) =>
                            updateForm("auto_generate_admission", v === true)
                          }
                        />
                        <Label htmlFor="auto-gen" className="text-sm">
                          Auto-generate next number for this school (e.g. {example})
                        </Label>
                      </div>
                    )}
                    {(isCustom || formData.auto_generate_admission === false) && (
                      <Input
                        className="mt-2 font-mono"
                        value={formData.admission_number}
                        onChange={(e) =>
                          updateForm("admission_number", e.target.value.toUpperCase())
                        }
                        placeholder={example}
                      />
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Change prefix/format under Settings → Admission numbers.
                    </p>
                  </>
                );
              })()}
            </div>

            <div>
              <Label>Student Photo * (for ID card & records)</Label>

              {/* Show existing photo if available */}
              {applicationData.photo && (
                <div className="mt-2 mb-4">
                  <p className="text-sm font-medium text-slate-700 mb-1">Previously uploaded during application:</p>
                  <div className="relative inline-block">
                    <img
                      src={applicationData.photo}
                      alt="Student photo preview"
                      className="h-32 w-32 object-cover rounded-lg border border-slate-300 shadow-sm"
                      onError={(e) => {
                        // Fallback if image fails to load
                        e.currentTarget.src = "/fallback-student-avatar.png"; // add a placeholder image in public/
                        e.currentTarget.alt = "Photo failed to load";
                      }}
                    />
                    <p className="text-xs text-slate-500 mt-1 text-center">
                      Click "Choose File" below to replace
                    </p>
                  </div>
                </div>
              )}

              {/* File input – always show, but change label if photo exists */}
              <div className={cn(
                "border-2 border-dashed rounded-lg p-4 text-center",
                applicationData.photo ? "border-slate-300 bg-slate-50" : "border-primary-300 bg-primary-50/30"
              )}>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      updateForm("profile_photo", file);
                      // Optional: show local preview immediately
                      const previewUrl = URL.createObjectURL(file);
                      // You could store this in state if you want instant preview of new upload
                    }
                  }}
                  className="hidden"
                  id="profile-photo-upload"
                />
                <label
                  htmlFor="profile-photo-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <div className="p-3 bg-primary-100 rounded-full">
                    <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-primary-700">
                    {applicationData.photo ? "Replace Photo" : "Upload New Photo"}
                  </span>
                  <span className="text-xs text-slate-500">
                    JPG, PNG • Max 5MB
                  </span>
                </label>
              </div>

              {/* Optional: show name of newly selected file */}
              {formData.profile_photo && (
                <p className="text-xs text-slate-600 mt-2">
                  Selected: {formData.profile_photo.name}
                </p>
              )}
            </div>

            <div>
              <Label>Birth Certificate Upload * (PDF/Image – required for NEMIS)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => updateForm("birth_certificate_file", e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Previous Academic Record</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Previous School Name & Address</Label>
                <Textarea
                  value={formData.previous_school ?? ""}
                  onChange={(e) => updateForm("previous_school", e.target.value)}
                  placeholder="Name, location, contact..."
                />
              </div>
              <div>
                <Label>Previous Grade / Class</Label>
                <Input
                  value={formData.previous_grade ?? ""}
                  onChange={(e) => updateForm("previous_grade", e.target.value)}
                  placeholder="e.g. Grade 4"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Transfer / Leaving Certificate Upload</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.png"
                  onChange={(e) => updateForm("transfer_letter", e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <ClassLogisticsStep
            formData={formData}
            applicationData={applicationData}
            updateForm={updateForm}
            schoolHierarchy={schoolHierarchy}   // ← Add this
          />
        );

      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Health & Special Needs</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Vaccination Status *</Label>
                <Select
                  value={formData.vaccination_status ?? "UNKNOWN"}
                  onValueChange={(val) => updateForm("vaccination_status", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UP_TO_DATE">Up to date</SelectItem>
                    <SelectItem value="PARTIAL">Partial</SelectItem>
                    <SelectItem value="NOT_IMMUNIZED">Not immunized</SelectItem>
                    <SelectItem value="UNKNOWN">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Immunization Card Upload</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.png"
                  onChange={(e) => updateForm("immunization_card", e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <Label>Disability (if any)</Label>
                <Input
                  value={formData.disability ?? ""}
                  onChange={(e) => updateForm("disability", e.target.value)}
                  placeholder="e.g. Visual impairment"
                />
              </div>
              <div>
                <Label>Disability Type / Category</Label>
                <Select
                  value={formData.disability_type ?? ""}
                  onValueChange={(val) => updateForm("disability_type", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="physical">Physical</SelectItem>
                    <SelectItem value="visual">Visual</SelectItem>
                    <SelectItem value="hearing">Hearing</SelectItem>
                    <SelectItem value="learning">Learning</SelectItem>
                    <SelectItem value="intellectual">Intellectual</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Special Needs Category</Label>
                <Input
                  value={formData.special_needs_category ?? ""}
                  onChange={(e) => updateForm("special_needs_category", e.target.value)}
                  placeholder="e.g. Gifted, Slow Learner, Autism Spectrum"
                />
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Guardians & Emergency Contacts</h3>
            <div className="space-y-8">
              {/* Primary Guardian */}
              <div>
                <h4 className="font-medium mb-3">Primary Guardian</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Name *</Label>
                    <Input value={formData.guardian_name ?? ""} disabled />
                  </div>
                  <div>
                    <Label>National ID / Passport *</Label>
                    <Input
                      value={formData.guardian_national_id ?? ""}
                      disabled
                    />
                  </div>
                  <div>
                    <Label>Phone *</Label>
                    <Input value={formData.guardian_phone ?? ""} disabled />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={formData.guardian_email ?? ""} disabled />
                  </div>
                </div>
              </div>

              {/* Secondary Guardian */}
              <div>
                <h4 className="font-medium mb-3">Secondary Guardian (optional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: "Name", key: "secondary_guardian_name" },
                    { label: "National ID / Passport", key: "secondary_guardian_national_id" },
                    { label: "Phone", key: "secondary_guardian_phone" },
                    { label: "Email", key: "secondary_guardian_email" },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <Label>{label}</Label>
                      <Input
                        value={formData[key] ?? ""}
                        onChange={(e) => updateForm(key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h4 className="font-medium mb-3">Emergency Contact</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: "Name", key: "emergency_name" },
                    { label: "Phone", key: "emergency_phone" },
                    { label: "Relation", key: "emergency_relation" },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <Label>{label}</Label>
                      <Input
                        value={formData[key] ?? ""}
                        onChange={(e) => updateForm(key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 6: {
        const selectedStructure = feeStructures.find(
          (fs) => String(fs.id) === String(formData.fee_structure_id)
        );

        const selectedPlan = paymentPlans.find(
          (p) => String(p.id) === String(formData.payment_plan)
        );

        if (!selectedStructure) {
          return (
            <div className="space-y-6 p-4">
              <section className="space-y-3">
                <Label className="text-sm font-bold">Fee structure (from Finance)</Label>
                <p className="text-xs text-muted-foreground">
                  Same active structures as the admission offer letter for{" "}
                  <strong>{applicationData?.class_applied?.name || "this grade"}</strong>.
                </p>
                {feeLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
                {feeError && (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3">
                    {feeError}
                  </p>
                )}
                <Select
                  value={formData.fee_structure_id}
                  onValueChange={(val) => {
                    updateForm("fee_structure_id", val);
                    updateForm("selected_optional_items", []);
                  }}
                  disabled={feeLoading || feeStructures.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        feeStructures.length
                          ? "Choose term structure…"
                          : "No structure for this grade"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {feeStructures.map((fs: any) => (
                      <SelectItem key={fs.id} value={String(fs.id)}>
                        {fs.period_name ? `${fs.period_name} — ${fs.name}` : fs.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>
              <div className="text-center text-slate-500 py-10 text-sm">
                {feeStructures.length === 0
                  ? "Create an active fee structure in Finance for this grade, then return here."
                  : "Select a fee structure above to continue enrollment."}
              </div>
            </div>
          );
        }

        const ADMISSION_CATEGORY_NAME = "Admission & Registration";

        const allItems = selectedStructure?.structure_items ?? [];

        const optionalItemIds = new Set(
          (selectedStructure?.available_optional_items ?? []).map((id: number) => String(id))
        );

        const admissionItems = allItems.filter((si: any) => {
          const cat = (si.category_name || si.item_details?.category_name || "").trim();
          return cat === ADMISSION_CATEGORY_NAME;
        });

        const admissionItemIds = new Set(
          admissionItems.map((si: any) => String(si.item?.id || si.item))
        );

        const mandatoryItems = allItems.filter((si: any) => {
          const itemId = String(si.item?.id || si.item);
          return !optionalItemIds.has(itemId) || admissionItemIds.has(itemId);
        });

        const optionalItemsInStructure = allItems.filter((si: any) => {
          const itemId = String(si.item?.id || si.item);
          return optionalItemIds.has(itemId) && !admissionItemIds.has(itemId);
        });

        const selectedOptionalIds: string[] = (formData.selected_optional_items ?? [])
          .map((id: any) => String(id))
          .filter((id: string) => !admissionItemIds.has(id));

        const totalAdmissionAmount = admissionItems.reduce((sum: number, si: any) =>
          sum + Number(si.amount || 0), 0
        );

        const netAdmission = formData.is_waived
          ? Math.max(0, totalAdmissionAmount - Number(formData.waiver_amount || 0))
          : totalAdmissionAmount;

        const otherMandatoryAmount = mandatoryItems
          .filter((si: any) => {
            const cat = (si.category_name || si.item_details?.category_name || "").trim();
            return cat !== ADMISSION_CATEGORY_NAME;
          })
          .reduce((sum: number, si: any) => sum + Number(si.amount || 0), 0);

        const optionalTotal = selectedOptionalIds.reduce((sum: number, id: string | number) => {
          const matchingSI = selectedStructure?.structure_items?.find((si: any) =>
            String(si.item?.id || si.item) === String(id)
          );
          return sum + (matchingSI ? Number(matchingSI.amount || 0) : 0);
        }, 0);

        const totalDueNow = otherMandatoryAmount + netAdmission + optionalTotal;
        const depositAllocated = getItemAmountTotal(formData.item_amounts || {});
        const depositPaid = depositAllocated > 0 ? depositAllocated : Number(formData.initial_payment_amount || 0);
        const balanceDue = Math.max(0, totalDueNow - depositPaid);

        type AllocationItem = {
          itemId: string;
          name: string;
          category: string;
          cost: number;
          allocated: number;
          isAdmission: boolean;
        };

        const allocationItems: AllocationItem[] = selectedStructure
          ? getSelectedFeeItems(selectedStructure).map((si: any) => {
            const itemId = String(si.item?.id || si.item);
            const netAdmissionByItem = getAdmissionNetByItem(selectedStructure);
            const cost = getAllocationItemCost(si, netAdmissionByItem);
            return {
              itemId,
              name: si.item_name || si.item_details?.name || si.name || si.description || "Fee item",
              category: si.category_name || si.item_details?.category_name || si.item_details?.category?.name || "Fees",
              cost,
              allocated: Number(formData.item_amounts?.[itemId] || 0),
              isAdmission: admissionItemIds.has(itemId),
            };
          })
          : [];

        const allocatedDepositTotal = getItemAmountTotal(formData.item_amounts || {});
        const suggestTransport = formData.transport_mode === "school_bus";
        const transportItem = selectedStructure.available_optional_items_details?.find((it: any) =>
          it.name.toLowerCase().includes("transport") || it.name.toLowerCase().includes("bus")
        );

        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* LEFT COLUMN */}
              <div className="lg:col-span-3 space-y-6">


                {/* Pre-enrollment charges (interview / admission) */}
                <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="font-semibold text-lg">Pre-enrollment charges</h3>
                  <p className="text-xs text-muted-foreground">
                    Interview and admission fees are separate from term school fees. Defaults follow school settings; mark N/A or waived for legacy applications.
                  </p>
                  {chargesLoading ? (
                    <p className="text-sm text-muted-foreground">Loading charges…</p>
                  ) : applicationCharges.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No charges configured yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {["INTERVIEW", "ADMISSION"].map((ctype) => {
                        const c = applicationCharges.find((x) => x.charge_type === ctype);
                        if (!c) return null;
                        const label = ctype === "INTERVIEW" ? "Interview fee" : "Admission / registration fee";
                        return (
                          <div key={ctype} className="rounded-lg border bg-slate-50 p-3 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium text-sm">{label}</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                c.is_satisfied ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                              }`}>
                                {c.is_satisfied ? "Satisfied" : "Outstanding"}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                              <Select
                                value={c.policy}
                                onValueChange={(v) =>
                                  updateApplicationCharge(ctype, {
                                    policy: v,
                                    waiver_reason: v === "WAIVED" || v === "DISCOUNTED" ? c.waiver_reason || "Staff adjustment" : "",
                                  })
                                }
                              >
                                <SelectTrigger className="h-9 w-[180px] bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="NOT_APPLICABLE">Not applicable</SelectItem>
                                  <SelectItem value="FULL">Full amount due</SelectItem>
                                  <SelectItem value="DISCOUNTED">Discounted</SelectItem>
                                  <SelectItem value="WAIVED">Waived</SelectItem>
                                </SelectContent>
                              </Select>
                              <span className="text-sm font-mono">
                                Due {currencySymbol} {Number(c.amount_due || 0).toLocaleString()}
                                {Number(c.amount_paid) > 0
                                  ? ` · Paid ${Number(c.amount_paid).toLocaleString()}`
                                  : ""}
                              </span>
                            </div>
                            {(c.policy === "FULL" || c.policy === "DISCOUNTED") && !c.is_satisfied && (
                              <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                  <Label className="text-xs">Record payment amount</Label>
                                  <Input
                                    type="number"
                                    className="h-9"
                                    defaultValue={c.amount_due}
                                    id={`pay-${ctype}`}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    const el = document.getElementById(`pay-${ctype}`) as HTMLInputElement | null;
                                    const amt = Number(el?.value || c.amount_due || 0);
                                    updateApplicationCharge(ctype, { amount_paid: amt, policy: c.policy });
                                  }}
                                >
                                  Mark paid
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Fee Structure */}
                <section className="space-y-3">
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</span>
                    Fee structure (from Finance)
                  </Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Loaded for <strong>{applicationData?.class_applied?.name || "this grade"}</strong> — same active structures used on the admission offer letter. Not an upload.
                  </p>
                  {feeLoading && (
                    <p className="text-sm text-muted-foreground">Loading fee structures…</p>
                  )}
                  {feeError && (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3">{feeError}</p>
                  )}
                  <Select
                    value={formData.fee_structure_id}
                    onValueChange={(val) => {
                      updateForm("fee_structure_id", val);
                      updateForm("selected_optional_items", []);
                    }}
                    disabled={feeLoading || feeStructures.length === 0}
                  >
                    <SelectTrigger className="h-12 border-slate-200">
                      <SelectValue placeholder={feeStructures.length ? "Choose term structure…" : "No structure for this grade"} />
                    </SelectTrigger>
                    <SelectContent>
                      {feeStructures.map((fs: any) => (
                        <SelectItem key={fs.id} value={String(fs.id)}>
                          {fs.name} — {fs.period_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </section>

                {/* Mandatory Fees */}
                <section className="space-y-4 bg-slate-50 p-5 rounded-xl border">
                  <h3 className="font-semibold text-lg">Mandatory Fees</h3>
                  {/* Admission block */}
                  <div className="bg-gradient-to-b from-amber-50/70 to-white p-5 rounded-lg border border-amber-200">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold">
                          1x
                        </div>
                        <h4 className="font-semibold">Admission & Registration</h4>
                      </div>
                      <p className="text-xl font-bold">{currencySymbol} {totalAdmissionAmount.toLocaleString()}</p>
                    </div>

                    {admissionItems.length > 0 ? (
                      <ul className="space-y-2 text-sm">
                        {admissionItems.map((si: any) => (
                          <li key={si.id || lineLabel(si)} className="flex justify-between gap-2">
                            <span>{lineLabel(si)} <span className="text-slate-400">· {lineCat(si)}</span></span>
                            <span className="font-mono shrink-0">{currencySymbol} {Number(si.amount).toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500">No separate “Admission & Registration” category lines — term lines are listed below.</p>
                    )}

                    {/* Waiver */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2 mb-2">
                        <Checkbox
                          id="waive-admission"
                          checked={formData.is_waived}
                          onCheckedChange={(checked) => {
                            updateForm("is_waived", checked);
                            if (!checked) {
                              updateForm("waiver_amount", 0);
                              updateForm("waiver_reason", "");
                            }
                          }}
                        />
                        <Label htmlFor="waive-admission">Waive / discount admission fees</Label>
                      </div>

                      {formData.is_waived && (
                        <div className="grid md:grid-cols-2 gap-4 pl-6">
                          <div>
                            <Label>Amount ({currencySymbol})</Label>
                            <Input
                              type="number"
                              value={formData.waiver_amount || ""}
                              onChange={(e) => updateForm("waiver_amount", Number(e.target.value) || 0)}
                              min={0}
                              max={totalAdmissionAmount}
                            />
                          </div>
                          <div>
                            <Label>Reason *</Label>
                            <Input
                              value={formData.waiver_reason || ""}
                              onChange={(e) => updateForm("waiver_reason", e.target.value)}
                              placeholder="e.g. Staff child"
                            />
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex justify-between font-bold">
                        <span>Net Admission:</span>
                        <span>{currencySymbol} {netAdmission.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Other mandatory */}
                  <div className="mt-4 space-y-2">
                    <p className="font-medium">Term school fees (required lines)</p>
                    {mandatoryItems.filter((si: any) => {
                      const cat = (si.category_name || si.item_details?.category_name || "").trim();
                      return cat !== ADMISSION_CATEGORY_NAME;
                    }).length === 0 && allItems.length === 0 ? (
                      <p className="text-sm text-amber-700">
                        No line items on this structure. Open Finance → Fee structures, edit this term, and re-save lines.
                      </p>
                    ) : (
                      <ul className="space-y-1.5 text-sm border rounded-lg bg-white p-3">
                        {(mandatoryItems.filter((si: any) => {
                          const cat = (si.category_name || si.item_details?.category_name || "").trim();
                          return cat !== ADMISSION_CATEGORY_NAME;
                        }).length
                          ? mandatoryItems.filter((si: any) => {
                              const cat = (si.category_name || si.item_details?.category_name || "").trim();
                              return cat !== ADMISSION_CATEGORY_NAME;
                            })
                          : allItems
                        ).map((si: any) => (
                          <li key={si.id || lineLabel(si)} className="flex justify-between gap-2">
                            <span>
                              {lineLabel(si)}
                              <span className="text-slate-400"> · {lineCat(si)}</span>
                            </span>
                            <span className="font-mono shrink-0">
                              {currencySymbol} {Number(si.amount || 0).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-lg font-bold mt-1">
                      Subtotal {currencySymbol}{" "}
                      {(otherMandatoryAmount || allItems.reduce((s: number, si: any) => s + Number(si.amount || 0), 0)).toLocaleString()}
                    </p>
                  </div>
                </section>

                {/* Optional Services */}
                {/* 2. Optional Services – FIXED */}
                <section className="space-y-3">
                  <Label className="text-sm font-bold flex items-center gap-2 text-primary-600">
                    <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">2</span>
                    Add Optional Services
                  </Label>

                  {optionalItemsInStructure.length > 0 ? (
                    <div className="space-y-2">
                      {optionalItemsInStructure.map((si: any) => {
                        const itemId = String(si.item?.id || si.item); // FeeItem ID
                        const itemDetails = si.item_details || {};
                        const isChecked = selectedOptionalIds.includes(itemId);
                        const amount = Number(si.amount || 0);

                        return (
                          <div
                            key={itemId}
                            className={cn(
                              "flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all",
                              isChecked
                                ? "bg-primary-50 border-primary-300 ring-1 ring-primary-200"
                                : "bg-white border-slate-200 hover:border-primary-300"
                            )}
                            onClick={() => {
                              let nextIds: string[];
                              if (isChecked) {
                                nextIds = selectedOptionalIds.filter(id => id !== itemId);
                              } else {
                                nextIds = [...selectedOptionalIds, itemId];
                              }
                              updateForm("selected_optional_items", nextIds);
                            }}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => { }} // controlled by parent div click
                                className="pointer-events-none"
                              />
                              <div>
                                <p className="font-medium text-slate-800">
                                  {lineLabel(si) || itemDetails.name || "Optional service"}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {itemDetails.category_name || "Miscellaneous"}
                                </p>
                              </div>
                            </div>
                            <div className="text-right min-w-[100px]">
                              <span className={cn(
                                "font-mono font-bold text-sm",
                                isChecked ? "text-primary-600" : "text-slate-500"
                              )}>
                                + {amount.toLocaleString()} {currencySymbol}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 border-2 border-dashed rounded-xl bg-slate-50/50">
                      <p className="text-sm text-slate-400 italic">
                        No optional items available for this fee structure
                      </p>
                    </div>
                  )}

                  {/* Quick summary of selected optional total */}
                  {optionalTotal > 0 && (
                    <div className="text-right text-sm font-medium text-primary-700 pt-2">
                      Selected optional total: +{optionalTotal.toLocaleString()} {currencySymbol}
                    </div>
                  )}
                </section>



                {/* Payment Plan */}
                <section className="space-y-4">
                  <Label className="text-sm font-bold">Payment Plan</Label>
                  {paymentPlans.length === 0 ? (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3">
                      No payment plans for this school yet. Re-open this step or create plans under Finance.
                      Enrollment can continue with full payment once defaults seed.
                    </p>
                  ) : null}
                  <Select
                    value={formData.payment_plan || undefined}
                    onValueChange={(val) => updateForm("payment_plan", val)}
                    disabled={paymentPlans.length === 0}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder={paymentPlans.length ? "Select payment plan" : "No plans available"} />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentPlans
                        .filter((plan) => plan.is_active !== false)
                        .map((plan) => (
                          <SelectItem key={plan.id} value={String(plan.id)}>
                            {plan.name} {plan.is_recommended ? "· Recommended" : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  {selectedPlan && selectedPlan.plan_type === "custom" ? (
                    <p className="text-xs text-muted-foreground">
                      This custom/partial plan keeps the remaining balance as one follow-up payment.
                    </p>
                  ) : selectedPlan ? (
                    <p className="text-xs text-muted-foreground">
                      Balance will be divided into {selectedPlan.number_of_installments} installments
                      {selectedPlan.plan_type === "weekly" && " (weekly)"}
                    </p>
                  ) : null}

                  {selectedPlan?.plan_type === "custom" && (
                    <div className="mt-4">
                      <Label>Agreed follow-up payment date</Label>
                      <Input
                        type="date"
                        value={formData.remaining_payment_due_date}
                        onChange={(e) => updateForm("remaining_payment_due_date", e.target.value)}
                        min={today}
                      />
                    </div>
                  )}
                </section>

                {/* PAYMENT SCHEDULE */}
                {paymentBreakdown.installments.length > 0 ? (
                  <div className="mt-8 p-6 border-2 border-slate-200 rounded-2xl bg-white">
                    <h4 className="font-semibold text-xl mb-6">
                      📅 Payment Schedule — {selectedPlan ? selectedPlan.name : "Custom Plan"}
                    </h4>

                    <div className="space-y-3">
                      {/* Initial Payment */}
                      <div className="grid grid-cols-3 gap-4 bg-secondary-50 p-4 rounded-xl">
                        <div className="font-medium">Initial Payment</div>
                        <div className="text-right font-bold text-secondary-700">
                          {currencySymbol} {paymentBreakdown.initialPayment.toLocaleString()}
                        </div>
                        <div className="text-right">Today</div>
                      </div>

                      {/* Installments */}
                      {paymentBreakdown.installments.map((inst, index) => (
                        <div key={index} className="grid grid-cols-3 gap-4 p-4 border rounded-xl">
                          <div className="font-medium">Installment {index + 1}</div>
                          <div className="text-right font-semibold">
                            {currencySymbol} {inst.amount.toLocaleString()}
                          </div>
                          <div className="text-right text-slate-600">{inst.dueDate}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 pt-4 border-t flex justify-between font-bold text-lg">
                      <span>Total Amount Due</span>
                      <span>{currencySymbol} {paymentBreakdown.total.toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 p-6 border border-dashed border-slate-300 rounded-2xl text-center text-slate-500">
                    Select a payment plan and enter initial payment to see detailed installment schedule
                  </div>
                )}


                {/* Initial Payment / Deposit - IMPROVED */}
                <section className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-bold">Initial Payment / Deposit</Label>

                  {/* Admission Fee Warning */}
                  {totalAdmissionAmount > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                      <div className="font-medium text-amber-800 mb-1">
                        Admission & Registration Fee: {currencySymbol} {totalAdmissionAmount.toLocaleString()}
                      </div>
                      {formData.is_waived ? (
                        <p className="text-amber-700">
                          Waiver applied: {currencySymbol} {Number(formData.waiver_amount || 0).toLocaleString()}
                          ({formData.waiver_reason || "No reason provided"})
                        </p>
                      ) : (
                        <p className="text-amber-700">
                          Please pay at least part of the admission fee to proceed with enrollment.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label>Amount Paid ({currencySymbol}) *</Label>
                      <Input
                        type="number"
                        value={formData.initial_payment_amount || ""}
                        onChange={(e) => updateForm("initial_payment_amount", Number(e.target.value) || 0)}
                        placeholder="e.g. 5000"
                      />
                    </div>
                    <div>
                      <Label>Reference Code</Label>
                      <Input
                        value={formData.initial_payment_reference}
                        onChange={(e) => updateForm("initial_payment_reference", e.target.value)}
                        placeholder="MPESA code or bank ref"
                      />
                    </div>
                    <div>
                      <Label>Proof of Payment (optional)</Label>
                      <Input
                        type="file"
                        onChange={(e) => updateForm("initial_payment_proof", e.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>

                  {allocationItems.length > 0 && (
                    <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold">Allocate Deposit to Fee Items</p>
                          <p className="text-xs text-slate-500">
                            Adjust how the paid deposit is assigned across the selected fee items.
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <div>Allocated total</div>
                          <div className="font-semibold">{currencySymbol} {allocatedDepositTotal.toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        {allocationItems.map((item) => (
                          <div key={item.itemId} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-3 items-end">
                            <div>
                              <p className="text-sm font-medium">{item.name}</p>
                              <p className="text-xs text-slate-500">{item.category}</p>
                            </div>
                            <div>
                              <Label className="text-xs">Item Cost</Label>
                              <div className="mt-1 text-sm font-semibold">{currencySymbol} {item.cost.toLocaleString()}</div>
                            </div>
                            <div>
                              <Label className="text-xs">Deposit Allocated</Label>
                              <Input
                                type="number"
                                min={0}
                                max={item.cost}
                                value={item.allocated || ""}
                                onChange={(e) => {
                                  const nextAmount = Number(e.target.value) || 0;
                                  updateForm("item_amounts", {
                                    ...formData.item_amounts,
                                    [item.itemId]: Math.max(0, Math.min(nextAmount, item.cost)),
                                  });
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {allocatedDepositTotal !== Number(formData.initial_payment_amount || 0) && (
                        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                          The deposit amount shown above is based on the item allocations. If you adjust item allocations, the enrollment payment amount will be submitted as {currencySymbol} {allocatedDepositTotal.toLocaleString()}.
                        </div>
                      )}

                      {!isItemAllocationValid() && (
                        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                          The total deposit allocated to items must equal the entered amount paid before you can complete enrollment.
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {/* Summary */}
                <section className="space-y-6 pt-6 border-t">
                  <h4 className="text-lg font-semibold">Final Summary</h4>
                  <div className="bg-slate-50 p-5 rounded-xl border space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Mandatory Fees (excl. admission)</span>
                        <span>{currencySymbol} {otherMandatoryAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Admission & Registration (net)</span>
                        <span>{currencySymbol} {netAdmission.toLocaleString()}</span>
                      </div>
                      {optionalTotal > 0 && (
                        <div className="flex justify-between text-primary-700">
                          <span>Optional Services</span>
                          <span>+ {currencySymbol} {optionalTotal.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg border-t pt-2">
                        <span>Total Due Now</span>
                        <span className="text-primary-700">{currencySymbol} {totalDueNow.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Initial Payment</span>
                        <span>{currencySymbol} {depositPaid.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-2">
                        <span>Balance to Invoice</span>
                        <span>{currencySymbol} {balanceDue.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Transport hint */}
                    {suggestTransport && transportItem && !selectedOptionalIds.includes(String(transportItem.id)) && (
                      <p className="text-amber-700 text-sm bg-amber-50 p-3 rounded">
                        School bus selected → consider adding <strong>{transportItem.name}</strong>
                      </p>
                    )}
                  </div>


                  {/* Confirmations - CRITICAL FIX */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="terms"
                        checked={formData.terms_accepted === true}   // strict boolean
                        onCheckedChange={(checked) => {
                          console.log("Terms checkbox changed to:", checked); // ← temporary debug
                          updateForm("terms_accepted", checked === true);
                        }}
                      />
                      <Label htmlFor="terms" className="text-sm leading-tight cursor-pointer select-none">
                        I confirm the guardian has read and accepted the school rules, policies and fee structure.
                      </Label>
                    </div>

                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="summary-confirm"
                        checked={formData.summary_confirmed === true}   // strict boolean
                        onCheckedChange={(checked) => {
                          console.log("Summary confirm checkbox changed to:", checked); // ← temporary debug
                          updateForm("summary_confirmed", checked === true);
                        }}
                      />
                      <Label htmlFor="summary-confirm" className="text-sm leading-tight cursor-pointer select-none">
                        I have carefully reviewed all the above details and confirm they are correct.
                      </Label>
                    </div>
                  </div>
                </section>
              </div>

              {/* RIGHT COLUMN – Invoice Preview */}
              <div className="lg:col-span-2">
                <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-2xl sticky top-0">
                  <h4 className="text-sm font-black uppercase tracking-wider text-primary-400 mb-4">
                    Enrollment Cost Summary
                  </h4>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm text-slate-400">
                      <span>Mandatory Fees</span>
                      <span>{currencySymbol} {(otherMandatoryAmount + netAdmission).toLocaleString()}</span>
                    </div>

                    {optionalTotal > 0 && (
                      <div className="flex justify-between text-sm text-primary-300">
                        <span>Optional Services</span>
                        <span>+{currencySymbol} {optionalTotal.toLocaleString()}</span>
                      </div>
                    )}

                    <div className="flex justify-between font-semibold border-t border-slate-700 pt-3">
                      <span>Total Term Bill</span>
                      <span>{currencySymbol} {totalDueNow.toLocaleString()}</span>
                    </div>

                    {/* This is the missing link that makes the math work */}
                    <div className="flex justify-between text-secondary-400 text-sm">
                      <span>Initial Deposit</span>
                      <span>- {currencySymbol} {depositPaid.toLocaleString()}</span>
                    </div>

                    <Separator className="bg-slate-700" />

                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-xs text-slate-400 uppercase font-bold">Due Today</p>
                        <p className="text-2xl font-bold text-white">
                          {currencySymbol} {depositPaid.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400 uppercase font-bold">Remaining</p>
                        <p className="text-lg font-semibold text-primary-400">
                          {currencySymbol} {balanceDue.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 mt-4">
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        The remaining <span className="text-white font-bold">{currencySymbol} {balanceDue.toLocaleString()}</span> will
                        {selectedPlan?.plan_type === "custom" ? (
                          <> be due once on <span className="text-white font-bold">{formData.remaining_payment_due_date}</span>.</>
                        ) : (
                          <> be split into <span className="text-white font-bold">{selectedPlan?.number_of_installments || 1} installments</span> as per the {selectedPlan?.name || "selected"} plan.</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 rounded-2xl">
        <DialogHeader>
          <DialogTitle>Complete Student Enrollment</DialogTitle>
          <DialogDescription>
            For {formData.first_name} {formData.last_name}. Step {currentStep} of {totalSteps}
          </DialogDescription>
        </DialogHeader>

        <div className="my-6">
          <div className="flex justify-between text-sm font-medium mb-2">
            <span>Step {currentStep} of {totalSteps}</span>
            <span className="text-muted-foreground">
              {["Identification", "Previous School", "Class & Transport", "Health & Special Needs", "Guardians", "Fees & Review"][currentStep - 1]}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-primary h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* each step gets its own key so that React will unmount
            the previous step's inputs (avoids mixing controlled/uncontrolled)
            when switching pages */}
        <div className="py-4 min-h-[400px]" key={currentStep}>
          {renderStep()}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row justify-between gap-4 pt-6 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>

          <div className="flex flex-col sm:flex-row gap-3">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handlePrev}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
            )}

            {currentStep < totalSteps ? (
              <Button onClick={handleNext} disabled={!validateStep(currentStep) || loading}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
              {!validateStep(6) && (
                <p className="text-xs text-amber-700 max-w-xs text-right">
                  To enable Confirm & Enroll: select a fee structure
                  {paymentPlans.length > 0 && !formData.payment_plan ? ", choose a payment plan" : ""}
                  {!formData.terms_accepted ? ", accept terms" : ""}
                  {!formData.summary_confirmed ? ", confirm summary" : ""}
                  {Number(formData.initial_payment_amount || 0) > 0 &&
                  !(String(formData.initial_payment_reference || "").trim().length > 2 || formData.initial_payment_proof)
                    ? ", add payment reference or proof (or set initial payment to 0)"
                    : ""}
                  .
                </p>
              )}
              <Button
                onClick={handleSubmit}
                disabled={loading || !validateStep(currentStep)}
                className="bg-secondary hover:bg-secondary-700 min-w-[180px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enrolling...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirm & Enroll
                  </>
                )}
              </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
