"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { studentService } from "../services/studentService";
import { Student } from "../types/student";

const studentSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, "Last name is required"),
  preferred_name: z.string().optional(),
  gender: z.string().min(1, "Gender is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  nationality: z.string().optional(),
  religion: z.string().optional(),
  address: z.string().optional(),
  region: z.string().optional(),
  district: z.string().optional(),
  learner_id: z.string().optional(),
  birth_certificate_number: z.string().optional(),
  passport_number: z.string().optional(),
  current_class: z.string().min(1, "Class / grade is required"),
  boarding_status: z.string().min(1, "Boarding status is required"),
  house: z.string().optional(),
  dorm_room: z.string().optional(),
  blood_group: z.string().optional(),
  allergies: z.string().optional(),
  chronic_conditions: z.string().optional(),
  disability: z.string().optional(),
  special_needs: z.string().optional(),
  emergency_name: z.string().optional(),
  emergency_phone: z.string().optional(),
  emergency_relation: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  primary_guardian_name: z.string().min(1, "Guardian name is required"),
  primary_guardian_phone: z.string().min(1, "Guardian phone is required"),
  primary_guardian_email: z.string().optional(),
  primary_guardian_relationship: z.string().min(1, "Relationship is required"),
  primary_guardian_id_number: z.string().optional(),
  // Continuating / mid-term finance (create only)
  fee_structure_id: z.string().optional(),
  amount_paid: z.string().optional(),
});

type StudentFormValues = z.infer<typeof studentSchema>;

function asList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function mapStudentToForm(s: any): StudentFormValues {
  const primary =
    (Array.isArray(s?.guardians) &&
      (s.guardians.find((g: any) => g.is_primary) || s.guardians[0])) ||
    null;
  const classId =
    typeof s?.current_class === "object" && s?.current_class
      ? String(s.current_class.id)
      : s?.current_class
        ? String(s.current_class)
        : "";

  return {
    first_name: s?.first_name || "",
    middle_name: s?.middle_name || "",
    last_name: s?.last_name || "",
    preferred_name: s?.preferred_name || "",
    gender: s?.gender || "",
    date_of_birth: s?.date_of_birth ? String(s.date_of_birth).slice(0, 10) : "",
    nationality: s?.nationality || "",
    religion: s?.religion || "",
    address: s?.address || "",
    region: s?.region || s?.county || "",
    district: s?.district || s?.sub_county || "",
    learner_id: s?.learner_id || "",
    birth_certificate_number: s?.birth_certificate_number || "",
    passport_number: s?.passport_number || "",
    current_class: classId,
    boarding_status: s?.boarding_status || "DAY",
    house: s?.house || "",
    dorm_room: s?.dorm_room || "",
    blood_group: s?.blood_group || "",
    allergies: s?.allergies || "",
    chronic_conditions: s?.chronic_conditions || "",
    disability: s?.disability || "",
    special_needs: s?.special_needs || s?.special_needs_category || "",
    emergency_name: s?.emergency_name || "",
    emergency_phone: s?.emergency_phone || "",
    emergency_relation: s?.emergency_relation || "",
    notes: s?.notes || "",
    status: s?.status || "ACTIVE",
    primary_guardian_name: primary?.full_name || "",
    primary_guardian_phone: primary?.phone || "",
    primary_guardian_email: primary?.email || "",
    primary_guardian_relationship: primary?.relationship || "GUARDIAN",
    primary_guardian_id_number: primary?.id_number || "",
    fee_structure_id: "",
    amount_paid: "",
  };
}

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: Student;
  onSuccess: () => void;
}

export default function StudentFormDialog({
  open,
  onOpenChange,
  student,
  onSuccess,
}: StudentFormDialogProps) {
  const isEdit = !!student?.id;
  const { currentSchool } = useCurrentSchool();
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: mapStudentToForm({}),
  });

  const selectedClass = form.watch("current_class");
  const feeStructureId = form.watch("fee_structure_id");
  const amountPaidStr = form.watch("amount_paid");

  const selectedStructure = useMemo(
    () => structures.find((s) => String(s.id) === String(feeStructureId)),
    [structures, feeStructureId]
  );

  const structureTotal = useMemo(() => {
    if (!selectedStructure) return 0;
    if (selectedStructure.total_amount != null) return Number(selectedStructure.total_amount) || 0;
    if (selectedStructure.mandatory_total != null) return Number(selectedStructure.mandatory_total) || 0;
    const items = selectedStructure.items || selectedStructure.lines || [];
    return items.reduce((sum: number, it: any) => sum + (Number(it.amount) || 0), 0);
  }, [selectedStructure]);

  const amountPaidNum = Number(String(amountPaidStr || "0").replace(/,/g, "")) || 0;
  const estimatedBalance = Math.max(0, structureTotal - amountPaidNum);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [gRes, sRes] = await Promise.all([
          api.get("/academics/grade-levels/"),
          api.get("/finance/structures/", { params: { is_active: true } }).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        setGrades(asList(gRes.data));
        setStructures(asList(sRes.data));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Auto-pick fee structure for selected grade when creating
  useEffect(() => {
    if (isEdit || !selectedClass || !structures.length) return;
    const grade = grades.find((g) => String(g.id) === String(selectedClass));
    const gname = (grade?.name || "").toLowerCase();
    const match =
      structures.find((s) => String(s.grade_level || s.grade_level_id) === String(selectedClass)) ||
      structures.find((s) => (s.grade_name || s.name || "").toLowerCase().includes(gname));
    if (match && !form.getValues("fee_structure_id")) {
      form.setValue("fee_structure_id", String(match.id));
    }
  }, [selectedClass, structures, grades, isEdit, form]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      if (isEdit && student?.id) {
        setLoadingDetail(true);
        try {
          const full = await studentService.getById(String(student.id), {
            expand: "guardians,current_class",
          } as any);
          if (cancelled) return;
          form.reset(mapStudentToForm(full));
          setAdmissionNumber((full as any)?.admission_number || "");
          const url =
            (full as any)?.photo_url ||
            (typeof (full as any)?.photo === "string" ? (full as any).photo : null);
          setPhotoPreview(url);
        } catch {
          form.reset(mapStudentToForm(student));
          setAdmissionNumber((student as any)?.admission_number || "");
        } finally {
          if (!cancelled) setLoadingDetail(false);
        }
      } else {
        form.reset(mapStudentToForm({}));
        setAdmissionNumber("");
        setPhotoPreview(null);
        setPhotoFile(null);
        setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isEdit, student?.id]);

  const onSubmit = async (values: StudentFormValues) => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      const keys: (keyof StudentFormValues)[] = [
        "first_name",
        "last_name",
        "middle_name",
        "preferred_name",
        "gender",
        "date_of_birth",
        "nationality",
        "religion",
        "address",
        "region",
        "district",
        "learner_id",
        "birth_certificate_number",
        "passport_number",
        "boarding_status",
        "house",
        "dorm_room",
        "blood_group",
        "allergies",
        "chronic_conditions",
        "disability",
        "special_needs",
        "emergency_name",
        "emergency_phone",
        "emergency_relation",
        "notes",
        "status",
        "primary_guardian_name",
        "primary_guardian_phone",
        "primary_guardian_email",
        "primary_guardian_relationship",
        "primary_guardian_id_number",
      ];
      for (const key of keys) {
        const value = values[key];
        if (value === undefined || value === null) continue;
        payload[key as string] = typeof value === "string" ? value.trim() : value;
      }
      if (values.current_class?.trim()) {
        payload.current_class = values.current_class.trim();
      } else if (isEdit) {
        payload.current_class = null;
      }

      if (!isEdit) {
        if (values.fee_structure_id) payload.fee_structure_id = values.fee_structure_id;
        payload.amount_paid = String(values.amount_paid || "0").replace(/,/g, "") || "0";
        if (selectedStructure?.academic_year) payload.academic_year = selectedStructure.academic_year;
        if (selectedStructure?.period_name) payload.term = selectedStructure.period_name;
      }

      if (photoFile) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null) fd.append(k, String(v));
        });
        fd.append("photo", photoFile);
        if (isEdit) {
          await studentService.update(String(student!.id), fd as any);
          toast.success("Student updated");
        } else {
          await studentService.create(fd as any);
          toast.success("Student registered — finance updated");
        }
      } else {
        if (isEdit) {
          await studentService.update(String(student!.id), payload);
          toast.success("Student updated");
        } else {
          await studentService.create(payload);
          const paid = Number(payload.amount_paid) || 0;
          if (paid > 0) {
            toast.success("Student registered as ACTIVE with opening payment");
          } else if (values.fee_structure_id) {
            toast.success("Student registered — pending finance clearance");
          } else {
            toast.success("Student registered");
          }
        }
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      const d = err?.response?.data;
      const msg =
        d?.detail ||
        (d && typeof d === "object"
          ? Object.entries(d)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
              .join(" · ")
          : null) ||
        "Could not save student";
      toast.error(String(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-2xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b">
          <DialogTitle>{isEdit ? "Edit student" : "Add continuing student"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update learner and guardian details."
              : "Register a learner already in school (mid-term / transfer). Admission number is assigned automatically. Attach fee structure and amount already paid so Finance balances stay correct."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          {loadingDetail ? (
            <p className="text-sm text-muted-foreground py-8">Loading…</p>
          ) : (
            <Form {...form}>
              <form id="student-intake-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {isEdit && admissionNumber && (
                  <div>
                    <label className="text-sm font-medium">Admission number</label>
                    <Input value={admissionNumber} disabled className="bg-slate-50 font-mono mt-1" />
                  </div>
                )}

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-teal-900">Learner identity</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(
                      [
                        ["first_name", "First name *"],
                        ["middle_name", "Middle name"],
                        ["last_name", "Last name *"],
                        ["preferred_name", "Preferred name"],
                        ["date_of_birth", "Date of birth *", "date"],
                        ["learner_id", "Learner ID / UPI"],
                        ["birth_certificate_number", "Birth certificate no."],
                        ["nationality", "Nationality"],
                      ] as [keyof StudentFormValues, string, string?][]
                    ).map(([name, label, type]) => (
                      <FormField
                        key={name}
                        control={form.control}
                        name={name}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{label}</FormLabel>
                            <FormControl>
                              <Input type={type || "text"} {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="MALE">Male</SelectItem>
                              <SelectItem value="FEMALE">Female</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="boarding_status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Boarding *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "DAY"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="DAY">Day</SelectItem>
                              <SelectItem value="BOARDING">Boarding</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-teal-900">Placement</h3>
                  <FormField
                    control={form.control}
                    name="current_class"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Class / grade *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select grade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {grades.map((g) => (
                              <SelectItem key={String(g.id)} value={String(g.id)}>
                                {g.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="region"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>County / region</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-teal-900">Primary guardian *</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(
                      [
                        ["primary_guardian_name", "Full name *"],
                        ["primary_guardian_phone", "Phone *"],
                        ["primary_guardian_email", "Email"],
                        ["primary_guardian_id_number", "ID number"],
                      ] as [keyof StudentFormValues, string][]
                    ).map(([name, label]) => (
                      <FormField
                        key={name}
                        control={form.control}
                        name={name}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{label}</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                    <FormField
                      control={form.control}
                      name="primary_guardian_relationship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Relationship *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "GUARDIAN"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="FATHER">Father</SelectItem>
                              <SelectItem value="MOTHER">Mother</SelectItem>
                              <SelectItem value="GUARDIAN">Guardian</SelectItem>
                              <SelectItem value="OTHER">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </section>

                {!isEdit && (
                  <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                    <h3 className="text-sm font-semibold text-amber-900">Fees (continuing / mid-term)</h3>
                    <p className="text-xs text-amber-800">
                      Select this term&apos;s fee structure and enter amount already paid. If paid &gt; 0 the
                      student is <strong>ACTIVE</strong>. If paid is 0 and there is a balance, they go to the{" "}
                      <strong>clearance list</strong>.
                    </p>
                    <FormField
                      control={form.control}
                      name="fee_structure_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fee structure</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select structure (recommended)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {structures.map((s) => (
                                <SelectItem key={String(s.id)} value={String(s.id)}>
                                  {s.name || s.title || `Structure #${s.id}`}
                                  {s.period_name ? ` · ${s.period_name}` : ""}
                                  {s.academic_year ? ` · ${s.academic_year}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="amount_paid"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount already paid</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="0"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {selectedStructure && (
                      <div className="text-xs space-y-1 text-stone-700">
                        <p>
                          Structure total (est.):{" "}
                          <strong>
                            {currentSchool?.currency_symbol || "KSh"} {structureTotal.toLocaleString()}
                          </strong>
                        </p>
                        <p>
                          Estimated balance:{" "}
                          <strong>
                            {currentSchool?.currency_symbol || "KSh"} {estimatedBalance.toLocaleString()}
                          </strong>
                        </p>
                        <p className="text-muted-foreground">
                          Status after save:{" "}
                          {amountPaidNum > 0 || estimatedBalance <= 0
                            ? "ACTIVE"
                            : "PENDING_CLEARANCE (clearance list)"}
                        </p>
                      </div>
                    )}
                  </section>
                )}

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-teal-900">Medical / notes (optional)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(
                      [
                        ["blood_group", "Blood group"],
                        ["allergies", "Allergies"],
                        ["chronic_conditions", "Chronic conditions"],
                        ["special_needs", "Special needs"],
                      ] as [keyof StudentFormValues, string][]
                    ).map(([name, label]) => (
                      <FormField
                        key={name}
                        control={form.control}
                        name={name}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{label}</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value || ""} rows={2} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div>
                    <label className="text-sm font-medium">Photo (optional)</label>
                    <Input
                      type="file"
                      accept="image/*"
                      className="mt-1"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setPhotoFile(f);
                        if (f) setPhotoPreview(URL.createObjectURL(f));
                      }}
                    />
                    {photoPreview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoPreview} alt="" className="mt-2 h-20 w-20 object-cover rounded-md border" />
                    )}
                  </div>
                </section>
              </form>
            </Form>
          )}
        </div>

        <div className="shrink-0 border-t bg-background px-6 py-4 flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="student-intake-form"
            className="flex-1"
            disabled={saving || loadingDetail}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Register student"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
