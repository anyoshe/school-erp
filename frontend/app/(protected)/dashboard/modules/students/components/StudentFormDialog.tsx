"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Save, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  gender: z.string().optional(),
  date_of_birth: z.string().optional(),
  nationality: z.string().optional(),
  religion: z.string().optional(),
  address: z.string().optional(),
  region: z.string().optional(),
  district: z.string().optional(),
  learner_id: z.string().optional(),
  birth_certificate_number: z.string().optional(),
  passport_number: z.string().optional(),
  current_class: z.string().optional(),
  boarding_status: z.string().optional(),
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
  primary_guardian_name: z.string().optional(),
  primary_guardian_phone: z.string().optional(),
  primary_guardian_email: z.string().optional(),
  primary_guardian_relationship: z.string().optional(),
  primary_guardian_id_number: z.string().optional(),
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
    primary_guardian_relationship: primary?.relationship || "",
    primary_guardian_id_number: primary?.id_number || "",
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
  const [detail, setDetail] = useState<any>(null);

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: mapStudentToForm({}),
  });

  const gradesQ = useQuery({
    queryKey: ["grade-levels-student-form", currentSchool?.id],
    enabled: open && !!currentSchool?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await api.get("/academics/grade-levels/", {
        headers: currentSchool?.id
          ? { "X-School-ID": String(currentSchool.id) }
          : undefined,
      });
      return asList(res.data);
    },
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      if (isEdit && student?.id) {
        setLoadingDetail(true);
        try {
          const full = await studentService.getById(String(student.id));
          if (cancelled) return;
          const data = full || student;
          setDetail(data);
          setAdmissionNumber((data as any)?.admission_number || "");
          form.reset(mapStudentToForm(data));
          const url =
            (data as any)?.photo_url ||
            (typeof (data as any)?.photo === "string" ? (data as any).photo : null);
          setPhotoPreview(url);
          setPhotoFile(null);
        } catch {
          if (!cancelled) {
            setDetail(student);
            setAdmissionNumber((student as any)?.admission_number || "");
            form.reset(mapStudentToForm(student));
          }
        } finally {
          if (!cancelled) setLoadingDetail(false);
        }
      } else {
        setDetail(null);
        setAdmissionNumber("");
        form.reset(mapStudentToForm({}));
        setPhotoPreview(null);
        setPhotoFile(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, isEdit, student?.id]);

  const onSubmit = async (values: StudentFormValues) => {
    try {
      const dirty = form.formState.dirtyFields as Record<string, boolean>;
      const payload: Record<string, unknown> = {};
      const setVal = (key: keyof StudentFormValues, force = false) => {
        if (isEdit && !force && !dirty[key]) return;
        const value = values[key];
        if (value === undefined || value === null) return;
        payload[key as string] =
          typeof value === "string" ? value.trim() : value;
      };

      (
        [
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
        ] as (keyof StudentFormValues)[]
      ).forEach((k) => setVal(k, !isEdit && (k === "first_name" || k === "last_name")));

      if ((!isEdit || dirty.current_class) && values.current_class) {
        payload.current_class = values.current_class;
      }

      if (photoFile) {
        // Multipart path for photo + fields
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null) fd.append(k, String(v));
        });
        fd.append("photo", photoFile);
        if (isEdit && student?.id) {
          await api.patch(`/students/${student.id}/`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          toast.success("Student updated");
        } else {
          await api.post(`/students/`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          toast.success("Student created");
        }
      } else {
        if (isEdit && student?.id) {
          if (Object.keys(payload).length === 0) {
            toast.message("No changes to save");
            return;
          }
          await studentService.update(String(student.id), payload);
          toast.success("Student updated");
        } else {
          await studentService.create(payload);
          toast.success("Student created");
        }
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      const data = error?.response?.data;
      let msg = "Failed to save student";
      if (typeof data?.detail === "string") msg = data.detail;
      else if (data && typeof data === "object") {
        const parts = Object.entries(data).map(
          ([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`
        );
        if (parts.length) msg = parts.slice(0, 5).join(" · ");
      }
      toast.error(msg);
    }
  };

  const grades = gradesQ.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Student" : "Add New Student"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Details load from the full student record (admission + enrollment). Admission number cannot be changed."
              : "Enter details for the new student."}
          </DialogDescription>
        </DialogHeader>

        {loadingDetail ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading full student profile…
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {isEdit && (
                <div>
                  <FormLabel>Admission Number</FormLabel>
                  <Input value={admissionNumber} disabled className="bg-slate-50 font-mono" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Locked — school admission number cannot be edited here.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(
                  [
                    ["first_name", "First Name *"],
                    ["middle_name", "Middle Name"],
                    ["last_name", "Last Name *"],
                    ["preferred_name", "Preferred Name"],
                    ["learner_id", "Learner ID / UPI"],
                    ["birth_certificate_number", "Birth Certificate No."],
                    ["passport_number", "Passport No."],
                    ["nationality", "Nationality"],
                    ["religion", "Religion"],
                    ["date_of_birth", "Date of Birth", "date"],
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
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MALE">Male</SelectItem>
                          <SelectItem value="FEMALE">Female</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="current_class"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Class / Grade</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={gradesQ.isLoading ? "Loading…" : "Select class"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {grades.map((g: any) => (
                            <SelectItem key={String(g.id)} value={String(g.id)}>
                              {g.name}
                              {g.short_name ? ` (${g.short_name})` : ""}
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
                  name="boarding_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Boarding Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "DAY"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="DAY">Day</SelectItem>
                          <SelectItem value="BOARDING">Boarding</SelectItem>
                          <SelectItem value="MIXED">Mixed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "ACTIVE"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="SUSPENDED">Suspended</SelectItem>
                          <SelectItem value="TRANSFERRED">Transferred</SelectItem>
                          <SelectItem value="GRADUATED">Graduated</SelectItem>
                          <SelectItem value="EXPELLED">Expelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(
                  [
                    ["house", "House"],
                    ["dorm_room", "Dorm / Room"],
                    ["blood_group", "Blood Group"],
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
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Photo</h4>
                {photoPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoPreview}
                    alt="Student"
                    className="h-20 w-20 rounded-lg object-cover border"
                  />
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setPhotoFile(f);
                    if (f) setPhotoPreview(URL.createObjectURL(f));
                  }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {(
                  [
                    ["region", "Region / County"],
                    ["district", "District / Sub-county"],
                    ["allergies", "Allergies"],
                    ["chronic_conditions", "Chronic Conditions"],
                    ["disability", "Disability"],
                    ["special_needs", "Special Needs"],
                    ["emergency_name", "Emergency Contact Name"],
                    ["emergency_phone", "Emergency Phone"],
                    ["emergency_relation", "Emergency Relationship"],
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
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t pt-4 space-y-3">
                <h4 className="font-semibold text-sm">Primary Guardian</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(
                    [
                      ["primary_guardian_name", "Name"],
                      ["primary_guardian_phone", "Phone"],
                      ["primary_guardian_email", "Email"],
                      ["primary_guardian_relationship", "Relationship"],
                      ["primary_guardian_id_number", "ID / Passport"],
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
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save changes
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
