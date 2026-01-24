// frontend/(protected)/dashboard/modules/admissions/components/ApplicationForm.tsx
"use client";

import { useForm, Controller, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
import { Info, Loader, Upload } from "lucide-react";
import DocumentUpload from "./DocumentUpload";
import { Application } from "@/types/admission";
import { School } from "@/types/school";

// Zod schema – generalized fields matching updated backend
const formSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, "Last name is required"),
  preferred_name: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", ""]).optional(),
  date_of_birth: z.string().optional(),
  class_applied: z.string().min(1, "Class/Grade is required"),
  primary_guardian_name: z.string().min(1, "Guardian name is required"),
  primary_guardian_phone: z.string().min(9, "Valid phone number required"),
  primary_guardian_email: z.string().email("Invalid email").optional(),
  primary_guardian_relationship: z.string().min(1, "Relationship is required"),
  primary_guardian_id_number: z.string().optional(),
  address: z.string().optional(),
  region: z.string().optional(),           // generalized (county/state/province)
  district: z.string().optional(),         // generalized (sub-county/district)
  previous_school: z.string().optional(),
  nationality: z.string().min(1, "Nationality is required"),
  passport_number: z.string().optional(),
  religion: z.string().optional(),
  category: z.string().optional(),
  learner_id: z.string().optional(),       // e.g. student number, national ID, UPI equivalent
  entry_exam_id: z.string().optional(),    // national/entrance exam ID
  entry_exam_year: z.string().optional(),
  placement_type: z.enum(["SELF", "PUBLIC", "TRANSFER", "OTHER"]).optional(),
  blood_group: z.string().optional(),
  allergies: z.string().optional(),
  chronic_conditions: z.string().optional(),
  disability: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_relationship: z.string().optional(),
  birth_certificate_number: z.string().optional(),
  immunization_status: z.string().optional(),
  notes: z.string().optional(),
  admission_date: z.string().optional(),
  status: z.string().optional(),
  photo: z.any().optional(), 
  pathway: z.string().optional(),             // File
});


type ApplicationFormValues = z.infer<typeof formSchema>;

interface ApplicationFormProps {
  initialData?: Partial<Application>;
  onSubmit: (formData: globalThis.FormData) => void | Promise<void>;
  isDirectEnroll?: boolean;
  school: School | null;
  gradeLevels?: Array<{ id: string | number; name: string; education_level?: string; pathway?: string }>;
}

export default function ApplicationForm({
  initialData = {},
  onSubmit,
  isDirectEnroll = false,
  school,
  gradeLevels: propGradeLevels = [],
}: ApplicationFormProps) {
  // Helper: normalize an education level string into broad categories
  const normalizeEducationLevel = (raw?: string | null) => {
    if (!raw) return "OTHER";
    const r = String(raw).toUpperCase();
    // Common variations
    if (r.includes("PRE") || r.includes("KG") || r.includes("NURS")) return "PRE_PRIMARY";
    if (r.includes("PRIMARY") || r.includes("ELEMENTARY")) return "PRIMARY";
    // CBC Kenya-specific mapping
    if (r.includes("JUNIOR") || r.includes("JSS") || r.includes("JUNIOR SECONDARY") || r.includes("JUNIOR_SECONDARY") ) return "JUNIOR_SECONDARY";
    if (r.includes("SENIOR") || r.includes("SSS") || r.includes("SENIOR SECONDARY") || r.includes("SENIOR_SECONDARY")) return "SENIOR_SECONDARY";
    if (r.includes("MIDDLE") || r.includes("JUNIOR")) return "JUNIOR_SECONDARY";
    if (r.includes("HIGH") || r.includes("SECONDARY") || r.includes("SHS")) return "SENIOR_SECONDARY";
    // Fallback
    return r;
  };

  // Helper: friendly label for a grade's education level tailored to school's curriculum
  const friendlyLevelLabel = (education_level?: string | null) => {
    const normalized = normalizeEducationLevel(education_level);
    switch (normalized) {
      case "PRE_PRIMARY":
        return "Pre-primary";
      case "PRIMARY":
        return "Primary / Elementary";
      case "JUNIOR_SECONDARY":
        return "Junior Secondary / Middle";
      case "SENIOR_SECONDARY":
        return "Senior Secondary / High";
      default:
        // If backend uses 'ELEMENTARY' or 'HIGH' return capitalized
        return education_level ? String(education_level) : "";
    }
  };

  // Determine school's curriculum identifier (best-effort). Backend may expose `curriculum` or `education_system`.
  const schoolCurriculum = (((school as { curriculum?: string; education_system?: string; curriculum_type?: string })?.curriculum || (school as { curriculum?: string; education_system?: string; curriculum_type?: string })?.education_system || (school as { curriculum?: string; education_system?: string; curriculum_type?: string })?.curriculum_type || "GENERAL").toString().toUpperCase());

  // Friendly pathway label and pathway options depending on curriculum
  const friendlyPathwayLabel = (p?: string | null) => {
    if (!p) return "General / Undecided";
    const code = String(p).toUpperCase();
    switch (code) {
      case "GENERAL":
        return "General / Undecided";
      case "STEM":
        return "STEM / Sciences";
      case "ARTS":
        return "Arts / Humanities";
      case "VOCATIONAL":
        return "Vocational / Technical";
      case "IB":
        return "IB (International Baccalaureate)";
      case "AL":
      case "A_LEVELS":
        return "A-Levels";
      case "AMERICAN":
        return "American Diploma";
      default:
        return String(p);
    }
  };

  const pathwayOptions = (() => {
    // Default neutral options
    const base = [
      { value: "GENERAL", label: "General / Undecided" },
      { value: "STEM", label: "STEM / Sciences" },
      { value: "ARTS", label: "Arts / Humanities" },
      { value: "VOCATIONAL", label: "Vocational / Technical" },
      { value: "OTHER", label: "Other / Custom" },
    ];

    if (schoolCurriculum.includes("CBC") || schoolCurriculum.includes("KENYA")) {
      // CBC emphasises Junior / Senior secondary — pathways still map to STEM/ARTS/VOCATIONAL
      return base;
    }

    if (schoolCurriculum.includes("IB") || schoolCurriculum.includes("INTERNATIONAL")) {
      return [
        { value: "GENERAL", label: "General / Undecided" },
        { value: "IB", label: "IB (International Baccalaureate)" },
        { value: "A_LEVELS", label: "A-Levels" },
        { value: "AMERICAN", label: "American Diploma" },
        { value: "VOCATIONAL", label: "Vocational / Technical" },
      ];
    }

    // Fallback to base
    return base;
  })();
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: initialData.first_name || "",
      middle_name: initialData.middle_name || "",
      last_name: initialData.last_name || "",
      preferred_name: initialData.preferred_name || "",
      gender: (initialData.gender || "") as "" | "MALE" | "FEMALE" | "OTHER" | undefined,
      date_of_birth: initialData.date_of_birth || "",
      class_applied: ((initialData as { class_applied?: { id: string | number } }).class_applied?.id?.toString() || ""),
      primary_guardian_name: initialData.primary_guardian_name || "",
      primary_guardian_phone: initialData.primary_guardian_phone || "",
      primary_guardian_email: initialData.primary_guardian_email || "",
      primary_guardian_relationship: initialData.primary_guardian_relationship || "",
      primary_guardian_id_number: initialData.primary_guardian_id_number || "",
      address: initialData.address || "",
      region: initialData.region || "",
      district: initialData.district || "",
      previous_school: initialData.previous_school || "",
      nationality: initialData.nationality || "",
      passport_number: initialData.passport_number || "",
      religion: initialData.religion || "NONE",
      category: initialData.category || "",
      learner_id: initialData.learner_id || "",
      entry_exam_id: initialData.entry_exam_id || "",
      entry_exam_year: initialData.entry_exam_year?.toString() || "",
      placement_type: initialData.placement_type || "SELF",
      blood_group: initialData.blood_group || "",
      allergies: initialData.allergies || "",
      chronic_conditions: initialData.chronic_conditions || "",
      disability: initialData.disability || "",
      emergency_contact_name: initialData.emergency_contact_name || "",
      emergency_contact_phone: initialData.emergency_contact_phone || "",
      emergency_relationship: initialData.emergency_relationship || "",
      birth_certificate_number: initialData.birth_certificate_number || "",
      immunization_status: initialData.immunization_status || "",
      notes: initialData.notes || "",
      admission_date: initialData.admission_date || "",
      status: initialData.status || (isDirectEnroll ? "ACCEPTED" : "DRAFT"),
      pathway: ((initialData as { pathway?: string }).pathway || "GENERAL"),
    },
  });

  const [documents, setDocuments] = useState<File[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Watch selected class
  const selectedClassId = useWatch({ control, name: "class_applied" });

  // Grade levels query
  const { data: fetchedGradeLevels = [], isLoading: gradesLoading } = useQuery<{ id: string | number; name: string; education_level?: string; pathway?: string }[]>({
    queryKey: ["gradeLevels", school?.id],
    queryFn: async () => {
      if (school?.id) {
        const res = await api.get("/academics/grade-levels/", {
          headers: { "X-School-ID": school.id },
        });
        return res.data;
      }
      return [];
    },
    enabled: propGradeLevels.length === 0 && !!school?.id,
  });

  const finalGradeLevels = propGradeLevels.length > 0 ? propGradeLevels : fetchedGradeLevels;
  // Determine education level from selected class
  const selectedGrade = finalGradeLevels.find((g: { id: string | number; name: string; education_level?: string; pathway?: string }) => String(g.id) === selectedClassId);
  const normalizedLevel = normalizeEducationLevel(selectedGrade?.education_level);
  const pathwayFromGrade = selectedGrade?.pathway || "GENERAL";

  const isHighSchool = normalizedLevel === "SENIOR_SECONDARY" || String(normalizedLevel).includes("HIGH");
  const isPathwayEditable = isHighSchool && pathwayFromGrade === "GENERAL";

  const isPrePrimary = normalizedLevel === "PRE_PRIMARY";
  const isElementary = normalizedLevel === "PRIMARY" || normalizedLevel === "ELEMENTARY" || isPrePrimary;
  const isSecondary = normalizedLevel === "JUNIOR_SECONDARY" || normalizedLevel === "SENIOR_SECONDARY" || String(normalizedLevel).includes("MIDDLE") || String(normalizedLevel).includes("SECONDARY");

  // Auto-adjust placement type for primary levels
  useEffect(() => {
    if (isElementary && !isDirectEnroll) {
      setValue("placement_type", "SELF");
    }
  }, [normalizedLevel, isDirectEnroll, setValue]);

  const onFormSubmit = handleSubmit((data) => {
    const fd = new globalThis.FormData();

    // Append text fields
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && key !== "photo") {
        fd.append(key, String(value));
      }
    });

    // Photo
    if (data.photo instanceof File) {
      fd.append("photo", data.photo);
    }

    // Documents (non-direct only)
    if (!isDirectEnroll) {
      documents.forEach(file => fd.append("documents", file));
    }

    onSubmit(fd);
  });

  // Options (global / neutral)
  const genderOptions = ["MALE", "FEMALE", "OTHER"];
  const relationshipOptions = ["PARENT", "GUARDIAN", "RELATIVE", "OTHER"];
  // const religionOptions = ["CHRISTIAN", "MUSLIM", "HINDU", "BUDDHIST", "JEWISH", "NONE", "OTHER"];
  // const categoryOptions = ["GENERAL", "SCHOLARSHIP", "BURSARY", "SPECIAL_NEEDS", "INTERNATIONAL", "OTHER"];
  const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "UNKNOWN"];
  const placementOptions = ["SELF", "PUBLIC", "TRANSFER", "OTHER"];

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      {/* Header banner */}
      <div className="bg-blue-50 border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-blue-600" />
            <p className="text-sm font-medium text-blue-800">
              Enrolling to: <span className="font-semibold">{school?.name || "Selected School"}</span>
            </p>
          </div>
          {isDirectEnroll && (
            <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full">
              Direct Enrollment
            </span>
          )}
        </div>
      </div>

      <form onSubmit={onFormSubmit} className="p-6 lg:p-8 space-y-10">
        <Tabs defaultValue="student" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-4 gap-2 mb-8">
            <TabsTrigger value="student">Student Details</TabsTrigger>
            <TabsTrigger value="guardian">Guardian & Emergency</TabsTrigger>
            <TabsTrigger value="additional">Academic & Health</TabsTrigger>
            {!isDirectEnroll && <TabsTrigger value="attachments">Documents</TabsTrigger>}
          </TabsList>

          {/* Student Details */}
          <TabsContent value="student">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {genderOptions.map(g => <SelectItem key={g} value={g}>{g || "Prefer not to say"}</SelectItem>)}
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
                <Label>Passport-size Photo</Label>
                <Controller
                  name="photo"
                  control={control}
                  render={({ field: { onChange, ...field } }) => (
                    <div className="space-y-2">
                      <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded border flex items-center gap-2 w-fit">
                        <Upload className="h-4 w-4" />
                        Upload Photo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              onChange(file);
                              setPhotoPreview(URL.createObjectURL(file));
                            }
                          }}
                        />
                      </label>
                      {photoPreview && (
                        <img src={photoPreview} alt="Preview" className="h-24 w-24 object-cover rounded border" />
                      )}
                    </div>
                  )}
                />
              </div>

              <div className="md:col-span-3">
                <Label>Class / Grade Level *</Label>
                <Controller
                  name="class_applied"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Select grade / level" /></SelectTrigger>
                      <SelectContent>
                        {gradesLoading ? (
                          <div className="p-4 text-center"><Loader className="animate-spin mx-auto" /></div>
                        ) : finalGradeLevels.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground">No classes available</div>
                        ) : (
                          finalGradeLevels.map((g: { id: string | number; name: string }) => (
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
            </div>
          </TabsContent>

          {/* Guardian & Emergency */}
          <TabsContent value="guardian">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="md:col-span-3">
                <h3 className="text-lg font-medium mb-4">Primary Guardian</h3>
              </div>

              <div>
                <Label>Full Name *</Label>
                <Controller name="primary_guardian_name" control={control} render={({ field }) => <Input {...field} />} />
              </div>

              <div>
                <Label>Relationship *</Label>
                <Controller
                  name="primary_guardian_relationship"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {relationshipOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Label>Phone Number *</Label>
                <Controller name="primary_guardian_phone" control={control} render={({ field }) => <Input {...field} type="tel" />} />
              </div>

              <div>
                <Label>Email</Label>
                <Controller name="primary_guardian_email" control={control} render={({ field }) => <Input {...field} type="email" />} />
              </div>

              <div>
                <Label>ID / Passport Number</Label>
                <Controller name="primary_guardian_id_number" control={control} render={({ field }) => <Input {...field} />} />
              </div>

              <div className="md:col-span-3 mt-6">
                <h3 className="text-lg font-medium mb-4">Emergency Contact (if different)</h3>
              </div>

              <div>
                <Label>Name</Label>
                <Controller name="emergency_contact_name" control={control} render={({ field }) => <Input {...field} placeholder="Same as guardian if blank" />} />
              </div>

              <div>
                <Label>Phone</Label>
                <Controller name="emergency_contact_phone" control={control} render={({ field }) => <Input {...field} type="tel" />} />
              </div>

              <div>
                <Label>Relationship</Label>
                <Controller name="emergency_relationship" control={control} render={({ field }) => <Input {...field} />} />
              </div>
            </div>
          </TabsContent>

          {/* Academic & Health */}
          <TabsContent value="additional">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="md:col-span-3">
                <h3 className="text-lg font-medium mb-4">
                  {isElementary ? "Entry & Health Information" : "Academic & Placement Information"}
                </h3>
              </div>

              {/* Universal Learner ID */}
              <div className="md:col-span-3">
                <Label>Learner / Student ID {isElementary ? "(Recommended)" : "(Required)"}</Label>
                <Controller name="learner_id" control={control} render={({ field }) => <Input {...field} placeholder="Unique ID from school or education authority" />} />
              </div>

              {/* Entry Exam – only for secondary levels */}
              {isSecondary && (
                <>
                  <div>
                    <Label>Entry / National Exam ID</Label>
                    <Controller name="entry_exam_id" control={control} render={({ field }) => <Input {...field} placeholder="Exam registration number" />} />
                  </div>
                  <div>
                    <Label>Exam Year</Label>
                    <Controller name="entry_exam_year" control={control} render={({ field }) => <Input {...field} type="number" min={2000} max={new Date().getFullYear() + 1} />} />
                  </div>
                </>
              )}

              {/* Placement Type – restrict PUBLIC for primary */}
              <div>
                <Label>Admission Type</Label>
                <Controller
                  name="placement_type"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} disabled={isDirectEnroll || isElementary}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {placementOptions.map(p => (
                          <SelectItem key={p} value={p}>
                            {p === "PUBLIC" ? "Government / Public Authority" : p === "SELF" ? "Parent / Self Application" : p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {isHighSchool && (
                <>
                  <div className="md:col-span-3 mt-6">
                    <h3 className="text-lg font-medium mb-4">Senior Secondary Pathway</h3>
                    <Alert className="mb-4 bg-blue-50 border-blue-200">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        {isPathwayEditable
                          ? "Select the student's intended pathway (can be changed later if needed)."
                          : `Pathway already defined for this grade: ${pathwayFromGrade}`}
                      </AlertDescription>
                    </Alert>
                  </div>

                  <div>
                    <Label>Senior Secondary Pathway {isPathwayEditable ? "" : "(Defined by school)"}</Label>
                    <Controller
                      name="pathway"
                      control={control}
                      render={({ field }) => (
                        isPathwayEditable ? (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select pathway" />
                            </SelectTrigger>
                            <SelectContent>
                              {pathwayOptions.map((opt: { value: string; label: string }) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input value={friendlyPathwayLabel(pathwayFromGrade)} disabled className="bg-gray-100" />
                        )
                      )}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Pathway affects subject combinations and future curriculum tracking.
                    </p>
                  </div>
                </>
              )}

              <div>
                <Label>Previous School / Institution</Label>
                <Controller name="previous_school" control={control} render={({ field }) => <Input {...field} />} />
              </div>

              {/* Primary-specific */}
              {isElementary && (
                <>
                  <div className="md:col-span-3 mt-6">
                    <h3 className="text-lg font-medium mb-4">Entry Requirements (Primary Level)</h3>
                  </div>
                  <div>
                    <Label>Birth Certificate Number {isElementary ? "*" : ""}</Label>
                    <Controller
                      name="birth_certificate_number"
                      control={control}
                      rules={{ required: isElementary ? "Required for primary admission" : false }}
                      render={({ field }) => <Input {...field} placeholder="Birth certificate / registration number" />}
                    />
                    {errors.birth_certificate_number && <p className="text-red-500 text-sm mt-1">{errors.birth_certificate_number.message}</p>}
                  </div>

                  <div className="md:col-span-2">
                    <Label>Immunization / Vaccination Status {isElementary ? "*" : ""}</Label>
                    <Controller
                      name="immunization_status"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="UP_TO_DATE">Up to Date</SelectItem>
                            <SelectItem value="PARTIAL">Partial</SelectItem>
                            <SelectItem value="NOT_IMMUNIZED">Not Immunized</SelectItem>
                            <SelectItem value="UNKNOWN">Unknown</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </>
              )}

              {/* Health – always shown */}
              <div className="md:col-span-3 mt-6">
                <h3 className="text-lg font-medium mb-4">Health Information</h3>
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
                        {bloodGroups.map(bg => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="md:col-span-2">
                <Label>Known Allergies / Medical Conditions</Label>
                <Controller name="allergies" control={control} render={({ field }) => <Textarea {...field} rows={2} placeholder="e.g. nuts, asthma, medication allergies" />} />
              </div>

              <div className="md:col-span-2">
                <Label>Chronic Conditions / Disabilities</Label>
                <Controller name="chronic_conditions" control={control} render={({ field }) => <Textarea {...field} rows={2} placeholder="e.g. diabetes, epilepsy, visual/hearing impairment" />} />
              </div>

              <div className="md:col-span-3">
                <Label>Additional Notes</Label>
                <Controller name="notes" control={control} render={({ field }) => <Textarea {...field} rows={4} placeholder="Any other relevant information..." />} />
              </div>
            </div>
          </TabsContent>

          {!isDirectEnroll && (
            <TabsContent value="attachments">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-3">Upload Supporting Documents</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Birth certificate, passport photo, previous reports, immunization card, ID, etc.
                  </p>
                  <DocumentUpload onFilesChange={setDocuments} initialFiles={((initialData as { documents?: { name: string; url: string }[] }).documents || [])} />
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>

        <div className="pt-8 flex justify-end">
          <Button type="submit" size="lg" disabled={isSubmitting || gradesLoading}>
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader className="h-4 w-4 animate-spin" />
                Processing...
              </span>
            ) : isDirectEnroll ? (
              "Enroll Student Now"
            ) : (
              "Submit Application"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}