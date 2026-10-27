"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
import { Application, classAppliedId, classAppliedName } from "@/types/admission";
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
  gradeLabel?: string;
}

// ─────────────────────────────────────────────────────────────
// Improved ClassLogisticsStep with clear Primary vs Secondary logic
// ─────────────────────────────────────────────────────────────
const ClassLogisticsStep = ({
  formData,
  applicationData,
  updateForm,
  schoolHierarchy,
  gradeLabel,
}: ClassLogisticsStepProps) => (
  <div className="space-y-6">
    <h3 className="text-lg font-semibold">Class & Placement Logistics</h3>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Class / Grade - Always required */}
      <div>
        <Label>Class / Grade *</Label>
        <Input
          value={
            gradeLabel ||
            classAppliedName(applicationData) ||
            "—"
          }
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
  const [gradeLabel, setGradeLabel] = useState(() => {
    const n = classAppliedName(applicationData);
    // Prefer real names; bare numeric ids are resolved below
    return n && !/^\d+$/.test(n.trim()) ? n : "";
  });

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

  // Resolve grade name when API only sent an id (e.g. 212)
  useEffect(() => {
    if (!open) return;
    const id = classAppliedId(applicationData);
    const existing = classAppliedName(applicationData);
    if (existing && !/^\d+$/.test(String(existing).trim())) {
      setGradeLabel(existing);
      return;
    }
    if (!id) {
      setGradeLabel(existing || "");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/academics/grade-levels/", {
          timeout: 15000,
          headers: currentSchool?.id
            ? { "X-School-ID": String(currentSchool.id) }
            : undefined,
        });
        const list = Array.isArray(res.data)
          ? res.data
          : res.data?.results || res.data?.data || [];
        const g = list.find((x: any) => String(x.id) === String(id));
        if (!cancelled) {
          setGradeLabel(g?.name ? String(g.name) : existing || String(id));
        }
      } catch {
        if (!cancelled) setGradeLabel(existing || String(id));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, applicationData, currentSchool?.id]);

  // When wizard opens, re-sync grade label, key admission fields, and edit baseline
  useEffect(() => {
    if (!open || !applicationData) return;
    const name =
      classAppliedName(applicationData) ||
      (applicationData as any).class_applied_name ||
      "";
    if (name && !/^\d+$/.test(String(name).trim())) {
      setGradeLabel(String(name));
    }
    setFormData((prev) => {
      const next = {
        ...prev,
        current_class: classAppliedId(applicationData) || prev.current_class,
        guardian_name:
          prev.guardian_name ||
          applicationData.primary_guardian_name ||
          "",
        guardian_phone:
          prev.guardian_phone ||
          applicationData.primary_guardian_phone ||
          "",
        guardian_email:
          prev.guardian_email ||
          applicationData.primary_guardian_email ||
          "",
        guardian_relationship:
          prev.guardian_relationship ||
          applicationData.primary_guardian_relationship ||
          "Parent",
        guardian_national_id:
          prev.guardian_national_id ||
          (applicationData as any).primary_guardian_id_number ||
          "",
        secondary_guardian_name:
          prev.secondary_guardian_name ||
          (applicationData as any).secondary_guardian_name ||
          "",
        secondary_guardian_phone:
          prev.secondary_guardian_phone ||
          (applicationData as any).secondary_guardian_phone ||
          "",
        secondary_guardian_email:
          prev.secondary_guardian_email ||
          (applicationData as any).secondary_guardian_email ||
          "",
        secondary_guardian_national_id:
          prev.secondary_guardian_national_id ||
          (applicationData as any).secondary_guardian_id_number ||
          "",
      };
      // baseline after sync
      setTimeout(() => snapshotBaseline(next), 0);
      return next;
    });
    setCurrentStep(1);
  }, [open, applicationData?.id]);


  
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

    birth_certificate_number: (applicationData as any).birth_certificate_number || "",
    admission_number: "",
    auto_generate_admission: true,
    profile_photo: null as File | null,
    birth_certificate_file: null as File | null,
    passport_number: "",

    previous_school: applicationData.previous_school || "",
    previous_grade: "",
    transfer_letter: null,

    current_class: classAppliedId(applicationData),
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
    guardian_national_id: (applicationData as any).primary_guardian_id_number || (applicationData as any).guardian_national_id || "",
    guardian_relation: applicationData.primary_guardian_relationship || "Parent",
    secondary_guardian_name: (applicationData as any).secondary_guardian_name || "",
    secondary_guardian_phone: (applicationData as any).secondary_guardian_phone || "",
    secondary_guardian_email: (applicationData as any).secondary_guardian_email || "",
    secondary_guardian_national_id: (applicationData as any).secondary_guardian_id_number || "",
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
    enrollment_term: "",
    enrollment_academic_year: "",
    terms_accepted: false,
    summary_confirmed: false,
  }));

  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [applicationCharges, setApplicationCharges] = useState<any[]>([]);
  const [chargesLoading, setChargesLoading] = useState(false);

  // 1. Add this to your State/useEffect at the top of the component
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
    if (!open) return;

    const asList = (data: any): any[] => {
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.results)) return data.results;
      if (Array.isArray(data?.data)) return data.data;
      return [];
    };

    const loadPaymentPlans = async () => {
      try {
        const plansRes = await api.get("/finance/payment-plans/", { timeout: 15000 });
        const plans = asList(plansRes.data);
        setPaymentPlans(plans);

        if (plans.length > 0) {
          setFormData((prev) => {
            if (prev.payment_plan) return prev;
            const rec = plans.find((p: any) => p.is_recommended) || plans[0];
            return { ...prev, payment_plan: String(rec.id) };
          });
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load payment plans from Finance");
      }
    };

    loadPaymentPlans();
  }, [open]);

  // Ensure interview/admission charges exist (N/A by default if school amounts are 0)
  useEffect(() => {
    if (!open || !applicationId) return;
    let cancelled = false;
    (async () => {
      setChargesLoading(true);
      try {
        const res = await api.post(`/admissions/applications/${applicationId}/ensure-charges/`, {}, { headers: currentSchool?.id ? { 'X-School-ID': String(currentSchool.id) } : undefined });
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

  // Identity fields from admission — confirm once on Next if any were edited
  const PROTECTED_IDENTITY_FIELDS = new Set([
    "first_name",
    "middle_name",
    "last_name",
    "gender",
    "date_of_birth",
    "nationality",
    "birth_certificate_number",
    "passport_number",
    "guardian_name",
    "guardian_phone",
    "guardian_email",
    "guardian_national_id",
    "guardian_relationship",
  ]);

  const FIELD_HUMAN: Record<string, string> = {
    first_name: "First name",
    middle_name: "Middle name",
    last_name: "Last name",
    gender: "Gender",
    date_of_birth: "Date of birth",
    nationality: "Nationality",
    birth_certificate_number: "Birth certificate number",
    passport_number: "Passport number",
    guardian_name: "Guardian name",
    guardian_phone: "Guardian phone",
    guardian_email: "Guardian email",
    guardian_national_id: "Guardian ID",
    guardian_relationship: "Guardian relationship",
  };

  const baselineRef = useRef<Record<string, string>>({});

  const snapshotBaseline = (data: Record<string, any>) => {
    const snap: Record<string, string> = {};
    PROTECTED_IDENTITY_FIELDS.forEach((k) => {
      snap[k] = String(data[k] ?? "").trim();
    });
    baselineRef.current = snap;
  };

  const updateForm = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const confirmProtectedEditsIfNeeded = (): boolean => {
    const changed: string[] = [];
    PROTECTED_IDENTITY_FIELDS.forEach((k) => {
      const base = baselineRef.current[k] ?? "";
      const cur = String(formData[k] ?? "").trim();
      if (base !== cur) {
        changed.push(FIELD_HUMAN[k] || k);
      }
    });
    if (!changed.length) return true;
    return window.confirm(
      `You changed these fields loaded from the admission application:\n\n• ${changed.join(
        "\n• "
      )}\n\nContinue to the next step?`
    );
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
      case 1: {
        // identity step

        const hasPhoto = !!formData.profile_photo || !!applicationData.photo;
        return (
          formData.first_name &&
          formData.last_name &&
          formData.date_of_birth &&
          formData.gender &&
          formData.nationality &&
          (formData.birth_certificate_number || formData.passport_number) &&
          hasPhoto &&
          formData.birth_certificate_file
        );
      }
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
        const termOk = Boolean(String(formData.enrollment_term || "").trim());
        const yearOk = Boolean(String(formData.enrollment_academic_year || "").trim());
        const isValid =
          termOk &&
          yearOk &&
          formData.terms_accepted === true;
        return isValid;
      }
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (!confirmProtectedEditsIfNeeded()) return;
      // Accept current values as new baseline after confirming
      snapshotBaseline(formData);
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    } else {
      if (currentStep === 6) {
        if (!String(formData.enrollment_term || "").trim()) {
          toast.error("Select the term the student is enrolling into.");
        } else if (!String(formData.enrollment_academic_year || "").trim()) {
          toast.error("Select the academic year.");
        } else if (!formData.terms_accepted) {
          toast.error("Accept the terms to enroll.");
        } else {
          toast.error("Complete the enrollment checklist.");
        }
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
      payload.set("initial_payment_amount", "0");
      payload.set("enrollment_term", String(formData.enrollment_term || ""));
      payload.set("enrollment_academic_year", String(formData.enrollment_academic_year || ""));

      if (formData.payment_plan) {
        payload.set("payment_plan", String(formData.payment_plan));   // This is important
      }

      const allocationTotal = getItemAmountTotal(formData.item_amounts || {});
      if (allocationTotal > 0) {
        payload.set("initial_payment_amount", "0"); // school fees collected in Finance clearance
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
                { label: "First Name *", key: "first_name" },
                { label: "Middle Name", key: "middle_name" },
                { label: "Last Name *", key: "last_name" },
                { label: "Preferred Name", key: "preferred_name" },
                { label: "Gender *", key: "gender" },
                { label: "Date of Birth *", key: "date_of_birth", type: "date" },
                { label: "Nationality *", key: "nationality" },
                { label: "Learner ID / UPI", key: "learner_id" },
                { label: "Birth Certificate Number *", key: "birth_certificate_number" },
                { label: "Passport Number (non-Citizen)", key: "passport_number" },
              ].map(({ label, key, type = "text" }) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input
                    type={type}
                    value={(formData[key] ?? "") as string}
                    onChange={(e) => updateForm(key, e.target.value)}
                    placeholder={`Enter ${label.toLowerCase().replace("*", "").trim()}`}
                    className={
                      PROTECTED_IDENTITY_FIELDS.has(key)
                        ? "border-amber-200 bg-amber-50/30"
                        : undefined
                    }
                  />
                  {PROTECTED_IDENTITY_FIELDS.has(key) && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      From admission — you can edit; confirmation is asked when you click Next
                    </p>
                  )}
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
                    <Input
                      value={formData.guardian_name ?? ""}
                      onChange={(e) => updateForm("guardian_name", e.target.value)}
                      className="border-amber-200 bg-amber-50/30"
                    />
                  </div>
                  <div>
                    <Label>National ID / Passport *</Label>
                    <Input
                      value={formData.guardian_national_id ?? ""}
                      onChange={(e) => updateForm("guardian_national_id", e.target.value)}
                      className="border-amber-200 bg-amber-50/30"
                    />
                  </div>
                  <div>
                    <Label>Phone *</Label>
                    <Input
                      value={formData.guardian_phone ?? ""}
                      onChange={(e) => updateForm("guardian_phone", e.target.value)}
                      className="border-amber-200 bg-amber-50/30"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={formData.guardian_email ?? ""}
                      onChange={(e) => updateForm("guardian_email", e.target.value)}
                      className="border-amber-200 bg-amber-50/30"
                    />
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
        return (
          <div className="space-y-5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950">
              <p className="font-semibold">Enrollment only — school fees are collected in Finance</p>
              <p className="mt-1 text-emerald-900/90">
                Select the academic year and term. After enroll, the learner gets an admission
                number and appears under <strong>Finance → Awaiting clearance</strong> for fee
                structure and payments.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Academic year *</label>
                <Input
                  className="mt-1"
                  placeholder="e.g. 2026"
                  value={formData.enrollment_academic_year || ""}
                  onChange={(e) => updateForm("enrollment_academic_year", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Enrolling into term *</label>
                <Select
                  value={formData.enrollment_term || "none"}
                  onValueChange={(v) => updateForm("enrollment_term", v === "none" ? "" : v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select term…</SelectItem>
                    <SelectItem value="Term 1">Term 1</SelectItem>
                    <SelectItem value="Term 2">Term 2</SelectItem>
                    <SelectItem value="Term 3">Term 3</SelectItem>
                    <SelectItem value="Semester 1">Semester 1</SelectItem>
                    <SelectItem value="Semester 2">Semester 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-xl border bg-slate-50 p-4 text-sm space-y-2">
              <p className="font-medium">Pre-enrollment fees (interview / admission)</p>
              <p className="text-muted-foreground text-xs">
                These must already be marked paid, waived, or not applicable earlier in the
                pipeline. School term fees are <strong>not</strong> collected here.
              </p>
              {chargesLoading ? (
                <p className="text-xs text-muted-foreground">Loading charge status…</p>
              ) : applicationCharges?.length ? (
                <ul className="divide-y rounded-lg border bg-white">
                  {applicationCharges
                    .filter((c: any) => {
                      if (String(c.charge_type).toUpperCase() === "INTERVIEW") {
                        if (c.policy === "NOT_APPLICABLE") return false;
                        if (Number(c.amount_due || 0) <= 0 && Number(c.amount_paid || 0) <= 0)
                          return false;
                      }
                      return true;
                    })
                    .map((c: any) => (
                    <li key={c.id || c.charge_type} className="flex justify-between px-3 py-2 text-sm">
                      <span>
                        {c.charge_type === "INTERVIEW"
                          ? "Interview fee"
                          : c.charge_type === "ADMISSION"
                            ? "Admission fee"
                            : c.charge_type}
                        {c.policy ? ` · ${c.policy}` : ""}
                      </span>
                      <span className="font-medium">
                        {c.policy === "WAIVED" || c.policy === "NOT_APPLICABLE"
                          ? c.policy
                          : Number(c.amount_paid || 0) > 0
                            ? `Paid ${Number(c.amount_paid).toLocaleString()}`
                            : `Due ${Number(c.amount_due || 0).toLocaleString()}`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No interview/admission charge rows — treat as not applicable if your school
                  does not charge them.
                </p>
              )}
            </div>

            <label className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!formData.terms_accepted}
                onChange={(e) => updateForm("terms_accepted", e.target.checked)}
              />
              <span className="text-sm">
                <span className="font-medium">I confirm this enrollment *</span>
                <span className="block text-muted-foreground mt-0.5">
                  Details are correct. School fees will be handled at the Finance clearance desk.
                </span>
              </span>
            </label>
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

        <DialogFooter className="sticky bottom-0 z-20 flex flex-col sm:flex-row justify-between gap-4 pt-6 pb-2 border-t bg-white">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-300 text-slate-800 bg-white hover:bg-slate-50"
          >
            Cancel
          </Button>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrev}
                className="border-slate-300 text-slate-800 bg-white hover:bg-slate-50 min-w-[120px]"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
            )}

            {currentStep < totalSteps ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!validateStep(currentStep) || loading}
                className="min-w-[140px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 disabled:opacity-60"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
              {!validateStep(6) && (
                <p className="text-xs text-amber-700 max-w-xs text-right">
                  To enable Confirm & Enroll: select the academic year and term
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
                className="min-w-[180px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 disabled:opacity-60"
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
