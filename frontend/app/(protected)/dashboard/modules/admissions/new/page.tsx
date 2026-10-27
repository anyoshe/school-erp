"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import api from "@/utils/api";
import publicApi from "@/utils/publicApi";
import { toast } from "sonner";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import DocumentUpload from "../components/DocumentUpload";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

// ──────────────────────────────
// Form schema
// ──────────────────────────────
const formSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, "Last name is required"),
  preferred_name: z.string().optional(),
  // empty string allowed in form state; validated when filled
  gender: z
    .enum(["MALE", "FEMALE", "OTHER", ""])
    .optional()
    .transform((v) => (v === "" || v == null ? undefined : v)),
  date_of_birth: z.string().optional(),
  nationality: z.string().min(1, "Nationality is required"),
  passport_number: z.string().optional(),
  birth_certificate_number: z.string().optional(),
  class_applied: z.string().min(1, "Class/Grade is required"),
  primary_guardian_name: z.string().min(1, "Guardian name is required"),
  primary_guardian_phone: z.string().min(9, "Valid phone number required"),
  // empty string must NOT fail as "invalid email"
  primary_guardian_email: z
    .string()
    .optional()
    .refine((v) => !v || v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Invalid email",
    }),
  primary_guardian_relationship: z.string().min(1, "Relationship is required"),
  primary_guardian_id_number: z.string().min(1, "Guardian ID / national ID is required"),
  secondary_guardian_name: z.string().optional(),
  secondary_guardian_phone: z.string().optional(),
  secondary_guardian_email: z
    .string()
    .optional()
    .refine((v) => !v || v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Invalid email",
    }),
  secondary_guardian_relationship: z.string().optional(),
  secondary_guardian_id_number: z.string().optional(),

  address: z.string().optional(),
  region: z.string().optional(),
  district: z.string().optional(),
  previous_school: z.string().optional(),
  religion: z.string().optional(),
  category: z.string().optional(),
  placement_type: z.enum(["SELF", "PUBLIC", "TRANSFER", "OTHER"]).optional(),
  blood_group: z.string().optional(),
  allergies: z.string().optional(),
  chronic_conditions: z.string().optional(),
  disability: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_relationship: z.string().optional(),
  notes: z.string().optional(),
  photo: z.any().optional(),
}).refine(
  (data) => {
    const bc = String((data as any).birth_certificate_number || "").trim();
    const pp = String((data as any).passport_number || "").trim();
    return Boolean(bc || pp);
  },
  {
    message: "Birth certificate number or passport number is required",
    path: ["birth_certificate_number"],
  }
);


type FormValues = z.input<typeof formSchema>;

interface GradeLevel {
  id: string;
  name: string;
  short_name?: string;
}

// ──────────────────────────────
// Page component
// ──────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  first_name: "First name",
  last_name: "Last name",
  nationality: "Nationality",
  class_applied: "Class / Grade",
  primary_guardian_name: "Primary guardian name",
  primary_guardian_phone: "Guardian phone",
  primary_guardian_email: "Guardian email",
  primary_guardian_relationship: "Guardian relationship",
  primary_guardian_id_number: "Guardian ID / National ID",
  gender: "Gender",
  date_of_birth: "Date of birth",
  birth_certificate_number: "Birth certificate number",
};

const FIELD_STEP: Record<string, number> = {
  first_name: 0,
  last_name: 0,
  nationality: 0,
  class_applied: 0,
  gender: 0,
  date_of_birth: 0,
  birth_certificate_number: 0,
  preferred_name: 0,
  middle_name: 0,
  primary_guardian_name: 1,
  primary_guardian_phone: 1,
  primary_guardian_email: 1,
  primary_guardian_relationship: 1,
  primary_guardian_id_number: 1,
};

/** Required fields enforced per tab before Next / Submit */
const STEP_REQUIRED: Record<number, (keyof FormValues)[]> = {
  0: ["first_name", "last_name", "nationality", "class_applied", "gender", "date_of_birth"],
  1: ["primary_guardian_name", "primary_guardian_phone", "primary_guardian_relationship", "primary_guardian_id_number"],
  2: [],
};

function fieldErrorClass(hasError: boolean) {
  return hasError
    ? "border-red-500 focus-visible:ring-red-500 bg-red-50/40"
    : "";
}

function NewApplicationPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const queryClient = useQueryClient();
  const { currentSchool, loading: schoolLoading, error: schoolError } = useCurrentSchool();

  const [currentStep, setCurrentStep] = useState(0);
  const [documents, setDocuments] = useState<File[]>([]);
  const [isFinalSubmitted, setIsFinalSubmitted] = useState(false);
  const [savedAppId, setSavedAppId] = useState<string | null>(editId);
  const [loadingDraft, setLoadingDraft] = useState(!!editId);

  const steps = ["Student", "Guardian", "Documents"];

  const {
    control,
    getValues,
    reset,
    setFocus,
    formState: { errors, isValid, isSubmitting },
    trigger,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      first_name: "",
      middle_name: "",
      last_name: "",
      preferred_name: "",
      gender: "",
      date_of_birth: "",
      birth_certificate_number: "",
      nationality: "",
      passport_number: "",
      class_applied: "",
      primary_guardian_name: "",
      primary_guardian_phone: "",
      primary_guardian_email: "",
      primary_guardian_relationship: "",
      primary_guardian_id_number: "",
      secondary_guardian_name: "",
      secondary_guardian_phone: "",
      secondary_guardian_email: "",
      secondary_guardian_relationship: "",
      secondary_guardian_id_number: "",
      address: "",
      region: "",
      district: "",
      previous_school: "",
      religion: "",
      category: "",
      placement_type: "SELF",
      blood_group: "",
      allergies: "",
      chronic_conditions: "",
      disability: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      emergency_relationship: "",
      notes: "",
      photo: undefined,
    },
    mode: "onChange",
  });

  // Fetch Grade Levels
  const { data: gradeLevels = [], isLoading: gradesLoading } = useQuery<GradeLevel[]>({
    queryKey: ["gradeLevels", currentSchool?.id],
    queryFn: async () => {
      if (!currentSchool?.id) throw new Error("No school selected");
      const res = await api.get("/academics/grade-levels/", {
        headers: { "X-School-ID": currentSchool.id },
      });
      return res.data || [];
    },
    enabled: !!currentSchool?.id && !schoolLoading,
  staleTime: 300_000,
  refetchOnMount: false,
  });

  // Load existing draft / application for continue-editing
  useEffect(() => {
    if (!editId || !currentSchool?.id) {
      if (!editId) setLoadingDraft(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingDraft(true);
      try {
        const res = await api.get(`/admissions/applications/${editId}/`);
        const app = res.data;
        if (cancelled) return;
        setSavedAppId(app.id);
        const classId =
          typeof app.class_applied === "object" && app.class_applied
            ? String(app.class_applied.id)
            : app.class_applied
              ? String(app.class_applied)
              : "";
        reset({
          first_name: app.first_name || "",
          middle_name: app.middle_name || "",
          last_name: app.last_name || "",
          preferred_name: app.preferred_name || "",
          gender: app.gender || "",
          date_of_birth: app.date_of_birth || "",
          birth_certificate_number: app.birth_certificate_number || "",
          nationality: app.nationality || "",
          passport_number: app.passport_number || "",
          class_applied: classId,
          primary_guardian_name: app.primary_guardian_name || "",
          primary_guardian_phone: app.primary_guardian_phone || "",
          primary_guardian_email: app.primary_guardian_email || "",
          primary_guardian_relationship: app.primary_guardian_relationship || "",
          primary_guardian_id_number: app.primary_guardian_id_number || "",
          address: app.address || "",
          region: app.region || "",
          district: app.district || "",
          previous_school: app.previous_school || "",
          religion: app.religion || "",
          category: app.category || "",
          placement_type: app.placement_type || "SELF",
          blood_group: app.blood_group || "",
          allergies: app.allergies || "",
          chronic_conditions: app.chronic_conditions || "",
          disability: app.disability || "",
          emergency_contact_name: app.emergency_contact_name || "",
          emergency_contact_phone: app.emergency_contact_phone || "",
          emergency_relationship: app.emergency_relationship || "",
          notes: app.notes || "",
          photo: undefined,
        });
        toast.message("Continuing saved application", {
          description: `${app.first_name || ""} ${app.last_name || ""} · ${app.status || "DRAFT"}`,
        });
      } catch (err: any) {
        toast.error("Could not open this application", {
          description: err?.response?.data?.detail || "It may have been submitted or deleted.",
        });
      } finally {
        if (!cancelled) setLoadingDraft(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, currentSchool?.id, reset]);

  // Save mutation — authenticated staff API (create + update)
  const saveMutation = useMutation({
    mutationFn: async ({ fd, id }: { fd: FormData; id?: string }) => {
      if (!currentSchool?.id) {
        throw new Error("No school selected");
      }
      // school is taken from X-School-ID / selected school on backend for staff create
      let res;
      if (id) {
        res = await api.patch(`/admissions/applications/${id}/`, fd);
      } else {
        res = await api.post(`/admissions/applications/`, fd);
      }
      return res.data;
    },
    onSuccess: (response, { id }) => {
      const appId = response?.id || id;
      if (!appId) {
        toast.warning("Saved, but no reference ID received");
        console.warn("[DEBUG] No ID in response");
        return;
      }

      // Always update saved ID
      setSavedAppId(appId);
      queryClient.invalidateQueries({ queryKey: ["applications"] });

      if (response.status === "DRAFT") {
        toast.success("Draft saved successfully", {
          description: `ID: ${appId} — you can continue editing`,
          duration: 5000,
        });
        console.log(`[DEBUG] Draft saved/updated - ID: ${appId}`);
      } else {
        toast.success("Application submitted successfully!", {
          description: `ID: ${appId}`,
          duration: 6000,
        });
        console.log(`[DEBUG] Submitted - ID: ${appId}`);
        setIsFinalSubmitted(true);
      }
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      if (data && typeof data === "object" && !data.detail) {
        const parts: string[] = [];
        for (const [k, v] of Object.entries(data)) {
          const msg = Array.isArray(v) ? v.join(", ") : String(v);
          parts.push(`${FIELD_LABELS[k] || k}: ${msg}`);
        }
        if (parts.length) {
          toast.error("Some fields need attention", {
            description: parts.slice(0, 6).join(" · "),
            duration: 9000,
          });
          const firstKey = Object.keys(data)[0];
          if (firstKey && FIELD_STEP[firstKey] !== undefined) {
            setCurrentStep(FIELD_STEP[firstKey]);
          }
          return;
        }
      }
      toast.error("Failed to save", {
        description: data?.detail || err.message || "Please try again",
      });
    },
  });

  // Handle Save Draft or Submit
  const handleAction = async (action: "draft" | "submit") => {
    if (saveMutation.isPending) return;
    if (action === "submit") {
      const isFormValid = await trigger();
      if (!isFormValid) {
        // Re-read errors after trigger
        const values = getValues();
        const result = await trigger();
        // Build readable list from known required fields
        const missing: string[] = [];
        const order = [
          "first_name",
          "last_name",
          "gender",
          "date_of_birth",
          "nationality",
          "class_applied",
          "primary_guardian_name",
          "primary_guardian_phone",
          "primary_guardian_relationship",
          "primary_guardian_id_number",
        ];
        for (const key of order) {
          // trigger already set formState.errors; use DOM + labels
          missing.push(FIELD_LABELS[key] || key);
        }
        // Use a second pass with zod-style: check empty requireds
        const emptyRequired: string[] = [];
        const req: (keyof FormValues)[] = [
          "first_name",
          "last_name",
          "gender",
          "date_of_birth",
          "nationality",
          "class_applied",
          "primary_guardian_name",
          "primary_guardian_phone",
          "primary_guardian_relationship",
          "primary_guardian_id_number",
        ];
        for (const key of req) {
          const v = values[key];
          if (v === undefined || v === null || String(v).trim() === "") {
            emptyRequired.push(FIELD_LABELS[key] || key);
          } else if (key === "primary_guardian_phone" && String(v).trim().length < 9) {
            emptyRequired.push(`${FIELD_LABELS[key]} (too short)`);
          }
        }
        const list = emptyRequired.length ? emptyRequired : missing;
        const firstKey = req.find((k) => {
          const v = values[k];
          return v === undefined || v === null || String(v).trim() === "";
        }) || req[0];
        if (firstKey && FIELD_STEP[firstKey] !== undefined) {
          setCurrentStep(FIELD_STEP[firstKey]);
        }
        try {
          setFocus(firstKey as any);
        } catch {
          /* ignore */
        }
        toast.error("Please complete the highlighted fields", {
          description: list.slice(0, 6).join(" · "),
          duration: 8000,
        });
        setTimeout(() => {
          document.querySelector("[data-field-error='true']")?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 80);
        return;
      }
    }

    const values = getValues();
    const fd = new FormData();

    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && key !== "photo") {
        fd.append(key, String(value));
      }
    });

    if (values.photo instanceof File) fd.append("photo", values.photo);
    documents.forEach((file) => fd.append("documents", file));

    if (!currentSchool?.id) {
      toast.error("No school selected", {
        description: "Use the school switcher in the top bar, then try again.",
      });
      return;
    }

    // Backend also reads X-School-ID; include body school so serializer is satisfied
    fd.set("school", String(currentSchool.id));
    fd.append("status", action === "draft" ? "DRAFT" : "SUBMITTED");

    // Debug log
    console.log(`Action: ${action.toUpperCase()} | Current saved ID: ${savedAppId ?? "new"}`);
    for (let [key, val] of fd.entries()) {
      console.log(`${key}: ${val}`);
    }

    saveMutation.mutate({ fd, id: savedAppId ?? undefined });
  };

  // ──────────────────────────────
  // Loading / Error States
  // ──────────────────────────────
  if (schoolLoading || loadingDraft) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen gap-3">
        <Loader className="animate-spin h-10 w-10 text-primary" />
        <p className="text-sm text-muted-foreground">
          {loadingDraft ? "Opening saved application…" : "Loading…"}
        </p>
      </div>
    );
  }

  if (schoolError || !currentSchool) {
    return (
      <div className="p-6">
        <Link href="/dashboard/modules/admissions">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </Link>
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{schoolError || "No school selected"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // ──────────────────────────────
  // Render
  // ──────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm border">
        <div className="px-6 py-4 border-b bg-primary-50 flex justify-between items-center">
          <p className="text-primary-900 font-medium">
            Applying to: <span className="font-semibold">{currentSchool.name}</span>
          </p>
        </div>

        {savedAppId && !isFinalSubmitted && (
          <Alert className="mx-6 mt-4 bg-secondary-50 border-secondary-200">
            <CheckCircle2 className="h-5 w-5 text-secondary-600" />
            <AlertDescription className="text-secondary-800">
              {editId ? "Editing saved application" : "Draft saved"} (ID: <strong>{savedAppId}</strong>).
              You can keep editing or submit when ready.
            </AlertDescription>
          </Alert>
        )}

        {Object.keys(errors).length > 0 && (
          <Alert variant="destructive" className="mx-6 mt-4">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription>
              <p className="font-semibold mb-1">Please fix the following:</p>
              <ul className="list-disc pl-5 text-sm space-y-0.5">
                {Object.entries(errors).map(([key, err]) => (
                  <li key={key}>
                    <button
                      type="button"
                      className="underline text-left"
                      onClick={() => {
                        if (FIELD_STEP[key] !== undefined) setCurrentStep(FIELD_STEP[key]);
                        try { setFocus(key as any); } catch { /* */ }
                        setTimeout(() => {
                          document.querySelector(`[data-field-error='true']`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }, 50);
                      }}
                    >
                      {FIELD_LABELS[key] || key}: {(err as any)?.message || "Required"}
                    </button>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {isFinalSubmitted ? (
          <div className="p-12 text-center space-y-6">
            <CheckCircle2 className="mx-auto h-16 w-16 text-secondary-600" />
            <h2 className="text-2xl font-bold text-secondary-800">Thank You!</h2>
            <p className="text-lg text-gray-700">
              Your application has been successfully submitted.
            </p>
            <p className="text-gray-600">
              Reference ID: <strong>{savedAppId || "—"}</strong>
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => router.push("/dashboard/modules/admissions")}>
                Back to Applications
              </Button>
              <Button onClick={() => window.location.reload()}>
                Start New Application
              </Button>
            </div>
          </div>
        ) : (
          <form className="p-6 space-y-8">
            <Tabs
              value={steps[currentStep]}
              onValueChange={(val) => {
                const idx = steps.indexOf(val);
                if (idx !== -1) setCurrentStep(idx);
              }}
            >
              <TabsList className="grid w-full grid-cols-4 gap-2 mb-6">
                {steps.map((step) => (
                  <TabsTrigger key={step} value={step}>
                    {step}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Student Details */}
              <TabsContent value="Student" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>First Name *</Label>
                    <Controller name="first_name" control={control} render={({ field }) => <Input {...field} className={fieldErrorClass(!!errors.first_name)} aria-invalid={!!errors.first_name} />} />
                    {errors.first_name && <p data-field-error="true" className="text-red-500 text-sm mt-1 font-medium">{errors.first_name.message}</p>}
                  </div>
                  <div>
                    <Label>Middle Name</Label>
                    <Controller name="middle_name" control={control} render={({ field }) => <Input {...field} />} />
                  </div>
                  <div>
                    <Label>Last Name *</Label>
                    <Controller name="last_name" control={control} render={({ field }) => <Input {...field} className={fieldErrorClass(!!errors.last_name)} aria-invalid={!!errors.last_name} />} />
                    {errors.last_name && <p data-field-error="true" className="text-red-500 text-sm mt-1 font-medium">{errors.last_name.message}</p>}
                  </div>
                  <div>
                    <Label>Preferred Name</Label>
                    <Controller name="preferred_name" control={control} render={({ field }) => <Input {...field} />} />
                  </div>
                  <div>
                    <Label>Gender *</Label>
                    <Controller
                      name="gender"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className={fieldErrorClass(!!errors.gender)}><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MALE">Male</SelectItem>
                            <SelectItem value="FEMALE">Female</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.gender && <p data-field-error="true" className="text-red-500 text-sm mt-1 font-medium">{String(errors.gender.message)}</p>}
                  </div>
                  <div>
                    <Label>Date of Birth *</Label>
                    <Controller name="date_of_birth" control={control} render={({ field }) => <Input type="date" {...field} className={fieldErrorClass(!!errors.date_of_birth)} />} />
                    {errors.date_of_birth && <p data-field-error="true" className="text-red-500 text-sm mt-1 font-medium">{String(errors.date_of_birth.message)}</p>}
                  </div>
                  <div>
                    <Label>Birth Certificate Number *</Label>
                    <Controller name="birth_certificate_number" control={control} render={({ field }) => <Input {...field} placeholder="Or use passport if non-citizen" className={fieldErrorClass(!!errors.birth_certificate_number)} />} />
                    {errors.birth_certificate_number && <p data-field-error="true" className="text-red-500 text-sm mt-1 font-medium">{String(errors.birth_certificate_number.message)}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Required for enrollment (or passport for non-citizens)</p>
                  </div>
                  <div>
                    <Label>Nationality *</Label>
                    <Controller name="nationality" control={control} render={({ field }) => <Input {...field} className={fieldErrorClass(!!errors.nationality)} aria-invalid={!!errors.nationality} />} />
                    {errors.nationality && <p data-field-error="true" className="text-red-500 text-sm mt-1 font-medium">{errors.nationality.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <Label>Class / Grade Applied *</Label>
                    <Controller
                      name="class_applied"
                      control={control}
                      render={({ field }) => {
                        const safeValue = field.value ? String(field.value) : "";

                        return (
                          <Select
                            key={safeValue}
                            value={safeValue}
                            onValueChange={(val) => {
                              field.onChange(String(val));
                              trigger("class_applied");
                            }}
                            disabled={gradesLoading}
                          >
                            <SelectTrigger className={`w-full ${fieldErrorClass(!!errors.class_applied)}`}>
                              <SelectValue placeholder={gradesLoading ? "Loading classes..." : "Select class"} />
                            </SelectTrigger>

                            <SelectContent>
                              {gradesLoading ? (
                                <div className="flex items-center justify-center p-4">
                                  <Loader className="h-4 w-4 animate-spin mr-2" />
                                  <span className="text-sm">Fetching grades...</span>
                                </div>
                              ) : gradeLevels.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                  No classes available for this school
                                </div>
                              ) : (
                                gradeLevels.map((g) => (
                                  <SelectItem
                                    key={String(g.id)}
                                    value={String(g.id)}
                                  >
                                    {g.name}
                                    {g.short_name && ` (${g.short_name})`}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        );
                      }}
                    />
                    {errors.class_applied && (
                      <p data-field-error="true" className="text-red-500 text-sm mt-1 font-medium">
                        {errors.class_applied.message}
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Guardian */}
              <TabsContent value="Guardian" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <Label>Primary Guardian Name *</Label>
                    <Controller name="primary_guardian_name" control={control} render={({ field }) => <Input {...field} className={fieldErrorClass(!!errors.primary_guardian_name)} aria-invalid={!!errors.primary_guardian_name} />} />
                    {errors.primary_guardian_name && <p data-field-error="true" className="text-red-500 text-sm mt-1 font-medium">{errors.primary_guardian_name.message}</p>}
                  </div>
                  <div>
                    <Label>Relationship *</Label>
                    <Controller name="primary_guardian_relationship" control={control} render={({ field }) => <Input {...field} className={fieldErrorClass(!!errors.primary_guardian_relationship)} aria-invalid={!!errors.primary_guardian_relationship} />} />
                    {errors.primary_guardian_relationship && <p data-field-error="true" className="text-red-500 text-sm mt-1 font-medium">{errors.primary_guardian_relationship.message}</p>}
                  </div>
                  <div>
                    <Label>Phone Number *</Label>
                    <Controller name="primary_guardian_phone" control={control} render={({ field }) => <Input type="tel" {...field} className={fieldErrorClass(!!errors.primary_guardian_phone)} aria-invalid={!!errors.primary_guardian_phone} />} />
                    {errors.primary_guardian_phone && <p data-field-error="true" className="text-red-500 text-sm mt-1 font-medium">{errors.primary_guardian_phone.message}</p>}
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Controller name="primary_guardian_email" control={control} render={({ field }) => <Input type="email" {...field} />} />
                  </div>
                  <div>
                    <Label>ID / Passport Number</Label>
                    <Controller name="primary_guardian_id_number" control={control} render={({ field }) => <Input {...field} />} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Address</Label>
                    <Controller name="address" control={control} render={({ field }) => <Input {...field} placeholder="Street, building, etc." />} />
                  </div>
                  <div>
                    <Label>Region / Province / State</Label>
                    <Controller name="region" control={control} render={({ field }) => <Input {...field} />} />
                  </div>
                  <div>
                    <Label>District / City</Label>
                    <Controller name="district" control={control} render={({ field }) => <Input {...field} />} />
                  </div>
                </div>
              </TabsContent>

              {/* Additional Info */}
              <TabsContent value="__legacy_additional" className="space-y-6 hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Previous School</Label>
                    <Controller name="previous_school" control={control} render={({ field }) => <Input {...field} />} />
                  </div>
                  <div>
                    <Label>Religion</Label>
                    <Controller name="religion" control={control} render={({ field }) => <Input {...field} />} />
                  </div>
                  <div>
                    <Label>Category (optional)</Label>
                    <Controller name="category" control={control} render={({ field }) => <Input {...field} placeholder="e.g. General, Scholarship" />} />
                  </div>
                  <div>
                    <Label>Placement Type</Label>
                    <Controller
                      name="placement_type"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SELF">Self / Parent Application</SelectItem>
                            <SelectItem value="PUBLIC">Government / Public Authority</SelectItem>
                            <SelectItem value="TRANSFER">Transfer from Another School</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div>
                    <Label>Blood Group</Label>
                    <Controller
                      name="blood_group"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                              <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Allergies / Medical Conditions</Label>
                    <Controller name="allergies" control={control} render={({ field }) => <Input {...field} placeholder="e.g. nuts, penicillin" />} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Chronic Conditions / Disabilities</Label>
                    <Controller name="chronic_conditions" control={control} render={({ field }) => <Input {...field} placeholder="e.g. asthma, epilepsy" />} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Emergency Contact (if different from guardian)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                      <div>
                        <Label className="text-sm">Name</Label>
                        <Controller name="emergency_contact_name" control={control} render={({ field }) => <Input {...field} />} />
                      </div>
                      <div>
                        <Label className="text-sm">Phone</Label>
                        <Controller name="emergency_contact_phone" control={control} render={({ field }) => <Input type="tel" {...field} />} />
                      </div>
                      <div>
                        <Label className="text-sm">Relationship</Label>
                        <Controller name="emergency_relationship" control={control} render={({ field }) => <Input {...field} />} />
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Additional Notes</Label>
                    <Controller name="notes" control={control} render={({ field }) => <Input {...field} placeholder="Any other relevant information..." />} />
                  </div>
                </div>
              </TabsContent>

              {/* Documents TabContent */}
              <TabsContent value="Documents" className="space-y-6">
                <div>
                  <Label>Passport-size Photo</Label>
                  <Controller
                    name="photo"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <div className="mt-2">
                        {/* If there is already a photo (string URL from server or File object), show a preview or name */}
                        {value && (
                          <p className="text-xs text-primary-700 mb-1">
                            Current: {value instanceof File ? value.name : "Saved Photo"}
                          </p>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) onChange(file);
                          }}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-800 hover:file:bg-primary-100"
                        />
                      </div>
                    )}
                  />
                </div>
                <div>
                  <Label>Supporting Documents</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Birth certificate, immunization records, previous reports, transfer letter, etc.
                  </p>
                  <DocumentUpload
                    files={documents} // This matches: const [documents, setDocuments] = useState<File[]>([])
                    onFilesChange={(newFiles) => setDocuments(newFiles)}
                    initialFiles={[]} // Pass previous docs from backend here if you fetch them later
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-between pt-6 border-t">
              <div>
                {currentStep > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentStep((prev) => prev - 1);
                    }}
                    disabled={saveMutation.isPending}
                  >
                    Back
                  </Button>
                )}
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAction("draft")}
                  disabled={isSubmitting || saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save as Draft"
                  )}
                </Button>

                {currentStep < steps.length - 1 ? (
                  <Button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      const fields = STEP_REQUIRED[currentStep] || [];
                      const ok = fields.length ? await trigger(fields) : true;
                      if (!ok) {
                        const labels = fields
                          .filter((f) => !getValues(f) || (f === "primary_guardian_phone" && String(getValues(f) || "").length < 9))
                          .map((f) => FIELD_LABELS[f] || f);
                        toast.error("Complete required fields on this step", {
                          description: labels.join(" · ") || "Check highlighted fields",
                          duration: 6000,
                        });
                        setTimeout(() => {
                          document.querySelector("[data-field-error='true']")?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                        }, 50);
                        return;
                      }
                      setCurrentStep((prev) => prev + 1);
                    }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => handleAction("submit")}
                    disabled={isSubmitting || saveMutation.isPending}
                    className="min-w-[180px]"
                  >
                    {saveMutation.isPending ? (
                      <>
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Application"
                    )}
                  </Button>
                )}
              </div>
            </div>

            {Object.keys(errors).length > 0 && currentStep === steps.length - 1 && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>
                  <p className="font-semibold mb-1">Still need attention:</p>
                  <ul className="list-disc pl-5 text-sm">
                    {Object.entries(errors).map(([key, err]) => (
                      <li key={key}>
                        {FIELD_LABELS[key] || key}: {(err as any)?.message || "Invalid"}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

export default function NewApplicationPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader className="h-10 w-10 animate-spin" /></div>}>
      <NewApplicationPageInner />
    </Suspense>
  );
}
