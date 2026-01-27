"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import publicApi from "@/utils/publicApi"; // ← only publicApi is used
import { toast } from "sonner";
import DocumentUpload from "@/components/DocumentUpload";
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
import { Loader, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

// ──────────────────────────────
// Form schema (same as before)
// ──────────────────────────────
const formSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, "Last name is required"),
  preferred_name: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", ""]).optional(),
  date_of_birth: z.string().optional(),
  nationality: z.string().min(1, "Nationality is required"),
  passport_number: z.string().optional(),
  class_applied: z.string().min(1, "Class/Grade is required"),
  primary_guardian_name: z.string().min(1, "Guardian name is required"),
  primary_guardian_phone: z.string().min(9, "Valid phone number required"),
  primary_guardian_email: z.string().email("Invalid email").optional(),
  primary_guardian_relationship: z.string().min(1, "Relationship is required"),
  primary_guardian_id_number: z.string().optional(),
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
});

type FormValues = z.infer<typeof formSchema>;

interface GradeLevel {
  id: string;
  name: string;
  short_name?: string;
}

interface School {
  id: string;
  name: string;
  slug?: string;
  // add any other fields you return from the public endpoint
}

// ──────────────────────────────
// Public Application Page
// ──────────────────────────────
export default function PublicNewApplicationPage() {
  const router = useRouter();
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [documents, setDocuments] = useState<File[]>([]);
  const [isFinalSubmitted, setIsFinalSubmitted] = useState(false);
  const [savedAppId, setSavedAppId] = useState<string | null>(null);

  const steps = ["Student", "Guardian", "Additional Info", "Documents"];

  // ─── Fetch School by slug (public endpoint) ────────────────────────────────
  const {
    data: school,
    isLoading: schoolLoading,
    error: schoolError,
  } = useQuery<School>({
    queryKey: ["publicSchool", schoolSlug],
    queryFn: async () => {
      if (!schoolSlug) throw new Error("School identifier missing");
      const res = await publicApi.get(`/public/schools/${schoolSlug}/`);
      return res.data;
    },
    enabled: !!schoolSlug,
    retry: false,
  });

  // ─── Fetch Grade Levels (public) ───────────────────────────────────────────
  const { data: gradeLevels = [], isLoading: gradesLoading } = useQuery<GradeLevel[]>({
    queryKey: ["publicGradeLevels", school?.id],
    queryFn: async () => {
      if (!school?.id) throw new Error("School not loaded");
      const res = await publicApi.get(`/academics/public/schools/${school.id}/grade-levels/`);
      console.log(res.data);

      return res.data || [];
    },
    enabled: !!school?.id && !schoolLoading,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: "",
      middle_name: "",
      last_name: "",
      preferred_name: "",
      gender: "",
      date_of_birth: "",
      nationality: "",
      passport_number: "",
      class_applied: "",
      primary_guardian_name: "",
      primary_guardian_phone: "",
      primary_guardian_email: "",
      primary_guardian_relationship: "",
      primary_guardian_id_number: "",
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

  const { control, getValues, formState: { errors, isValid }, trigger } = form;

  // ─── Save / Submit Mutation (public endpoints) ─────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async ({ fd, id }: { fd: FormData; id?: string }) => {
      if (!school?.id) throw new Error("School not available");

      fd.append("school", school.id);

      let res;
      if (id) {
        res = await publicApi.patch(`/admissions/public/applications/${id}/update/`, fd);
      } else {
        res = await publicApi.post("/admissions/public/applications/submit/", fd);
      }

      return res.data;
    },
    onSuccess: (response, { id }) => {
      const appId = response?.id || id;
      if (!appId) {
        toast.warning("Saved, but no reference ID received");
        return;
      }

      setSavedAppId(appId);
      queryClient.invalidateQueries({ queryKey: ["applications"] }); // optional

      if (response.status === "DRAFT") {
        toast.success("Draft saved", {
          description: `ID: ${appId} — you can continue later`,
        });
      } else {
        toast.success("Application submitted successfully!");
        setIsFinalSubmitted(true);
      }
    },
    onError: (err: any) => {
      toast.error("Failed to save application", {
        description: err?.response?.data?.detail || err.message || "Unknown error",
      });
    },
  });

  const handleAction = async (action: "draft" | "submit") => {
    if (action === "submit") {
      const valid = await trigger();
      if (!valid) {
        toast.error("Please complete all required fields");
        document.querySelector(".text-red-500")?.scrollIntoView({ behavior: "smooth", block: "center" });
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

    fd.append("status", action === "draft" ? "DRAFT" : "SUBMITTED");

    saveMutation.mutate({ fd, id: savedAppId ?? undefined });
  };

  // ─── Loading / Error States ────────────────────────────────────────────────
  if (schoolLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (schoolError || !school) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            {schoolError?.message || "School not found. Please check the link."}
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-6" asChild>
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    );
  }

  // ─── Main Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm border">
        <div className="px-6 py-4 border-b bg-blue-50 flex justify-between items-center">
          <p className="text-blue-800 font-medium">
            Applying to: <span className="font-semibold">{school.name}</span>
          </p>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">Back to website</Link>
          </Button>
        </div>

        {savedAppId && !isFinalSubmitted && (
          <Alert className="mx-6 mt-4 bg-green-50 border-green-200">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <AlertDescription className="text-green-800">
              Draft saved (ID: <strong>{savedAppId}</strong>). You can continue editing or submit when ready.
            </AlertDescription>
          </Alert>
        )}

        {isFinalSubmitted ? (
          <div className="p-12 text-center space-y-6">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" />
            <h2 className="text-2xl font-bold text-green-800">Thank You!</h2>
            <p className="text-lg text-gray-700">
              Your application has been successfully submitted.
            </p>
            <p className="text-gray-600">
              Reference ID: <strong>{savedAppId || "—"}</strong>
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" asChild>
                <Link href="/">Return to Home</Link>
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

              {/* Student */}
              <TabsContent value="Student" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>First Name *</Label>
                    <Controller name="first_name" control={control} render={({ field }) => <Input {...field} />} />
                    {errors.first_name && <p className="text-red-500 text-sm mt-1">{errors.first_name.message}</p>}
                  </div>
                  <div>
                    <Label>Middle Name</Label>
                    <Controller name="middle_name" control={control} render={({ field }) => <Input {...field} />} />
                  </div>
                  <div>
                    <Label>Last Name *</Label>
                    <Controller name="last_name" control={control} render={({ field }) => <Input {...field} />} />
                    {errors.last_name && <p className="text-red-500 text-sm mt-1">{errors.last_name.message}</p>}
                  </div>
                  <div>
                    <Label>Preferred Name</Label>
                    <Controller name="preferred_name" control={control} render={({ field }) => <Input {...field} />} />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <Controller
                      name="gender"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MALE">Male</SelectItem>
                            <SelectItem value="FEMALE">Female</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div>
                    <Label>Date of Birth</Label>
                    <Controller name="date_of_birth" control={control} render={({ field }) => <Input type="date" {...field} />} />
                  </div>
                  <div>
                    <Label>Nationality *</Label>
                    <Controller name="nationality" control={control} render={({ field }) => <Input {...field} />} />
                    {errors.nationality && <p className="text-red-500 text-sm mt-1">{errors.nationality.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <Label>Class / Grade Applied *</Label>
                    <Controller
                      name="class_applied"
                      control={control}
                      render={({ field }) => {
                        // Ensure value is always string (convert number → string if needed)
                        const selectedValue = field.value ? String(field.value) : "";

                        console.log("Current form value for class_applied:", field.value, typeof field.value);
                        console.log("Selected value passed to Select:", selectedValue);

                        return (
                          <div>
                            <Select
                              onValueChange={(val) => {
                                console.log("User selected:", val, typeof val);
                                field.onChange(val);           // val is always string from shadcn
                                trigger("class_applied");      // force immediate validation
                              }}
                              value={selectedValue}            // always string
                              disabled={gradesLoading}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue
                                  placeholder={gradesLoading ? "Loading grades..." : "Select class/grade"}
                                />
                              </SelectTrigger>

                              <SelectContent>
                                {gradesLoading ? (
                                  <div className="p-4 text-center flex items-center justify-center">
                                    <Loader className="h-4 w-4 animate-spin mr-2" />
                                    Loading...
                                  </div>
                                ) : gradeLevels.length === 0 ? (
                                  <div className="p-4 text-center text-muted-foreground">
                                    No grades available
                                  </div>
                                ) : (
                                  gradeLevels.map((grade) => {
                                    // Convert grade.id to string for value
                                    const gradeIdStr = String(grade.id);
                                    return (
                                      <SelectItem
                                        key={gradeIdStr}
                                        value={gradeIdStr}
                                      >
                                        {grade.name}
                                        {grade.short_name && ` (${grade.short_name})`}
                                      </SelectItem>
                                    );
                                  })
                                )}
                              </SelectContent>
                            </Select>

                            {errors.class_applied && (
                              <p className="text-red-500 text-sm mt-1">
                                {errors.class_applied.message || "Please select a valid class/grade"}
                              </p>
                            )}
                          </div>
                        );
                      }}
                    />
                    {errors.class_applied && (
                      <p className="text-red-500 text-sm mt-1">{errors.class_applied.message}</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Guardian */}
              <TabsContent value="Guardian" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <Label>Primary Guardian Name *</Label>
                    <Controller name="primary_guardian_name" control={control} render={({ field }) => <Input {...field} />} />
                    {errors.primary_guardian_name && <p className="text-red-500 text-sm mt-1">{errors.primary_guardian_name.message}</p>}
                  </div>
                  <div>
                    <Label>Relationship *</Label>
                    <Controller name="primary_guardian_relationship" control={control} render={({ field }) => <Input {...field} />} />
                    {errors.primary_guardian_relationship && <p className="text-red-500 text-sm mt-1">{errors.primary_guardian_relationship.message}</p>}
                  </div>
                  <div>
                    <Label>Phone Number *</Label>
                    <Controller name="primary_guardian_phone" control={control} render={({ field }) => <Input type="tel" {...field} />} />
                    {errors.primary_guardian_phone && <p className="text-red-500 text-sm mt-1">{errors.primary_guardian_phone.message}</p>}
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
              <TabsContent value="Additional Info" className="space-y-6">
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
                          <p className="text-xs text-blue-600 mb-1">
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
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
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
                    onFilesChange={setDocuments}
                    initialFiles={documents}
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
                    onClick={() => setCurrentStep((prev) => prev - 1)}
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
                  disabled={saveMutation.isPending}
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
                  <Button type="button" onClick={() => setCurrentStep((prev) => prev + 1)}>
                    Next
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => handleAction("submit")}
                    disabled={!isValid || saveMutation.isPending}
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

            {!isValid && currentStep === steps.length - 1 && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>
                  Some required fields are missing. Please review all tabs.
                </AlertDescription>
              </Alert>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

// "use client";

// import { useState } from "react";
// import { useParams, useRouter } from "next/navigation";
// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import { useForm, Controller } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import * as z from "zod";
// import publicApi from "@/utils/publicApi";
// import { toast } from "sonner";
// import DocumentUpload from "@/components/DocumentUpload";
// import {
//   Tabs,
//   TabsList,
//   TabsTrigger,
//   TabsContent,
// } from "@/components/ui/tabs";
// import { Input } from "@/components/ui/input";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Label } from "@/components/ui/label";
// import { Button } from "@/components/ui/button";
// import { Alert, AlertDescription } from "@/components/ui/alert";
// import { Loader, CheckCircle2 } from "lucide-react";
// import Link from "next/link";

// // DocumentFile type
// interface DocumentFile {
//   id?: string;
//   name: string;
//   url?: string;
//   file?: File;
//   description?: string;
//   size?: number;
// }

// // Form schema (unchanged)
// const formSchema = z.object({
//   first_name: z.string().min(1, "First name is required"),
//   middle_name: z.string().optional(),
//   last_name: z.string().min(1, "Last name is required"),
//   preferred_name: z.string().optional(),
//   gender: z.enum(["MALE", "FEMALE", "OTHER", ""]).optional(),
//   date_of_birth: z.string().optional(),
//   nationality: z.string().min(1, "Nationality is required"),
//   passport_number: z.string().optional(),
//   class_applied: z.string().min(1, "Class/Grade is required"),
//   primary_guardian_name: z.string().min(1, "Guardian name is required"),
//   primary_guardian_phone: z.string().min(9, "Valid phone number required"),
//   primary_guardian_email: z.string().email("Invalid email").optional(),
//   primary_guardian_relationship: z.string().min(1, "Relationship is required"),
//   primary_guardian_id_number: z.string().optional(),
//   address: z.string().optional(),
//   region: z.string().optional(),
//   district: z.string().optional(),
//   previous_school: z.string().optional(),
//   religion: z.string().optional(),
//   category: z.string().optional(),
//   placement_type: z.enum(["SELF", "PUBLIC", "TRANSFER", "OTHER"]).optional(),
//   blood_group: z.string().optional(),
//   allergies: z.string().optional(),
//   chronic_conditions: z.string().optional(),
//   disability: z.string().optional(),
//   emergency_contact_name: z.string().optional(),
//   emergency_contact_phone: z.string().optional(),
//   emergency_relationship: z.string().optional(),
//   notes: z.string().optional(),
//   photo: z.any().optional(),
// });

// type FormValues = z.infer<typeof formSchema>;

// interface GradeLevel {
//   id: string;
//   name: string;
//   short_name?: string;
// }

// interface School {
//   id: string;
//   name: string;
//   slug?: string;
// }

// // Main Component
// export default function PublicNewApplicationPage() {
//   const router = useRouter();
//   const { schoolSlug } = useParams<{ schoolSlug: string }>();
//   const queryClient = useQueryClient();

//   const [currentStep, setCurrentStep] = useState(0);
//   const [documents, setDocuments] = useState<DocumentFile[]>([]);
//   const [isFinalSubmitted, setIsFinalSubmitted] = useState(false);
//   const [savedAppId, setSavedAppId] = useState<string | null>(null);

//   const steps = ["Student", "Guardian", "Additional Info", "Documents"];

//   // Fetch School
//   const {
//     data: school,
//     isLoading: schoolLoading,
//     error: schoolError,
//   } = useQuery<School>({
//     queryKey: ["publicSchool", schoolSlug],
//     queryFn: async () => {
//       if (!schoolSlug) throw new Error("School identifier missing");
//       const res = await publicApi.get(`/public/schools/${schoolSlug}/`);
//       return res.data;
//     },
//     enabled: !!schoolSlug,
//   });

//   // Fetch Grade Levels
//   const { data: gradeLevels = [], isLoading: gradesLoading } = useQuery<GradeLevel[]>({
//     queryKey: ["publicGradeLevels", school?.id],
//     queryFn: async () => {
//       if (!school?.id) throw new Error("School not loaded");
//       const res = await publicApi.get(`/academics/public/schools/${school.id}/grade-levels/`);
//       return res.data || [];
//     },
//     enabled: !!school?.id && !schoolLoading,
//   });

//   const form = useForm<FormValues>({
//     resolver: zodResolver(formSchema),
//     defaultValues: {
//       first_name: "",
//       middle_name: "",
//       last_name: "",
//       preferred_name: "",
//       gender: "",
//       date_of_birth: "",
//       nationality: "",
//       passport_number: "",
//       class_applied: "",
//       primary_guardian_name: "",
//       primary_guardian_phone: "",
//       primary_guardian_email: "",
//       primary_guardian_relationship: "",
//       primary_guardian_id_number: "",
//       address: "",
//       region: "",
//       district: "",
//       previous_school: "",
//       religion: "",
//       category: "",
//       placement_type: "SELF",
//       blood_group: "",
//       allergies: "",
//       chronic_conditions: "",
//       disability: "",
//       emergency_contact_name: "",
//       emergency_contact_phone: "",
//       emergency_relationship: "",
//       notes: "",
//       photo: undefined,
//     },
//     mode: "onChange",
//   });

//   const { control, getValues, formState: { errors, isValid }, trigger } = form;

//   // ─── Save / Submit Mutation ─────────────────────────────────────────────────
//   const saveMutation = useMutation({
//     mutationFn: async ({ fd, id }: { fd: FormData; id?: string }) => {
//       if (!school?.id) throw new Error("School not available");

//       fd.append("school", school.id);

//       let res;
//       if (id) {
//         res = await publicApi.patch(`/admissions/public/applications/${id}/update/`, fd);
//       } else {
//         res = await publicApi.post("/admissions/public/applications/submit/", fd);
//       }

//       return res.data;
//     },
//     onSuccess: (response, { id }) => {
//       const appId = response?.id || id;
//       if (!appId) {
//         toast.warning("Saved, but no reference ID received");
//         return;
//       }

//       setSavedAppId(appId);

//       if (response.status === "DRAFT") {
//         toast.success("Draft saved", {
//           description: `ID: ${appId} — you can continue later`,
//         });
//       } else {
//         toast.success("Application submitted successfully!");
//         setIsFinalSubmitted(true);
//       }
//     },
//     onError: (err: any) => {
//       toast.error("Failed to save application", {
//         description: err?.response?.data?.detail || err.message || "Unknown error",
//       });
//     },
//   });

//   const handleAction = async (action: "draft" | "submit") => {
//     if (action === "submit") {
//       const valid = await trigger();
//       if (!valid) {
//         toast.error("Please complete all required fields");
//         document.querySelector(".text-red-500")?.scrollIntoView({ behavior: "smooth", block: "center" });
//         return;
//       }
//     }

//     const values = getValues();
//     const fd = new FormData();

//     Object.entries(values).forEach(([key, value]) => {
//       if (value !== undefined && value !== "" && key !== "photo") {
//         fd.append(key, String(value));
//       }
//     });

//     if (values.photo instanceof File) fd.append("photo", values.photo);

//     // Only send NEW supporting documents (deduplicated by name + size)
//     const newDocsToSend = documents
//       .filter((doc) => doc.file instanceof File)
//       .reduce((acc: DocumentFile[], doc) => {
//         // Prevent duplicates by checking name + size
//         const exists = acc.some(
//           (d) => d.name === doc.name && d.size === doc.size
//         );
//         if (!exists) acc.push(doc);
//         return acc;
//       }, []);

//     newDocsToSend.forEach((doc) => fd.append("documents", doc.file!));

//     fd.append("status", action === "draft" ? "DRAFT" : "SUBMITTED");

//     saveMutation.mutate({ fd, id: savedAppId ?? undefined });
//   };

//   // ─── Loading / Error States ─────────────────────────────────────────────────
//   if (schoolLoading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center">
//         <Loader className="h-10 w-10 animate-spin" />
//       </div>
//     );
//   }

//   if (schoolError || !school) {
//     return (
//       <div className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
//         <Alert variant="destructive" className="max-w-md">
//           <AlertDescription>
//             {schoolError?.message || "School not found. Please check the link."}
//           </AlertDescription>
//         </Alert>
//         <Button variant="outline" className="mt-6" asChild>
//           <Link href="/">Back to Home</Link>
//         </Button>
//       </div>
//     );
//   }

//   // ─── Main Render ────────────────────────────────────────────────────────────
//   return (
//     <div className="min-h-screen bg-gray-50 p-6">
//       <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm border">
//         <div className="px-6 py-4 border-b bg-blue-50 flex justify-between items-center">
//           <p className="text-blue-800 font-medium">
//             Applying to: <span className="font-semibold">{school.name}</span>
//           </p>
//           <Button variant="ghost" size="sm" asChild>
//             <Link href="/">Back to website</Link>
//           </Button>
//         </div>

//         {savedAppId && !isFinalSubmitted && (
//           <Alert className="mx-6 mt-4 bg-green-50 border-green-200">
//             <CheckCircle2 className="h-5 w-5 text-green-600" />
//             <AlertDescription className="text-green-800">
//               Draft saved (ID: <strong>{savedAppId}</strong>). You can continue editing or submit when ready.
//             </AlertDescription>
//           </Alert>
//         )}

//         {isFinalSubmitted ? (
//           <div className="p-12 text-center space-y-6">
//             <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" />
//             <h2 className="text-2xl font-bold text-green-800">Thank You!</h2>
//             <p className="text-lg text-gray-700">
//               Your application has been successfully submitted.
//             </p>
//             <p className="text-gray-600">
//               Reference ID: <strong>{savedAppId || "—"}</strong>
//             </p>
//             <div className="flex justify-center gap-4">
//               <Button variant="outline" asChild>
//                 <Link href="/">Return to Home</Link>
//               </Button>
//               <Button onClick={() => window.location.reload()}>
//                 Start New Application
//               </Button>
//             </div>
//           </div>
//         ) : (
//           <form className="p-6 space-y-8">
//             <Tabs
//               value={steps[currentStep]}
//               onValueChange={(val) => {
//                 const idx = steps.indexOf(val);
//                 if (idx !== -1) setCurrentStep(idx);
//               }}
//             >
//               <TabsList className="grid w-full grid-cols-4 gap-2 mb-6">
//                 {steps.map((step) => (
//                   <TabsTrigger key={step} value={step}>
//                     {step}
//                   </TabsTrigger>
//                 ))}
//               </TabsList>

//               {/* Student Tab */}
//               <TabsContent value="Student" className="space-y-6">
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                   <div>
//                     <Label>First Name *</Label>
//                     <Controller name="first_name" control={control} render={({ field }) => <Input {...field} />} />
//                     {errors.first_name && <p className="text-red-500 text-sm mt-1">{errors.first_name.message}</p>}
//                   </div>
//                   <div>
//                     <Label>Middle Name</Label>
//                     <Controller name="middle_name" control={control} render={({ field }) => <Input {...field} />} />
//                   </div>
//                   <div>
//                     <Label>Last Name *</Label>
//                     <Controller name="last_name" control={control} render={({ field }) => <Input {...field} />} />
//                     {errors.last_name && <p className="text-red-500 text-sm mt-1">{errors.last_name.message}</p>}
//                   </div>
//                   <div>
//                     <Label>Preferred Name</Label>
//                     <Controller name="preferred_name" control={control} render={({ field }) => <Input {...field} />} />
//                   </div>
//                   <div>
//                     <Label>Gender</Label>
//                     <Controller
//                       name="gender"
//                       control={control}
//                       render={({ field }) => (
//                         <Select onValueChange={field.onChange} value={field.value ?? ""}>
//                           <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
//                           <SelectContent>
//                             <SelectItem value="MALE">Male</SelectItem>
//                             <SelectItem value="FEMALE">Female</SelectItem>
//                             <SelectItem value="OTHER">Other</SelectItem>
//                           </SelectContent>
//                         </Select>
//                       )}
//                     />
//                   </div>
//                   <div>
//                     <Label>Date of Birth</Label>
//                     <Controller name="date_of_birth" control={control} render={({ field }) => <Input type="date" {...field} />} />
//                   </div>
//                   <div>
//                     <Label>Nationality *</Label>
//                     <Controller name="nationality" control={control} render={({ field }) => <Input {...field} />} />
//                     {errors.nationality && <p className="text-red-500 text-sm mt-1">{errors.nationality.message}</p>}
//                   </div>
//                   <div className="md:col-span-2">
//                     <Label>Class / Grade Applied *</Label>
//                     <Controller
//                       name="class_applied"
//                       control={control}
//                       render={({ field }) => {
//                         const selectedValue = field.value ? String(field.value) : "";
//                         return (
//                           <div>
//                             <Select
//                               onValueChange={(val) => {
//                                 field.onChange(val);
//                                 trigger("class_applied");
//                               }}
//                               value={selectedValue}
//                               disabled={gradesLoading}
//                             >
//                               <SelectTrigger className="w-full">
//                                 <SelectValue placeholder={gradesLoading ? "Loading grades..." : "Select class/grade"} />
//                               </SelectTrigger>
//                               <SelectContent>
//                                 {gradesLoading ? (
//                                   <div className="p-4 text-center flex items-center justify-center">
//                                     <Loader className="h-4 w-4 animate-spin mr-2" />
//                                     Loading...
//                                   </div>
//                                 ) : gradeLevels.length === 0 ? (
//                                   <div className="p-4 text-center text-muted-foreground">
//                                     No grades available
//                                   </div>
//                                 ) : (
//                                   gradeLevels.map((grade) => (
//                                     <SelectItem key={grade.id} value={String(grade.id)}>
//                                       {grade.name}{grade.short_name && ` (${grade.short_name})`}
//                                     </SelectItem>
//                                   ))
//                                 )}
//                               </SelectContent>
//                             </Select>
//                             {errors.class_applied && (
//                               <p className="text-red-500 text-sm mt-1">{errors.class_applied.message}</p>
//                             )}
//                           </div>
//                         );
//                       }}
//                     />
//                   </div>
//                 </div>
//               </TabsContent>

//               {/* Guardian Tab */}
//               <TabsContent value="Guardian" className="space-y-6">
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                   <div className="md:col-span-2">
//                     <Label>Primary Guardian Name *</Label>
//                     <Controller name="primary_guardian_name" control={control} render={({ field }) => <Input {...field} />} />
//                     {errors.primary_guardian_name && <p className="text-red-500 text-sm mt-1">{errors.primary_guardian_name.message}</p>}
//                   </div>
//                   <div>
//                     <Label>Relationship *</Label>
//                     <Controller name="primary_guardian_relationship" control={control} render={({ field }) => <Input {...field} />} />
//                     {errors.primary_guardian_relationship && <p className="text-red-500 text-sm mt-1">{errors.primary_guardian_relationship.message}</p>}
//                   </div>
//                   <div>
//                     <Label>Phone Number *</Label>
//                     <Controller name="primary_guardian_phone" control={control} render={({ field }) => <Input type="tel" {...field} />} />
//                     {errors.primary_guardian_phone && <p className="text-red-500 text-sm mt-1">{errors.primary_guardian_phone.message}</p>}
//                   </div>
//                   <div>
//                     <Label>Email</Label>
//                     <Controller name="primary_guardian_email" control={control} render={({ field }) => <Input type="email" {...field} />} />
//                   </div>
//                   <div>
//                     <Label>ID / Passport Number</Label>
//                     <Controller name="primary_guardian_id_number" control={control} render={({ field }) => <Input {...field} />} />
//                   </div>
//                   <div className="md:col-span-2">
//                     <Label>Address</Label>
//                     <Controller name="address" control={control} render={({ field }) => <Input {...field} placeholder="Street, building, etc." />} />
//                   </div>
//                   <div>
//                     <Label>Region / Province / State</Label>
//                     <Controller name="region" control={control} render={({ field }) => <Input {...field} />} />
//                   </div>
//                   <div>
//                     <Label>District / City</Label>
//                     <Controller name="district" control={control} render={({ field }) => <Input {...field} />} />
//                   </div>
//                 </div>
//               </TabsContent>

//               {/* Additional Info Tab */}
//               <TabsContent value="Additional Info" className="space-y-6">
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                   <div>
//                     <Label>Previous School</Label>
//                     <Controller name="previous_school" control={control} render={({ field }) => <Input {...field} />} />
//                   </div>
//                   <div>
//                     <Label>Religion</Label>
//                     <Controller name="religion" control={control} render={({ field }) => <Input {...field} />} />
//                   </div>
//                   <div>
//                     <Label>Category (optional)</Label>
//                     <Controller name="category" control={control} render={({ field }) => <Input {...field} placeholder="e.g. General, Scholarship" />} />
//                   </div>
//                   <div>
//                     <Label>Placement Type</Label>
//                     <Controller
//                       name="placement_type"
//                       control={control}
//                       render={({ field }) => (
//                         <Select onValueChange={field.onChange} value={field.value}>
//                           <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
//                           <SelectContent>
//                             <SelectItem value="SELF">Self / Parent Application</SelectItem>
//                             <SelectItem value="PUBLIC">Government / Public Authority</SelectItem>
//                             <SelectItem value="TRANSFER">Transfer from Another School</SelectItem>
//                             <SelectItem value="OTHER">Other</SelectItem>
//                           </SelectContent>
//                         </Select>
//                       )}
//                     />
//                   </div>
//                   <div>
//                     <Label>Blood Group</Label>
//                     <Controller
//                       name="blood_group"
//                       control={control}
//                       render={({ field }) => (
//                         <Select onValueChange={field.onChange} value={field.value}>
//                           <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
//                           <SelectContent>
//                             {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
//                               <SelectItem key={bg} value={bg}>{bg}</SelectItem>
//                             ))}
//                           </SelectContent>
//                         </Select>
//                       )}
//                     />
//                   </div>
//                   <div className="md:col-span-2">
//                     <Label>Allergies / Medical Conditions</Label>
//                     <Controller name="allergies" control={control} render={({ field }) => <Input {...field} placeholder="e.g. nuts, penicillin" />} />
//                   </div>
//                   <div className="md:col-span-2">
//                     <Label>Chronic Conditions / Disabilities</Label>
//                     <Controller name="chronic_conditions" control={control} render={({ field }) => <Input {...field} placeholder="e.g. asthma, epilepsy" />} />
//                   </div>
//                   <div className="md:col-span-2">
//                     <Label>Emergency Contact (if different from guardian)</Label>
//                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
//                       <div>
//                         <Label className="text-sm">Name</Label>
//                         <Controller name="emergency_contact_name" control={control} render={({ field }) => <Input {...field} />} />
//                       </div>
//                       <div>
//                         <Label className="text-sm">Phone</Label>
//                         <Controller name="emergency_contact_phone" control={control} render={({ field }) => <Input type="tel" {...field} />} />
//                       </div>
//                       <div>
//                         <Label className="text-sm">Relationship</Label>
//                         <Controller name="emergency_relationship" control={control} render={({ field }) => <Input {...field} />} />
//                       </div>
//                     </div>
//                   </div>
//                   <div className="md:col-span-2">
//                     <Label>Additional Notes</Label>
//                     <Controller name="notes" control={control} render={({ field }) => <Input {...field} placeholder="Any other relevant information..." />} />
//                   </div>
//                 </div>
//               </TabsContent>

//               {/* Documents Tab */}
//              <TabsContent value="Documents" className="space-y-6">
//                 <div>
//                   <Label>Passport-size Photo</Label>
//                   <Controller
//                     name="photo"
//                     control={control}
//                     render={({ field: { onChange, value } }) => (
//                       <div className="mt-2">
//                         {value && (
//                           <p className="text-xs text-blue-600 mb-1">
//                             Current: {value instanceof File ? value.name : "Saved Photo"}
//                           </p>
//                         )}
//                         <input
//                           type="file"
//                           accept="image/*"
//                           onChange={(e) => {
//                             const file = e.target.files?.[0];
//                             if (file) onChange(file);
//                           }}
//                           className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
//                         />
//                       </div>
//                     )}
//                   />
//                 </div>

//                 <div>
//                   <Label>Supporting Documents</Label>
//                   <p className="text-sm text-muted-foreground mb-3">
//                     Birth certificate, immunization records, previous reports, transfer letter, etc.
//                   </p>
//                   <DocumentUpload
//                     onFilesChange={(newFiles) => {
//                       // Deduplicate by name + size to prevent adding the same file twice
//                       setDocuments((prev) => {
//                         const existingBackend = prev.filter((d) => !d.file); // keep saved ones
//                         const existingNames = new Set(
//                           prev.map((d) => `${d.name}|${d.size || 0}`)
//                         );

//                         const uniqueNew = newFiles.filter((f) => {
//                           const key = `${f.name}|${f.size}`;
//                           if (existingNames.has(key)) return false;
//                           existingNames.add(key);
//                           return true;
//                         });

//                         return [
//                           ...existingBackend,
//                           ...uniqueNew.map((f) => ({
//                             name: f.name,
//                             file: f,
//                             size: f.size,
//                           })),
//                         ];
//                       });
//                     }}
//                     initialFiles={documents}
//                   />
//                 </div>
//               </TabsContent>
//             </Tabs>

//             <div className="flex justify-between pt-6 border-t">
//               <div>
//                 {currentStep > 0 && (
//                   <Button
//                     type="button"
//                     variant="outline"
//                     onClick={() => setCurrentStep((prev) => prev - 1)}
//                     disabled={saveMutation.isPending}
//                   >
//                     Back
//                   </Button>
//                 )}
//               </div>

//               <div className="flex gap-4">
//                 <Button
//                   type="button"
//                   variant="outline"
//                   onClick={() => handleAction("draft")}
//                   disabled={saveMutation.isPending}
//                 >
//                   {saveMutation.isPending ? (
//                     <>
//                       <Loader className="mr-2 h-4 w-4 animate-spin" />
//                       Saving...
//                     </>
//                   ) : (
//                     "Save as Draft"
//                   )}
//                 </Button>

//                 {currentStep < steps.length - 1 ? (
//                   <Button type="button" onClick={() => setCurrentStep((prev) => prev + 1)}>
//                     Next
//                   </Button>
//                 ) : (
//                   <Button
//                     type="button"
//                     onClick={() => handleAction("submit")}
//                     disabled={!isValid || saveMutation.isPending}
//                   >
//                     {saveMutation.isPending ? (
//                       <>
//                         <Loader className="mr-2 h-4 w-4 animate-spin" />
//                         Submitting...
//                       </>
//                     ) : (
//                       "Submit Application"
//                     )}
//                   </Button>
//                 )}
//               </div>
//             </div>

//             {!isValid && currentStep === steps.length - 1 && (
//               <Alert variant="destructive" className="mt-4">
//                 <AlertDescription>
//                   Some required fields are missing. Please review all tabs.
//                 </AlertDescription>
//               </Alert>
//             )}
//           </form>
//         )}
//       </div>
//     </div>
//   );
// }