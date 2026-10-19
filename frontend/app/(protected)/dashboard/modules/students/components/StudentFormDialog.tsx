// app/(protected)/dashboard/modules/students/components/StudentFormDialog.tsx
"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Save, Loader2 } from "lucide-react";

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

import { studentService } from "../services/studentService";
import { Student } from "../types/student";

// ──────────────────────────────────────────────────────────────────────────────
// Zod Schema - matches Student interface (snake_case properties)
// ──────────────────────────────────────────────────────────────────────────────
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
  current_class: z.string().optional(),
  boarding_status: z.string().optional(),
  special_needs_category: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
});

type StudentFormValues = z.infer<typeof studentSchema>;

// ──────────────────────────────────────────────────────────────────────────────
// Main Dialog Component
// ──────────────────────────────────────────────────────────────────────────────
interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: Student; // for edit mode
  onSuccess: () => void;
}

export default function StudentFormDialog({
  open,
  onOpenChange,
  student,
  onSuccess,
}: StudentFormDialogProps) {
  const isEdit = !!student;

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      first_name: "",
      middle_name: "",
      last_name: "",
      preferred_name: "",
      gender: "",
      date_of_birth: "",
      nationality: "",
      religion: "",
      address: "",
      region: "",
      district: "",
      current_class: "",
      boarding_status: "",
      special_needs_category: "",
      notes: "",
      status: "ACTIVE",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  useEffect(() => {
    if (open && student) {
      form.reset({
      first_name: student?.first_name || "",
      middle_name: student?.middle_name || "",
      last_name: student?.last_name || "",
      preferred_name: (student as any)?.preferred_name || "",
      gender: student?.gender || "",
      date_of_birth: student?.date_of_birth
        ? String(student.date_of_birth).slice(0, 10)
        : "",
      nationality: student?.nationality || "",
      religion: student?.religion || "",
      address: (student as any)?.address || "",
      region: (student as any)?.region || (student as any)?.county || "",
      district: (student as any)?.district || (student as any)?.sub_county || "",
      current_class:
        typeof student?.current_class === "object" && student?.current_class
          ? String((student.current_class as any).id)
          : student?.current_class
            ? String(student.current_class)
            : "",
      boarding_status: student?.boarding_status || "",
      special_needs_category:
        (student as any)?.special_needs_category ||
        (student as any)?.special_needs ||
        "",
      notes: student?.notes || "",
      status: student?.status || "ACTIVE",
    });
    }
  }, [open, student, form]);

  const onSubmit = async (values: StudentFormValues) => {
    try {
      // Field-level patch: only send dirty fields (plus required names on create)
      const dirty = form.formState.dirtyFields as Record<string, boolean>;
      const payload: Record<string, unknown> = {};
      const setVal = (key: string, value: unknown, force = false) => {
        if (!force && isEdit && !dirty[key]) return;
        if (value === undefined || value === null) return;
        if (typeof value === "string" && value.trim() === "") {
          if (force || dirty[key]) payload[key] = "";
          return;
        }
        payload[key] = typeof value === "string" ? value.trim() : value;
      };

      if (!isEdit) {
        setVal("first_name", values.first_name, true);
        setVal("last_name", values.last_name, true);
      } else {
        setVal("first_name", values.first_name);
        setVal("last_name", values.last_name);
      }
      setVal("middle_name", values.middle_name);
      setVal("preferred_name", values.preferred_name);
      setVal("gender", values.gender);
      setVal("date_of_birth", values.date_of_birth);
      setVal("nationality", values.nationality);
      setVal("religion", values.religion);
      setVal("address", values.address);
      setVal("region", values.region);
      setVal("district", values.district);
      setVal("boarding_status", values.boarding_status);
      setVal("special_needs_category", values.special_needs_category);
      setVal("notes", values.notes);
      setVal("status", values.status);
      if ((!isEdit || dirty.current_class) && values.current_class && String(values.current_class).trim()) {
        payload.current_class = String(values.current_class).trim();
      }

      if (isEdit && student?.id) {
        if (Object.keys(payload).length === 0) {
          toast.message("No changes to save");
          return;
        }
        await studentService.update(student.id, payload);
        toast.success("Student updated successfully");
      } else {
        await studentService.create(payload);
        toast.success("Student created successfully");
      }
      onSuccess();
    } catch (error: any) {
      const data = error?.response?.data;
      let msg = "Failed to save student";
      if (typeof data?.detail === "string") msg = data.detail;
      else if (data && typeof data === "object") {
        const parts = Object.entries(data).map(
          ([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`
        );
        if (parts.length) msg = parts.slice(0, 4).join(" · ");
      }
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Student" : "Add New Student"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update student information."
              : "Enter details for the new student. School will be automatically assigned."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="middle_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Middle Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
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
            </div>

            {/* Academic & Other Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="date_of_birth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nationality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nationality</FormLabel>
                    <FormControl>
                      <Input placeholder="Kenyan" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Kenyan-specific (optional) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>County</FormLabel>
                    <FormControl>
                      <Input placeholder="Nairobi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub-County</FormLabel>
                    <FormControl>
                      <Input placeholder="Westlands" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes / Special Needs</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any special needs, allergies, or additional information..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
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
                        <SelectValue placeholder="Status" />
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Save Changes" : "Create Student"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}