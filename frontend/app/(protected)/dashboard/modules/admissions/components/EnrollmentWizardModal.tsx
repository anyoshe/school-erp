"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  applicationData: Application;
  onEnrolled?: (student: { id: string; full_name: string; admission_number: string }) => void;
}

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
    passport_number: "",

    previous_school: applicationData.previous_school || "",
    previous_grade: "",
    transfer_letter: null,

    current_class: applicationData.class_applied?.id || "",
    section: "",
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
    guardian_national_id: "",
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
    is_waived: false,
    waiver_amount: 0,
    waiver_reason: "",
    selected_optional_items: [],
    sponsor_name: "",
    initial_payment_proof: null,
    payment_plan: "",
    notes: "",
  }));

  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);
  // 1. Add this to your State/useEffect at the top of the component
  const [optionalItems, setOptionalItems] = useState<any[]>([]);
  const [paymentPlans, setPaymentPlans] = useState<any[]>([]);
  const { currentSchool } = useCurrentSchool();
  const currencySymbol = currentSchool?.currency_symbol || "Ksh";
  useEffect(() => {
    // Use optional chaining to prevent crash if class_applied is null
    const classId = applicationData?.class_applied?.id;

    if (!open || !classId) return;

    const loadFinanceData = async () => {
      setFeeLoading(true);
      try {
        const [structures, items, plans] = await Promise.all([
          api.get("/finance/structures/", { params: { grade_level: classId } }),
          api.get("/finance/items/", { params: { grade_level: classId, is_optional: true } }),
          api.get("/finance/payment-plans/")
        ]);

        setFeeStructures(structures.data || []);
        setOptionalItems(items.data || []);
        setPaymentPlans(plans.data || []);

        // Auto-select structure if only one exists
        if (structures.data?.length === 1) {
          updateForm("fee_structure_id", String(structures.data[0].id));
        }
      } catch (err) {
        toast.error("Failed to load financial data");
      } finally {
        setFeeLoading(false);
      }
    };

    loadFinanceData();
  }, [open, applicationData.class_applied?.id]);
  const updateForm = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number) => {
    switch (step) {
      case 1:
        return (
          formData.first_name &&
          formData.last_name &&
          formData.date_of_birth &&
          formData.gender &&
          (formData.birth_certificate_number || formData.passport_number)
        );
      case 2:
        return true;
      case 3:
        return formData.current_class && formData.section;
      case 4:
        return formData.vaccination_status;
      case 5:
        return formData.guardian_name && formData.guardian_phone && formData.guardian_national_id;
      case 6:
        return !!formData.fee_structure_id && !!formData.payment_plan;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    } else {
      toast.error("Please complete all required fields.");
    }
  };

  const handlePrev = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = new FormData();

      Object.entries(formData).forEach(([key, value]) => {
        if (key === "selected_optional_items" && Array.isArray(value)) {
          // Correctly handle the array for ManyToMany fields
          value.forEach(id => payload.append("selected_optional_items", id));
        } else if (value !== null && typeof value !== "object") {
          // Numeric safety for the waiver
          if (key === "waiver_amount") {
            payload.append(key, String(value || 0));
          } else {
            payload.append(key, String(value));
          }
        }
      });

      // Map your frontend IDs to the specific backend field names
      payload.set("fee_structure", String(formData.fee_structure_id));
      payload.set("payment_plan", String(formData.payment_plan));

      const res = await api.post(`/admissions/applications/${applicationId}/enroll/`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Student enrolled successfully!");
      onEnrolled?.(res.data);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Enrollment failed");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // reuse of the file input node from the previous step.
  const ClassLogisticsStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Class & Daily Logistics</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Class *</Label>
          <Input value={applicationData.class_applied?.name ?? ""} disabled />
        </div>

        <div>
          <Label>Section *</Label>
          <Input
            value={String(formData.section)}
            onChange={(e) => updateForm("section", e.target.value)}
            placeholder="A, B, C..."
          />
        </div>

        <div>
          <Label>House / Dorm</Label>
          <Input
            value={String(formData.house)}
            onChange={(e) => updateForm("house", e.target.value)}
            placeholder="e.g. Red House"
          />
        </div>

        <div>
          <Label>Boarding Status *</Label>
          <Select
            value={formData.boarding_status}
            onValueChange={(val) => updateForm("boarding_status", val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAY">Day Scholar</SelectItem>
              <SelectItem value="BOARDING">Boarding</SelectItem>
              <SelectItem value="MIXED">Mixed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.boarding_status === "BOARDING" && (
          <div>
            <Label>Dorm Room</Label>
            <Input
              value={String(formData.dorm_room)}
              onChange={(e) => updateForm("dorm_room", e.target.value)}
              placeholder="Room 101"
            />
          </div>
        )}

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
              value={String(formData.transport_route)}
              onChange={(e) => updateForm("transport_route", e.target.value)}
              placeholder="e.g. Route 3 - Westlands Stop"
            />
          </div>
        )}
      </div>
    </div>
  );

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
                { label: "Learner ID / UPI *", key: "learner_id", disabled: true },
                { label: "Birth Certificate Number *", key: "birth_certificate_number" },
                { label: "Passport Number (non-Kenyan)", key: "passport_number" },
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
        return <ClassLogisticsStep />;

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
                      onChange={(e) => updateForm("guardian_national_id", e.target.value)}
                      placeholder="ID/Passport number"
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
        // 1. Identify the selected structure
        const selectedStructure = feeStructures.find(
          (fs) => String(fs.id) === String(formData.fee_structure_id)
        );

        // 2. Derive mandatory vs optional amounts
        // We calculate mandatory by filtering out items flagged as optional in the structure
        const mandatoryAmount = selectedStructure?.structure_items?.reduce((sum: number, si: any) => {
          const isOptional = selectedStructure.available_optional_items?.includes(si.item);
          return isOptional ? sum : sum + Number(si.amount);
        }, 0) || 0;

        const availableOptions = selectedStructure?.available_optional_items_details || [];
        const selectedOptionalIds = formData.selected_optional_items || [];

        // 3. Calculate live total for checked optional items
        const optionalTotal = availableOptions
          .filter((item: any) => selectedOptionalIds.includes(item.id))
          .reduce((sum: number, item: any) => {
            // Find the specific amount for this item as defined in THIS structure
            const structureItem = selectedStructure.structure_items.find((si: any) => si.item === item.id);
            return sum + Number(structureItem?.amount || 0);
          }, 0);

        const finalTotal = mandatoryAmount + optionalTotal - Number(formData.waiver_amount || 0);

        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Left Side: Configuration (Col Span 3) */}
              <div className="lg:col-span-3 space-y-6">
                <section className="space-y-3">
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</span>
                    Select Fee Structure
                  </Label>
                  <Select
                    value={formData.fee_structure_id}
                    onValueChange={(val) => {
                      updateForm("fee_structure_id", val);
                      updateForm("selected_optional_items", []); // Reset to prevent price errors
                    }}
                  >
                    <SelectTrigger className="h-12 border-slate-200">
                      <SelectValue placeholder="Choose structure..." />
                    </SelectTrigger>
                    <SelectContent>
                      {feeStructures.map((fs) => (
                        <SelectItem key={fs.id} value={String(fs.id)}>
                          {fs.name} — {fs.period_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </section>

                <section className="space-y-3">
                  <Label className="text-sm font-bold flex items-center gap-2 text-indigo-600">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
                    Add Optional Services
                  </Label>
                  <div className="grid grid-cols-1 gap-2">
                    {availableOptions.length > 0 ? (
                      availableOptions.map((item: any) => {
                        const itemAmount = selectedStructure.structure_items.find((si: any) => si.item === item.id)?.amount;
                        const isChecked = selectedOptionalIds.includes(item.id);

                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer",
                              isChecked ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200" : "bg-white border-slate-100 hover:border-slate-300"
                            )}
                            onClick={() => {
                              const next = isChecked
                                ? selectedOptionalIds.filter((id: string) => id !== item.id)
                                : [...selectedOptionalIds, item.id];
                              updateForm("selected_optional_items", next);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox checked={isChecked} onCheckedChange={() => { }} />
                              <div>
                                <p className="text-sm font-bold text-slate-700">{item.name}</p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-tight">{item.category_name}</p>
                              </div>
                            </div>
                            <span className={cn(
                              "font-mono font-bold text-sm",
                              isChecked ? "text-indigo-600" : "text-slate-400"
                            )}>
                              + {Number(itemAmount).toLocaleString()}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 border-2 border-dashed rounded-xl bg-slate-50/50">
                        <p className="text-xs text-slate-400 italic">No optional items for this structure.</p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="space-y-3">
                  <Label className="text-sm font-bold">Payment Plan</Label>
                  <Select value={formData.payment_plan} onValueChange={(val) => updateForm("payment_plan", val)}>
                    <SelectTrigger className="border-slate-200"><SelectValue placeholder="Select Plan" /></SelectTrigger>
                    <SelectContent>
                      {paymentPlans.map((plan) => (
                        <SelectItem key={plan.id} value={String(plan.id)}>{plan.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </section>
              </div>

              {/* Right Side: Live Invoice Card (Col Span 2) */}
              <div className="lg:col-span-2">
                <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-2xl sticky top-0 border border-slate-800">
                  <div className="flex items-center justify-between mb-8">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Invoice Preview</h4>
                    <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-slate-300">Draft</span>
                  </div>

                  <div className="space-y-5">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-400 uppercase">Mandatory Base</p>
                        <p className="text-xs text-slate-500 italic max-w-[120px]">{selectedStructure?.name}</p>
                      </div>
                      <span className="font-mono text-lg">{mandatoryAmount.toLocaleString()}</span>
                    </div>

                    {selectedOptionalIds.length > 0 && (
                      <div className="space-y-3 animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-center text-indigo-400">
                          <p className="text-xs font-bold uppercase tracking-widest">Optional Extras ({selectedOptionalIds.length})</p>
                          <span className="font-mono">+{optionalTotal.toLocaleString()}</span>
                        </div>
                        <div className="space-y-1 pl-2 border-l border-indigo-500/30">
                          {availableOptions.filter((o: any) => selectedOptionalIds.includes(o.id)).map((o: any) => (
                            <div key={o.id} className="flex justify-between text-[10px] text-slate-400 italic">
                              <span>{o.name}</span>
                              <span>{Number(selectedStructure.structure_items.find((si: any) => si.item === o.id)?.amount).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator className="bg-slate-800" />

                    <div className="flex justify-between items-center pt-2">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-white">Total Amount Due</p>
                        <p className="text-[9px] text-slate-500 uppercase">{currencySymbol} / {selectedStructure?.period_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black text-indigo-400 tracking-tighter">
                          {finalTotal.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-indigo-300 font-medium">
                      This will generate an invoice for <br />
                      <span className="text-white font-bold">{formData.first_name} {formData.last_name}</span>
                    </p>
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
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
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
              <Button
                onClick={handleSubmit}
                disabled={loading || !validateStep(currentStep)}
                className="bg-green-600 hover:bg-green-700 min-w-[180px]"
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
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}