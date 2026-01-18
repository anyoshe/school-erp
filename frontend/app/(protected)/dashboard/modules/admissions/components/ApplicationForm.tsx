// frontend/(protected)/dashboard/modules/admissions/components/ApplicationForm.tsx
"use client";

import { useForm, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/utils/api";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, AlertCircle, Loader } from "lucide-react";
import DocumentUpload from "./DocumentUpload";
import { Application } from "@/types/admission";
import { School } from "@/types/school";


// ... later in code ...
<Loader className="h-5 w-5 animate-spin" />

// Zod schema for validation (matches backend)
const formSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, "Last name is required"),
  preferred_name: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  date_of_birth: z.string().optional(),
  class_applied: z.string().min(1, "Class is required"),
  primary_guardian_name: z.string().min(1, "Guardian name is required"),
  primary_guardian_phone: z.string().min(9, "Valid phone number required"),
  primary_guardian_email: z.string().email("Invalid email").optional(),
  primary_guardian_relationship: z.string().min(1, "Relationship is required"),
  address: z.string().optional(),
  county: z.string().optional(),
  sub_county: z.string().optional(),
  previous_school: z.string().optional(),
  nationality: z.string().min(1, "Nationality is required"),
  passport_number: z.string().optional(),
  religion: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  admission_date: z.string().optional(),
  status: z.string().optional(),
});

type ApplicationFormValues = z.infer<typeof formSchema>;

// Props – school is now required from parent
interface ApplicationFormProps {
  initialData?: Partial<Application>;
  onSubmit: (formData: globalThis.FormData) => void | Promise<void>;
  isDirectEnroll?: boolean;
  school: School | null; // Passed from parent (required)
  gradeLevels?: Array<{ id: string | number; name: string }>; // Optional pre-fetched
}

export default function ApplicationForm({
  initialData = {},
  onSubmit,
  isDirectEnroll = false,
  school,
  gradeLevels: propGradeLevels = [],
}: ApplicationFormProps) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: initialData.first_name || "",
      middle_name: initialData.middle_name || "",
      last_name: initialData.last_name || "",
      preferred_name: initialData.preferred_name || "",
      gender: initialData.gender as any,
      date_of_birth: initialData.date_of_birth || "",
      class_applied: (initialData.class_applied as any)?.id?.toString() || "",
      primary_guardian_name: initialData.primary_guardian_name || "",
      primary_guardian_phone: initialData.primary_guardian_phone || "",
      primary_guardian_email: initialData.primary_guardian_email || "",
      primary_guardian_relationship: initialData.primary_guardian_relationship || "",
      address: initialData.address || "",
      county: initialData.county || "",
      sub_county: initialData.sub_county || "",
      previous_school: initialData.previous_school || "",
      nationality: initialData.nationality || "Kenyan",
      passport_number: initialData.passport_number || "",
      religion: initialData.religion || "",
      category: initialData.category || "",
      notes: initialData.notes || "",
      admission_date: initialData.admission_date || "",
      status: initialData.status || "DRAFT",
    },
  });

  const [documents, setDocuments] = useState<File[]>([]);

  // School-aware grade levels fetch
  const {
    data: fetchedGradeLevels = [],
    isLoading: gradesLoading,
    error: gradesError,
  } = useQuery<any[]>({
    queryKey: ["gradeLevels"],
    // Some backends don't support filtering by `school` query param — fetch all and filter client-side
    queryFn: async () => {
      // If we have a selected school, request server-side filtered list
      if (school?.id) {
        const res = await api.get(`/academics/grade-levels/`, { params: { school: school.id } });
        return res.data;
      }
      // Fallback: fetch unfiltered list (may return none if backend requires school)
      const res = await api.get(`/academics/grade-levels/`);
      return res.data;
    },
    enabled: propGradeLevels.length === 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Use passed gradeLevels if available, otherwise filter fetched list by school id (robust to shape)
  const finalGradeLevels = (propGradeLevels.length > 0
    ? propGradeLevels
    : (fetchedGradeLevels || []).filter((g: any) => {
        if (!school?.id) return true;
        return (
          g.school === school.id ||
          g.school_id === school.id ||
          (g.school && typeof g.school === "object" && g.school.id === school.id)
        );
      })) as Array<{ id: string | number; name: string }>;

  const onFormSubmit = handleSubmit((data) => {
    const fd = new globalThis.FormData();

    // Append all form fields
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        fd.append(key, String(value));
      }
    });

    // Attachments only for non-direct mode
    if (!isDirectEnroll) {
      documents.forEach((file) => fd.append("documents", file));

    }

    onSubmit(fd);
  });

  // UI options (school-agnostic for now – can be dynamic later)
  const genderOptions = ["MALE", "FEMALE", "OTHER"];
  const relationshipOptions = ["PARENT", "GUARDIAN", "RELATIVE", "OTHER"];
  const religionOptions = ["CHRISTIAN", "MUSLIM", "HINDU", "OTHER", ""];
  const categoryOptions = ["GENERAL", "OBC", "SC", "ST", ""];

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      {/* School context banner */}
      <div className="bg-blue-50 border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Info className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-800">
              Enrolling to: <span className="font-semibold">{school?.name || "Selected School"}</span>
            </p>
          </div>
          {gradesLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader className="h-4 w-4 animate-spin" />
              Loading classes...
            </div>
          )}
          {gradesError && (
            <Alert variant="destructive" className="max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load classes. Please try refreshing.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <form onSubmit={onFormSubmit} className="p-6 lg:p-8 space-y-10">
        <Tabs defaultValue="student" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-4 gap-2 mb-8">
            <TabsTrigger value="student">Student Info</TabsTrigger>
            <TabsTrigger value="guardian">Guardian</TabsTrigger>
            <TabsTrigger value="additional">Additional</TabsTrigger>
            {!isDirectEnroll && <TabsTrigger value="attachments">Attachments</TabsTrigger>}
          </TabsList>

          {/* Student Info Tab */}
          <TabsContent value="student">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Required fields first */}
              <div>
                <Label>First Name *</Label>
                <Controller
                  name="first_name"
                  control={control}
                  render={({ field }) => <Input {...field} placeholder="e.g. John" />}
                />
                {errors.first_name && <p className="text-red-500 text-sm mt-1">{errors.first_name.message}</p>}
              </div>

              <div>
                <Label>Last Name *</Label>
                <Controller
                  name="last_name"
                  control={control}
                  render={({ field }) => <Input {...field} placeholder="e.g. Doe" />}
                />
                {errors.last_name && <p className="text-red-500 text-sm mt-1">{errors.last_name.message}</p>}
              </div>

              <div>
                <Label>Class Applied *</Label>
                <Controller
                  name="class_applied"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {gradesLoading ? (
                          <div className="py-6 px-4 text-center text-sm text-muted-foreground pointer-events-none">
                            Loading classes...
                          </div>
                        ) : finalGradeLevels.length === 0 ? (
                          <div className="py-6 px-4 text-center text-sm text-muted-foreground pointer-events-none">
                            No classes available for this school
                          </div>
                        ) : (
                          finalGradeLevels.map((g) => (
                            <SelectItem key={g.id} value={String(g.id)}>
                              {g.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.class_applied && <p className="text-red-500 text-sm mt-1">{errors.class_applied.message}</p>}
              </div>

              {/* Optional student fields */}
              <div>
                <Label>Middle Name</Label>
                <Controller name="middle_name" control={control} render={({ field }) => <Input {...field} />} />
              </div>

              <div>
                <Label>Preferred Name / Nickname</Label>
                <Controller name="preferred_name" control={control} render={({ field }) => <Input {...field} />} />
              </div>

              <div>
                <Label>Gender</Label>
                <Controller
                  name="gender"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {genderOptions.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g.charAt(0) + g.slice(1).toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Label>Date of Birth</Label>
                <Controller name="date_of_birth" control={control} render={({ field }) => <Input type="date" {...field} />} />
              </div>
            </div>
          </TabsContent>

          {/* Guardian Tab */}
          <TabsContent value="guardian">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <Label>Guardian Name *</Label>
                <Controller
                  name="primary_guardian_name"
                  control={control}
                  render={({ field }) => <Input {...field} placeholder="e.g. Jane Doe" />}
                />
                {errors.primary_guardian_name && (
                  <p className="text-red-500 text-sm mt-1">{errors.primary_guardian_name.message}</p>
                )}
              </div>

              <div>
                <Label>Relationship *</Label>
                <Controller
                  name="primary_guardian_relationship"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {relationshipOptions.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.primary_guardian_relationship && (
                  <p className="text-red-500 text-sm mt-1">{errors.primary_guardian_relationship.message}</p>
                )}
              </div>

              <div>
                <Label>Phone Number *</Label>
                <Controller
                  name="primary_guardian_phone"
                  control={control}
                  render={({ field }) => <Input {...field} placeholder="+2547..." type="tel" />}
                />
                {errors.primary_guardian_phone && (
                  <p className="text-red-500 text-sm mt-1">{errors.primary_guardian_phone.message}</p>
                )}
              </div>

              <div>
                <Label>Email</Label>
                <Controller
                  name="primary_guardian_email"
                  control={control}
                  render={({ field }) => <Input {...field} placeholder="guardian@example.com" type="email" />}
                />
              </div>
            </div>
          </TabsContent>

          {/* Additional Info Tab */}
          <TabsContent value="additional">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="md:col-span-2 lg:col-span-3">
                <Label>Full Address</Label>
                <Controller
                  name="address"
                  control={control}
                  render={({ field }) => <Textarea {...field} placeholder="Street, Estate, City" rows={3} />}
                />
              </div>

              <div>
                <Label>County</Label>
                <Controller name="county" control={control} render={({ field }) => <Input {...field} />} />
              </div>

              <div>
                <Label>Sub-County</Label>
                <Controller name="sub_county" control={control} render={({ field }) => <Input {...field} />} />
              </div>

              <div>
                <Label>Previous School</Label>
                <Controller name="previous_school" control={control} render={({ field }) => <Input {...field} />} />
              </div>

              <div>
                <Label>Nationality *</Label>
                <Controller
                  name="nationality"
                  control={control}
                  render={({ field }) => <Input {...field} placeholder="e.g. Kenyan" />}
                />
                {errors.nationality && <p className="text-red-500 text-sm mt-1">{errors.nationality.message}</p>}
              </div>

              <div>
                <Label>Religion</Label>
                <Controller
                  name="religion"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {religionOptions.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r || "Prefer not to say"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Label>Category</Label>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c || "Not applicable"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <Label>Notes / Additional Comments</Label>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => <Textarea {...field} rows={4} placeholder="Any special notes..." />}
                />
              </div>
            </div>
          </TabsContent>

          {/* Attachments Tab – hidden in direct mode */}
          {!isDirectEnroll && (
         <TabsContent value="attachments">
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-medium mb-3">Upload Documents</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Birth certificate, previous report cards, ID/passport, etc.
                  </p>
                  <DocumentUpload onFilesChange={setDocuments} initialFiles={(initialData.documents as any[]) || []} />
                </div>

                <Alert variant="default" className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    Minimum payment required for enrollment may apply based on school policy.
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Submit area */}
        <div className="pt-8 flex flex-col sm:flex-row justify-end gap-4 border-t pt-6">
          <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-[180px]">
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                </svg>
                Processing...
              </span>
            ) : isDirectEnroll ? (
              "Enroll Student"
            ) : (
              "Save Application"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}