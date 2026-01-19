"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/utils/api";
import {
  Building2,
  Calendar,
  GraduationCap,
  DollarSign,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Upload,
  Globe,
  MapPin,
  Phone,
  Mail,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface CurriculumTemplate {
  id: number;
  name: string;
  short_code: string;
  description: string;
}

interface GradeLevelTemplate {
  id: number;
  name: string;
  short_name: string;
  order: number;
}

interface DepartmentTemplate {
  id: number;
  name: string;
  short_name: string;
  code: string;
}

interface FormData {
  schoolName: string;
  shortName: string;
  logo: File | null;
  address: string;
  city: string;
  country: string;
  officialRegistrationNumber: string;
  registrationAuthority: string;
  registrationDate: string;
  phone: string;
  email: string;
  website: string;
  currency: string;
  academicYearStart: string;
  academicYearEnd: string;
  termSystem: "terms" | "semesters";
  numberOfTerms: number;
  gradingSystem: "percentage" | "points" | "grades";
  passingMark: number;
  selectedCurriculumId?: number;
  selectedGradeLevelIds: number[];
  selectedDepartmentIds: number[];
  hasUniformFee: boolean;
  uniformFee: number;
  hasAdmissionFee: boolean;
  admissionFee: number;
  hasTuitionPerTerm: boolean;
  tuitionPerTerm: number;
}

const steps = [
  { id: 1, name: "School Info", icon: Building2 },
  { id: 2, name: "Academic Structure", icon: Calendar },
  { id: 3, name: "Curriculum Setup", icon: GraduationCap },
  { id: 4, name: "Departments & Grades", icon: GraduationCap },
  { id: 5, name: "Fee Setup", icon: DollarSign },
  { id: 6, name: "Complete", icon: CheckCircle },
] as const;

export default function SetupWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewSchoolMode = searchParams.get("mode") === "new";

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dynamic data from backend
  const [curriculumTemplates, setCurriculumTemplates] = useState<CurriculumTemplate[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevelTemplate[]>([]);
  const [departments, setDepartments] = useState<DepartmentTemplate[]>([]);

  const [formData, setFormData] = useState<FormData>({
    schoolName: "",
    shortName: "",
    logo: null,
    address: "",
    city: "",
    country: "Kenya",
    officialRegistrationNumber: "",
    registrationAuthority: "",
    registrationDate: "",
    phone: "",
    email: "",
    website: "",
    currency: "KES",
    academicYearStart: "January",
    academicYearEnd: "December",
    termSystem: "terms",
    numberOfTerms: 3,
    gradingSystem: "percentage",
    passingMark: 50,
    selectedCurriculumId: undefined,
    selectedGradeLevelIds: [],
    selectedDepartmentIds: [],
    hasUniformFee: true,
    uniformFee: 5000,
    hasAdmissionFee: true,
    admissionFee: 10000,
    hasTuitionPerTerm: true,
    tuitionPerTerm: 25000,
  });

  // Fetch curriculum templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await api.get("/academics/curriculum-templates/");
        setCurriculumTemplates(res.data);
      } catch (err) {
        console.error("Failed to load curriculum templates:", err);
        toast.error("Could not load curriculum options");
      }
    };
    fetchTemplates();

    // Load existing school data if editing
    if (!isNewSchoolMode) {
      const loadExisting = async () => {
        try {
          const res = await api.get("/schools/active/");
          console.log("[INIT] Loaded existing school:", res.data.id, res.data.name);
          setSchoolId(res.data.id);
          setFormData((prev) => ({
            ...prev,
            schoolName: res.data.name || prev.schoolName,
            shortName: res.data.short_name || prev.shortName,
            address: res.data.address || prev.address,
            city: res.data.city || prev.city,
            country: res.data.country || prev.country,
            phone: res.data.phone || prev.phone,
            email: res.data.email || prev.email,
            currency: res.data.currency || prev.currency,
          }));
        } catch (err) {
          console.log("[INIT] No existing school - proceeding as new");
        }
      };
      loadExisting();
    }
  }, [isNewSchoolMode]);

  // When user selects curriculum → fetch its grade levels & all global departments
  useEffect(() => {
    if (!formData.selectedCurriculumId) return;

    const fetchStructure = async () => {
      try {
        setIsLoading(true);

        // 1. Grade levels for selected curriculum (templates only)
        const glRes = await api.get("/academics/grade-levels/", {
          params: { curriculum: formData.selectedCurriculumId, school__isnull: true },
        });
        const fetchedGrades = glRes.data;
        setGradeLevels(fetchedGrades);
        // Pre-select all by default
        setFormData((prev) => ({
          ...prev,
          selectedGradeLevelIds: fetchedGrades.map((g: any) => g.id),
        }));

        // 2. All global departments
        const depRes = await api.get("/academics/departments/", {
          params: { school__isnull: true },
        });
        const fetchedDepts = depRes.data;
        setDepartments(fetchedDepts);
        // Pre-select all by default
        setFormData((prev) => ({
          ...prev,
          selectedDepartmentIds: fetchedDepts.map((d: any) => d.id),
        }));
      } catch (err) {
        toast.error("Failed to load grade levels or departments");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    console.log("Selected Curriculum ID:", formData.selectedCurriculumId);
    console.log("Fetched Grades:", gradeLevels);
    console.log("Fetched Departments:", departments);
    fetchStructure();
  }, [formData.selectedCurriculumId]);

  const updateForm = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleGradeLevel = (id: number) => {
    setFormData((prev) => ({
      ...prev,
      selectedGradeLevelIds: prev.selectedGradeLevelIds.includes(id)
        ? prev.selectedGradeLevelIds.filter((g) => g !== id)
        : [...prev.selectedGradeLevelIds, id],
    }));
  };

  const toggleDepartment = (id: number) => {
    setFormData((prev) => ({
      ...prev,
      selectedDepartmentIds: prev.selectedDepartmentIds.includes(id)
        ? prev.selectedDepartmentIds.filter((d) => d !== id)
        : [...prev.selectedDepartmentIds, id],
    }));
  };

  const nextStep = () => {
    if (currentStep === 2 && !formData.selectedCurriculumId) {
      toast.error("Please select a curriculum");
      return;
    }
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  // ─────────────────────────────────────────────────────────────
  // Robust Get-or-Create Helper
  // ─────────────────────────────────────────────────────────────
  const getOrCreateResource = async (
    endpoint: string,
    searchParams: Record<string, any>,
    payload: Record<string, any>
  ): Promise<string> => {
    console.group(`[RESOURCE ${endpoint}]`);
    console.log("Search params:", searchParams);

    // Step 1: Try to find existing
    try {
      const searchRes = await api.get(endpoint, { params: searchParams });
      const count = searchRes.data.results?.length || searchRes.data.length || 0;
      if (count > 0) {
        const foundId = searchRes.data.results?.[0]?.id || searchRes.data[0]?.id;
        console.log(`→ Reusing existing ID: ${foundId}`);
        console.groupEnd();
        return foundId;
      }
    } catch (searchErr: any) {
      console.warn("Search failed:", searchErr?.response?.status, searchErr?.response?.data);
    }

    // Step 2: Create new
    try {
      console.log("Creating new...");
      const createRes = await api.post(endpoint, payload);
      const newId = createRes.data.id;
      console.log(`→ Created new ID: ${newId}`);
      console.groupEnd();
      return newId;
    } catch (createErr: any) {
      console.error("Create failed:", createErr?.response?.data);

      // Handle duplicate gracefully
      if (createErr?.response?.status === 400) {
        const detail = createErr?.response?.data?.non_field_errors?.[0] || "";
        if (detail.includes("unique") || detail.includes("duplicate")) {
          console.warn("Duplicate - retrying search...");
          const retryRes = await api.get(endpoint, { params: searchParams });
          const retryId = retryRes.data.results?.[0]?.id || retryRes.data[0]?.id;
          if (retryId) {
            console.log(`→ Retry found ID: ${retryId}`);
            console.groupEnd();
            return retryId;
          }
        }
      }

      console.groupEnd();
      throw createErr;
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setError(null);

    console.group("=== SETUP WIZARD COMPLETE FLOW ===");
    console.log("Mode:", isNewSchoolMode ? "NEW SCHOOL" : "UPDATE EXISTING");
    console.log("Current schoolId:", schoolId);

    try {
      let currentSchoolId: string;

      // ── SCHOOL CREATION / UPDATE ───────────────────────────────────
      const schoolForm = new FormData();
      schoolForm.append("name", formData.schoolName || "My New School");
      schoolForm.append("short_name", formData.shortName || "MNS");
      schoolForm.append("address", formData.address || "");
      schoolForm.append("city", formData.city || "");
      schoolForm.append("country", formData.country || "Kenya");
      schoolForm.append("official_registration_number", formData.officialRegistrationNumber || "");
      schoolForm.append("registration_authority", formData.registrationAuthority || "");
      schoolForm.append("registration_date", formData.registrationDate || "");
      schoolForm.append("phone", formData.phone || "");
      schoolForm.append("email", formData.email || "");
      schoolForm.append("website", formData.website || "");
      schoolForm.append("currency", formData.currency || "KES");
      schoolForm.append("academic_year_start_month", formData.academicYearStart || "January");
      schoolForm.append("academic_year_end_month", formData.academicYearEnd || "December");
      schoolForm.append("term_system", formData.termSystem || "terms");
      schoolForm.append("number_of_terms", formData.numberOfTerms.toString() || "3");
      schoolForm.append("grading_system", formData.gradingSystem || "percentage");
      schoolForm.append("passing_mark", formData.passingMark.toString() || "50");

      if (formData.logo) {
        console.log("Uploading logo:", formData.logo.name, formData.logo.size);
        schoolForm.append("logo", formData.logo);
      }

      if (isNewSchoolMode || !schoolId) {
        console.log("Creating NEW school...");
        const newSchoolRes = await api.post("/schools/", schoolForm);
        currentSchoolId = newSchoolRes.data.id;
        console.log("→ New school created! ID:", currentSchoolId);
        setSchoolId(currentSchoolId);
      } else {
        console.log("Updating EXISTING school:", schoolId);
        await api.patch(`/schools/${schoolId}/`, schoolForm);
        currentSchoolId = schoolId;
      }

      localStorage.setItem("currentSchoolId", currentSchoolId);
      console.log("→ Saved currentSchoolId to localStorage:", currentSchoolId);

      // ── COPY CURRICULUM TEMPLATE WITH SELECTED GRADES & DEPARTMENTS ──
      if (formData.selectedCurriculumId && (formData.selectedGradeLevelIds.length > 0 || formData.selectedDepartmentIds.length > 0)) {
        console.log("Copying curriculum template:", {
          template_id: formData.selectedCurriculumId,
          grade_ids: formData.selectedGradeLevelIds,
          dept_ids: formData.selectedDepartmentIds,
        });

        await api.post(
          "/academics/copy-template/",
          {
            template_id: formData.selectedCurriculumId,
            grade_level_ids: formData.selectedGradeLevelIds,
            department_ids: formData.selectedDepartmentIds,
          },
          {
            headers: { "X-School-ID": currentSchoolId },
          }
        );

        console.log("→ Curriculum template copied successfully");
      }

      // ── FEE SETUP ──────────────────────────────────────────────────
      if (formData.hasTuitionPerTerm || formData.hasAdmissionFee || formData.hasUniformFee) {
        console.log("Setting up fees...");

        try {
          const categoryRes = await api.post(
            "/finance/fee-categories/",
            {
              name: "Basic Fees",
              is_mandatory: true,
              school: currentSchoolId,
            },
            {
              headers: { "X-School-ID": currentSchoolId },
            }
          );
          const categoryId = categoryRes.data.id;
          console.log("→ Fee category created:", categoryId);

          if (formData.hasTuitionPerTerm && formData.tuitionPerTerm > 0) {
            await api.post(
              "/finance/fee-items/",
              {
                category: categoryId,
                name: "Tuition per Term",
                amount: formData.tuitionPerTerm,
                frequency: "per_term",
                currency: formData.currency,
              },
              {
                headers: { "X-School-ID": currentSchoolId },
              }
            );
            console.log("→ Tuition fee item created");
          }

          if (formData.hasAdmissionFee && formData.admissionFee > 0) {
            await api.post(
              "/finance/fee-items/",
              {
                category: categoryId,
                name: "Admission Fee",
                amount: formData.admissionFee,
                frequency: "once",
                currency: formData.currency,
              },
              {
                headers: { "X-School-ID": currentSchoolId },
              }
            );
            console.log("→ Admission fee item created");
          }

          if (formData.hasUniformFee && formData.uniformFee > 0) {
            await api.post(
              "/finance/fee-items/",
              {
                category: categoryId,
                name: "Uniform Fee",
                amount: formData.uniformFee,
                frequency: "once",
                currency: formData.currency,
              },
              {
                headers: { "X-School-ID": currentSchoolId },
              }
            );
            console.log("→ Uniform fee item created");
          }

          console.log("→ Fees created successfully");
        } catch (feeErr: any) {
          console.warn("Fee setup failed (non-blocking):", {
            status: feeErr.response?.status,
            data: feeErr.response?.data,
          });
          // Don't throw - fees are optional, continue with setup
          toast.warning("Fees could not be set up automatically. You can add them later in the Finance module.");
        }
      }

      // ── MARK SETUP COMPLETE ────────────────────────────────────────
      console.log("Marking setup_complete = true on school:", currentSchoolId);
      await api.patch(`/schools/${currentSchoolId}/`, { setup_complete: true });

      console.log("✓ Setup completed successfully!");
      router.push("/onboarding/select-modules");
      toast.success("School setup completed successfully!");
    } catch (error: any) {
      console.error("Setup failed:", error);
      const errData = error.response?.data;
      let msg = "Setup failed. Please try again.";

      if (error.response?.status === 400) {
        msg = errData?.detail || errData?.non_field_errors?.[0] || "Invalid data provided.";
      } else if (error.response?.status === 404) {
        msg = "Template not found. Please select a valid curriculum.";
      }

      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
      console.groupEnd();
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600 text-center">
          <p>{error}</p>
          <button onClick={() => router.push("/login")} className="mt-4 text-blue-600 underline">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${index <= currentStep ? "bg-blue-600 text-white shadow-lg" : "bg-gray-200 text-gray-500"
                    }`}
                >
                  <step.icon className="w-6 h-6" />
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-full h-1 mx-2 transition-all ${index < currentStep ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    style={{ width: "80px" }}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">{steps[currentStep].name}</h2>
            <p className="text-gray-600 mt-2">
              Step {currentStep + 1} of {steps.length}
            </p>
          </div>

          <div className="mt-4 bg-gray-200 rounded-full h-3 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-xl p-6 sm:p-10"
          >
            {/* Step 1: School Information */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold text-gray-900">Tell us about your school</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">School Full Name</label>
                    <input
                      type="text"
                      value={formData.schoolName}
                      onChange={(e) => updateForm("schoolName", e.target.value)}
                      placeholder="e.g. St. Mary's Secondary School"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Short Name / Acronym</label>
                    <input
                      type="text"
                      value={formData.shortName}
                      onChange={(e) => updateForm("shortName", e.target.value)}
                      placeholder="e.g. SMSS"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => updateForm("phone", e.target.value)}
                        placeholder="+254 700 000 000"
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">School Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateForm("email", e.target.value)}
                        placeholder="admin@school.edu"
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Physical Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => updateForm("address", e.target.value)}
                        placeholder="Malindi Complex, Along Malindi - Lamu Road, Malindi"
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => updateForm("currency", e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="KES">Kenyan Shilling (KES)</option>
                      <option value="USD">US Dollar (USD)</option>
                      <option value="EUR">Euro (EUR)</option>
                      <option value="GBP">British Pound (GBP)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={formData.academicYearStart}
                        onChange={(e) => updateForm("academicYearStart", e.target.value)}
                        className="px-4 py-3 border border-gray-300 rounded-xl"
                      >
                        <option>January</option>
                        <option>August</option>
                        <option>September</option>
                      </select>
                      <select
                        value={formData.academicYearEnd}
                        onChange={(e) => updateForm("academicYearEnd", e.target.value)}
                        className="px-4 py-3 border border-gray-300 rounded-xl"
                      >
                        <option>December</option>
                        <option>July</option>
                        <option>August</option>
                      </select>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Official Registration / Licence Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.officialRegistrationNumber}
                      onChange={(e) => updateForm("officialRegistrationNumber", e.target.value)}
                      placeholder="e.g. MOE/12345/2023"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Issuing Authority (Optional)</label>
                    <input
                      type="text"
                      value={formData.registrationAuthority}
                      onChange={(e) => updateForm("registrationAuthority", e.target.value)}
                      placeholder="e.g. Ministry of Education, KNEC"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Registration Date (Optional)</label>
                    <input
                      type="date"
                      value={formData.registrationDate}
                      onChange={(e) => updateForm("registrationDate", e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-4">School Logo (Optional)</label>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-12 h-12 text-gray-400 mb-4" />
                          <p className="text-sm text-gray-600">Click to upload logo</p>
                          <p className="text-xs text-gray-500 mt-2">PNG, JPG up to 5MB</p>
                          {formData.logo && (
                            <p className="text-xs text-blue-600 mt-2">
                              Selected: {formData.logo.name} ({(formData.logo.size / 1024 / 1024).toFixed(2)} MB)
                            </p>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (!file.type.startsWith("image/")) {
                                toast.error("Please upload an image file (PNG/JPG)");
                                return;
                              }
                              if (file.size > 5 * 1024 * 1024) {
                                toast.error("File size exceeds 5MB");
                                return;
                              }
                              updateForm("logo", file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Academic Structure */}
            {currentStep === 1 && (
              <div className="space-y-8">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold">Define your academic calendar</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">Term System</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => updateForm("termSystem", "terms")}
                      className={`p-6 rounded-xl border-2 transition-all ${formData.termSystem === "terms" ? "border-blue-600 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                        }`}
                    >
                      <div className="font-semibold text-lg">Terms</div>
                      <p className="text-sm text-gray-600 mt-1">3 terms per year (Common in Kenya)</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateForm("termSystem", "semesters")}
                      className={`p-6 rounded-xl border-2 transition-all ${formData.termSystem === "semesters" ? "border-blue-600 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                        }`}
                    >
                      <div className="font-semibold text-lg">Semesters</div>
                      <p className="text-sm text-gray-600 mt-1">2 semesters per year</p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">Grading System</label>
                  <select
                    value={formData.gradingSystem}
                    onChange={(e) => updateForm("gradingSystem", e.target.value as "percentage" | "points" | "grades")}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="percentage">Percentage (0–100%)</option>
                    <option value="points">Mean Grade Points (A to E)</option>
                    <option value="grades">Letter Grades (A+, A, B+, etc.)</option>
                  </select>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Passing Mark</label>
                    <input
                      type="number"
                      value={formData.passingMark}
                      onChange={(e) => updateForm("passingMark", Number(e.target.value))}
                      className="w-32 px-4 py-3 border border-gray-300 rounded-xl"
                      min="0"
                      max="100"
                    />
                    <span className="ml-3 text-gray-600">%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Curriculum Setup */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold text-gray-900">Choose Your Curriculum</h3>
                  <p className="text-gray-600 mt-2">Select the academic system your school follows</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {curriculumTemplates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => updateForm("selectedCurriculumId", template.id)}
                      className={`p-6 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md ${formData.selectedCurriculumId === template.id
                          ? "border-blue-600 bg-blue-50 shadow-md"
                          : "border-gray-200 hover:border-blue-300"
                        }`}
                    >
                      <h4 className="text-lg font-semibold">{template.name}</h4>
                      <p className="text-sm text-gray-600">{template.short_code}</p>
                      <p className="text-xs text-gray-500 mt-2">{template.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Departments & Grades */}
            {currentStep === 3 && (
              <div className="space-y-10">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold">Select Your School Structure</h3>
                  <p className="text-gray-600 mt-2">
                    Choose the grade levels and departments currently active in your school
                  </p>
                </div>

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
                    <p className="text-gray-600">Loading available structure...</p>
                  </div>
                ) : !formData.selectedCurriculumId ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-gray-700 font-medium">
                      Please go back and select a curriculum first
                    </p>
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Back to Curriculum Selection
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Grade Levels */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-4 font-semibold">
                        Grade / Form Levels
                      </label>
                      {gradeLevels.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl">
                          No grade levels found for this curriculum
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {gradeLevels.map((level) => (
                            <label
                              key={level.id}
                              className="flex items-center gap-3 p-4 border rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={formData.selectedGradeLevelIds.includes(level.id)}
                                onChange={() => toggleGradeLevel(level.id)}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                              />
                              <span className="font-medium">{level.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Departments */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-4 font-semibold">
                        Departments / Streams
                      </label>
                      {departments.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl">
                          No departments available
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {departments.map((dept) => (
                            <label
                              key={dept.id}
                              className="flex items-center gap-3 p-4 border rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={formData.selectedDepartmentIds.includes(dept.id)}
                                onChange={() => toggleDepartment(dept.id)}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                              />
                              <span className="font-medium">{dept.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            {/* Step 5: Fee Setup */}
            {currentStep === 4 && (
              <div className="space-y-8">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold">Quick Fee Setup (Optional)</h3>
                  <p className="text-gray-600 mt-2">You can configure detailed fees later in Finance module</p>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-6 bg-gray-50 rounded-xl">
                    <div>
                      <h4 className="font-semibold">Tuition Fee per Term</h4>
                      <p className="text-sm text-gray-600">Standard fee for all students</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="number"
                        value={formData.tuitionPerTerm}
                        onChange={(e) => updateForm("tuitionPerTerm", Number(e.target.value))}
                        className="w-32 px-4 py-2 border rounded-lg text-right"
                        placeholder="25000"
                      />
                      <span className="text-gray-700 font-medium">{formData.currency}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-6 bg-gray-50 rounded-xl">
                    <div>
                      <h4 className="font-semibold">Admission / Registration Fee</h4>
                      <p className="text-sm text-gray-600">One-time fee for new students</p>
                    </div>
                    <input
                      type="number"
                      value={formData.admissionFee}
                      onChange={(e) => updateForm("admissionFee", Number(e.target.value))}
                      className="w-32 px-4 py-2 border rounded-lg text-right"
                      placeholder="10000"
                    />
                  </div>

                  <div className="flex items-center justify-between p-6 bg-gray-50 rounded-xl">
                    <div>
                      <h4 className="font-semibold">Uniform Fee</h4>
                      <p className="text-sm text-gray-600">Optional uniform cost</p>
                    </div>
                    <input
                      type="number"
                      value={formData.uniformFee}
                      onChange={(e) => updateForm("uniformFee", Number(e.target.value))}
                      className="w-32 px-4 py-2 border rounded-lg text-right"
                      placeholder="5000"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Review & Complete */}
            {currentStep === 5 && (
              <div className="text-center py-12">
                <div className="w-24 h-24 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-16 h-16 text-green-600" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">All Set! Your school is ready</h3>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
                  You've completed the initial setup. You can now start adding students, staff, and managing your school efficiently.
                </p>

                <div className="bg-gray-50 rounded-xl p-6 max-w-2xl mx-auto text-left">
                  <h4 className="font-semibold mb-4">Summary</h4>
                  <div className="space-y-3 text-sm">
                    <p><span className="font-medium">School:</span> {formData.schoolName || "Not set"}</p>
                    <p><span className="font-medium">Currency:</span> {formData.currency}</p>
                    <p><span className="font-medium">Academic Year:</span> {formData.academicYearStart} – {formData.academicYearEnd}</p>
                    <p><span className="font-medium">Grading:</span> {formData.gradingSystem} (Pass: {formData.passingMark}%)</p>
                    <p><span className="font-medium">Tuition per term:</span> {formData.currency} {formData.tuitionPerTerm.toLocaleString()}</p>
                  </div>
                </div>

                <button
                  onClick={handleComplete}
                  disabled={isLoading}
                  className="mt-10 px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-70 transition-all flex items-center gap-3 mx-auto"
                >
                  {isLoading ? "Finalizing..." : "Go to Dashboard"}
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        {currentStep < steps.length - 1 && (
          <div className="mt-10 flex justify-between">
            <button
              onClick={prevStep}
              disabled={currentStep === 0 || isLoading}
              className="px-6 py-3 text-gray-700 font-medium rounded-xl hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>

            <button
              onClick={nextStep}
              disabled={isLoading}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-70 flex items-center gap-2"
            >
              {currentStep === steps.length - 2 ? "Review" : "Next"}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}