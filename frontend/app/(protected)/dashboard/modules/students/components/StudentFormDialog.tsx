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
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  date_of_birth: z.string().optional(),
  nationality: z.string().optional(),
  county: z.string().optional(),
  sub_county: z.string().optional(),
  religion: z.string().optional(),
  current_class: z.string().optional(), // UUID of GradeLevel/Class
  stream: z.string().optional(),
  boarding_status: z.enum(["DAY", "BOARDING", "MIXED"]).optional(),
  special_needs: z.string().optional(),
  notes: z.string().optional(),
  // photo would be handled separately (File upload)
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
    defaultValues: student
      ? {
          first_name: student.first_name,
          middle_name: student.middle_name || "",
          last_name: student.last_name,
          gender: student.gender,
          date_of_birth: student.date_of_birth || "",
          nationality: student.nationality || "Kenyan",
          county: student.county || "",
          sub_county: student.sub_county || "",
          religion: student.religion || "",
          current_class: student.current_class || "",
          stream: student.stream || "",
          boarding_status: student.boarding_status,
          special_needs: student.special_needs || "",
          notes: student.notes || "",
        }
      : {
          first_name: "",
          middle_name: "",
          last_name: "",
          gender: undefined,
          date_of_birth: "",
          nationality: "Kenyan",
          county: "",
          sub_county: "",
          religion: "",
          current_class: "",
          stream: "",
          boarding_status: undefined,
          special_needs: "",
          notes: "",
        },
  });

  const isSubmitting = form.formState.isSubmitting;

  useEffect(() => {
    if (open && student) {
      form.reset({
        first_name: student.first_name,
        middle_name: student.middle_name || "",
        last_name: student.last_name,
        gender: student.gender,
        date_of_birth: student.date_of_birth || "",
        nationality: student.nationality || "Kenyan",
        county: student.county || "",
        sub_county: student.sub_county || "",
        religion: student.religion || "",
        current_class: student.current_class || "",
        stream: student.stream || "",
        boarding_status: student.boarding_status,
        special_needs: student.special_needs || "",
        notes: student.notes || "",
      });
    }
  }, [open, student, form]);

  const onSubmit = async (values: StudentFormValues) => {
    try {
      if (isEdit && student?.id) {
        await studentService.update(student.id, values);
        toast.success("Student updated successfully");
      } else {
        await studentService.create(values);
        toast.success("Student created successfully");
      }

      onSuccess();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to save student");
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
                name="county"
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
                name="sub_county"
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