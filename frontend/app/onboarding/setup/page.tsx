"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

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
  departments: string[];
  gradeLevels: string[];
  hasUniformFee: boolean;
  uniformFee: number;
  hasAdmissionFee: boolean;
  admissionFee: number;
  hasTuitionPerTerm: boolean;
  tuitionPerTerm: number;
  curriculumName: string;
  curriculumShortCode: string;
  curriculumDescription: string;
}

const steps = [
  { id: 1, name: "School Info", icon: Building2 },
  { id: 2, name: "Academic Structure", icon: Calendar },
  { id: 3, name: "Curriculum Setup", icon: GraduationCap },
  { id: 4, name: "Departments", icon: GraduationCap },
  { id: 5, name: "Fee Setup", icon: DollarSign },
  { id: 6, name: "Complete", icon: CheckCircle },
] as const;

export default function SetupWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    curriculumName: "CBC",
    curriculumShortCode: "CBC",
    curriculumDescription: "Competency Based Curriculum",
    departments: ["Science", "Humanities", "Technical", "Commercial"],
    gradeLevels: ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Form 1", "Form 2", "Form 3", "Form 4"],
    hasUniformFee: true,
    uniformFee: 5000,
    hasAdmissionFee: true,
    admissionFee: 10000,
    hasTuitionPerTerm: true,
    tuitionPerTerm: 25000,
  });

  useEffect(() => {
    // Optional: Try to load existing school for pre-fill (but DON'T fail if missing)
    const loadExisting = async () => {
      try {
        // Try to get existing active school
        const res = await api.get("/schools/active/");
        setSchoolId(res.data.id);
        // Pre-fill form with existing data
        setFormData((prev) => ({
          ...prev,
          schoolName: res.data.name || prev.schoolName,
          shortName: res.data.short_name || prev.shortName,
          address: res.data.address || prev.address,
          city: res.data.city || prev.city,
          country: res.data.country || prev.country,
          officialRegistrationNumber: res.data.official_registration_number || prev.officialRegistrationNumber,
          registrationAuthority: res.data.registration_authority || prev.registrationAuthority,
          registrationDate: res.data.registration_date || prev.registrationDate,
          phone: res.data.phone || prev.phone,
          email: res.data.email || prev.email,
          website: res.data.website || prev.website,
          currency: res.data.currency || prev.currency,
          academicYearStart: res.data.academic_year_start_month || prev.academicYearStart,
          academicYearEnd: res.data.academic_year_end_month || prev.academicYearEnd,
          termSystem: res.data.term_system || prev.termSystem,
          numberOfTerms: res.data.number_of_terms || prev.numberOfTerms,
          gradingSystem: res.data.grading_system || prev.gradingSystem,
          passingMark: res.data.passing_mark || prev.passingMark,
        }));
      } catch (err: any) {
        console.log("No existing school - will create on complete");
        // Do NOT redirect to login here!
      }
    };

    loadExisting();
  }, [router]);

  const updateForm = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let currentSchoolId = schoolId;

      // === CREATE NEW SCHOOL IF NONE EXISTS ===
      if (!currentSchoolId) {
        console.log("No school exists yet - creating new one...");

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

        const newSchoolRes = await api.post("/schools/", schoolForm);
        currentSchoolId = newSchoolRes.data.id;
        setSchoolId(currentSchoolId); // Update state for future use
        console.log("New school created with ID:", currentSchoolId);
      } else {
        // Update existing school
        console.log("Updating existing school:", currentSchoolId);
        const schoolForm = new FormData();
        schoolForm.append("name", formData.schoolName || "");
        schoolForm.append("short_name", formData.shortName || "");
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

        await api.patch(`/schools/${currentSchoolId}/`, schoolForm);
      }

      // === Check if curriculum exists, create if not ===
      let curriculumId = null;

      try {
        const existingCurriculum = await api.get("/academics/curricula/", {
          params: { school: currentSchoolId, name: formData.curriculumName },
        });

        if (existingCurriculum.data.results?.length > 0) {
          curriculumId = existingCurriculum.data.results[0].id;
          console.log("Existing curriculum found, using ID:", curriculumId);
        }
      } catch (err) {
        console.warn("Failed to check existing curriculum:", err);
        // Optional: proceed to create if check fails (fail-open)
      }

      // Only create if no existing curriculum was found
      if (!curriculumId) {
        try {
          const curriculumRes = await api.post("/academics/curricula/", {
            name: formData.curriculumName || "CBC",
            short_code: formData.curriculumShortCode || "CBC",
            description: formData.curriculumDescription || "Competency Based Curriculum",
            is_active: true,
            school: currentSchoolId,
          });
          curriculumId = curriculumRes.data.id;
          console.log("New curriculum created with ID:", curriculumId);
        } catch (err: any) {
          if (err.response?.status === 400) {
            // Handle duplicate error gracefully
            console.warn("Curriculum creation failed (likely duplicate):", err.response?.data);
            // Optional: fallback to search again
            const fallback = await api.get("/academics/curricula/", {
              params: { school: currentSchoolId, name: formData.curriculumName },
            });
            if (fallback.data.results?.length > 0) {
              curriculumId = fallback.data.results[0].id;
            } else {
              throw new Error("Failed to create or find curriculum");
            }
          } else {
            throw err; // Other errors
          }
        }
      }

      if (!curriculumId) {
        throw new Error("Curriculum ID not set - cannot continue");
      }
      // === Create Grade Levels (check for duplicates if needed) ===
      for (const [index, name] of formData.gradeLevels.entries()) {
        let alreadyExists = false;

        try {
          const existing = await api.get("/academics/grade-levels/", {
            params: { school: currentSchoolId, name },
          });
          if (existing.data.results?.length > 0) {
            alreadyExists = true;
            console.log(`Grade level "${name}" already exists, skipping`);
          }
        } catch (err) {
          console.warn(`Failed to check grade level "${name}":`, err);
        }

        if (alreadyExists) continue;

        await api.post("/academics/grade-levels/", {
          curriculum: curriculumId,
          name,
          order: index + 1,
          school: currentSchoolId,
        });
        console.log(`Created grade level: ${name}`);
      }
      // === Create Departments (check for duplicates) ===
      for (const name of formData.departments) {
        let alreadyExists = false;

        try {
          const existing = await api.get("/academics/departments/", {
            params: { school: currentSchoolId, name },
          });

          if (existing.data.results?.length > 0) {
            console.log(`Department "${name}" already exists, skipping`);
            alreadyExists = true;
          }
        } catch (err) {
          console.warn(`Failed to check department "${name}":`, err);
        }

        if (alreadyExists) continue;

        try {
          await api.post("/academics/departments/", {
            curriculum: curriculumId,
            name,
            school: currentSchoolId,
          });
          console.log(`Created department: ${name}`);
        } catch (err: any) {
          if (err.response?.status === 400 && err.response.data?.non_field_errors?.[0]?.includes("unique set")) {
            console.warn(`Duplicate department "${name}" detected by backend - skipping`);
          } else {
            throw err;
          }
        }
      }

      // 5. Fees - with robust duplicate check
      let categoryId = null;

      if (formData.hasTuitionPerTerm || formData.hasAdmissionFee || formData.hasUniformFee) {
        try {
          const existingCategory = await api.get("/finance/fee-categories/", {
            params: { school: currentSchoolId, name: "Basic Fees" },
          });

          if (existingCategory.data.results?.length > 0) {
            categoryId = existingCategory.data.results[0].id;
            console.log("Existing 'Basic Fees' category found, using ID:", categoryId);
          }
        } catch (err) {
          console.warn("Failed to check fee category:", err);
          // Proceed to create if check fails (fail-open is safe)
        }

        // Only create if no existing category was found
        if (!categoryId) {
          try {
            console.log("DEBUG: Fee category school value:", currentSchoolId);
            console.log("DEBUG: Type of school value:", typeof currentSchoolId);
            console.log("DEBUG: Full payload:", {
              name: "Basic Fees",
              is_mandatory: true,
              school: currentSchoolId,
            });
            const categoryRes = await api.post("/finance/fee-categories/", {
              name: "Basic Fees",
              is_mandatory: true,
              school: currentSchoolId,
            });
            categoryId = categoryRes.data.id;
            console.log("New fee category created with ID:", categoryId);
          } catch (err: any) {
            if (err.response?.status === 400) {
              // Handle duplicate error gracefully
              console.warn("Fee category creation failed (likely duplicate):", err.response?.data);
              // Fallback: search again
              const fallback = await api.get("/finance/fee-categories/", {
                params: { school: currentSchoolId, name: "Basic Fees" },
              });
              if (fallback.data.results?.length > 0) {
                categoryId = fallback.data.results[0].id;
              } else {
                throw new Error("Failed to create or find fee category");
              }
            } else {
              throw err;
            }
          }
        }

        // Proceed with fee items if category exists
        if (categoryId && formData.hasTuitionPerTerm && formData.tuitionPerTerm > 0) {
          await api.post("/finance/fee-items/", {
            category: categoryId,
            name: "Tuition per Term",
            amount: formData.tuitionPerTerm,
            frequency: "per_term",
            currency: formData.currency,
          });
          console.log("Tuition fee item created");
        }
      }

      // Mark complete
      // await api.patch(`/schools/${currentSchoolId}/`, { setup_complete: true });

      // router.push("/onboarding/select-modules");
      // Mark complete – wait for success
      const completeRes = await api.patch(`/schools/${currentSchoolId}/`, {
        setup_complete: true
      });

      // Optional: verify the response actually shows it's complete
      if (!completeRes.data?.setup_complete) {
        console.warn("Server did NOT confirm setup_complete = true", completeRes.data);
        throw new Error("Setup complete flag was not set on server");
      }

      router.push("/onboarding/select-modules");

    } catch (error: any) {
      console.error("Setup failed:", error.response?.data || error.message);

      let userMessage = "Setup failed. Please try again.";
      if (error.response?.status === 400) {
        const detail = error.response.data?.non_field_errors?.[0];
        if (detail?.includes("unique set")) {
          userMessage = "Some items (e.g. curriculum name or grade level) already exist. Skipping duplicates.";
        } else {
          userMessage = detail || "Invalid data provided.";
        }
      }
      setError(userMessage);
    } finally {
      setIsLoading(false);
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
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${index <= currentStep
                    ? "bg-blue-600 text-white shadow-lg"
                    : "bg-gray-200 text-gray-500"
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
            <h2 className="text-2xl font-bold text-gray-900">
              {steps[currentStep].name}
            </h2>
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
                  <h3 className="text-xl font-semibold text-gray-900">
                    Tell us about your school
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      School Full Name
                    </label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Short Name / Acronym
                    </label>
                    <input
                      type="text"
                      value={formData.shortName}
                      onChange={(e) => updateForm("shortName", e.target.value)}
                      placeholder="e.g. SMSS"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      School Email
                    </label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Physical Address
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => updateForm("address", e.target.value)}
                        placeholder="P.O. Box 123 - 00100, Nairobi"
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Currency
                    </label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Academic Year
                    </label>
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
                  {/* Official Registration details */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Official Registration / Licence Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.officialRegistrationNumber}
                      onChange={(e) => updateForm("officialRegistrationNumber", e.target.value)}
                      placeholder="e.g. MOE/12345/2023, CBSE Affiliation No, DepEd ID..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Enter your school's official registration number from the education authority (if applicable).
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Issuing Authority (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.registrationAuthority}
                      onChange={(e) => updateForm("registrationAuthority", e.target.value)}
                      placeholder="e.g. Ministry of Education, KNEC, State Board, Ofsted..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Registration Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={formData.registrationDate}
                      onChange={(e) => updateForm("registrationDate", e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {/* In Step 1 JSX - Replace your logo block with this */}
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-4">
                      School Logo (Optional)
                    </label>
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
                              // Optional: Validate file type/size
                              if (!file.type.startsWith("image/")) {
                                alert("Please upload an image file (PNG/JPG)");
                                return;
                              }
                              if (file.size > 5 * 1024 * 1024) {
                                alert("File size exceeds 5MB");
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
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Term System
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => updateForm("termSystem", "terms")}
                      className={`p-6 rounded-xl border-2 transition-all ${formData.termSystem === "terms"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                        }`}
                    >
                      <div className="font-semibold text-lg">Terms</div>
                      <p className="text-sm text-gray-600 mt-1">3 terms per year (Common in Kenya)</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateForm("termSystem", "semesters")}
                      className={`p-6 rounded-xl border-2 transition-all ${formData.termSystem === "semesters"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                        }`}
                    >
                      <div className="font-semibold text-lg">Semesters</div>
                      <p className="text-sm text-gray-600 mt-1">2 semesters per year</p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Grading System
                  </label>
                  <select
                    value={formData.gradingSystem}
                    onChange={(e) => updateForm("gradingSystem", e.target.value as FormData["gradingSystem"])}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="percentage">Percentage (0–100%)</option>
                    <option value="points">Mean Grade Points (A to E)</option>
                    <option value="grades">Letter Grades (A+, A, B+, etc.)</option>
                  </select>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Passing Mark
                    </label>
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
                  <h3 className="text-xl font-semibold text-gray-900">
                    Set up your curriculum
                  </h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Curriculum Name
                  </label>
                  <input
                    type="text"
                    value={formData.curriculumName}
                    onChange={(e) => updateForm("curriculumName", e.target.value)}
                    placeholder="e.g. CBC, IGCSE, 8-4-4"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Short Code
                  </label>
                  <input
                    type="text"
                    value={formData.curriculumShortCode}
                    onChange={(e) => updateForm("curriculumShortCode", e.target.value)}
                    placeholder="e.g. CBC, IGCSE"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={formData.curriculumDescription}
                    onChange={(e) => updateForm("curriculumDescription", e.target.value)}
                    placeholder="e.g. Competency Based Curriculum"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Step 4: Departments */}
            {currentStep === 3 && (
              <div className="space-y-8">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold">Set up departments and grade levels</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Common Departments / Streams
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {["Science", "Humanities", "Technical", "Commercial", "Languages", "Arts", "Business", "Vocational"].map((dept) => (
                      <label key={dept} className="flex items-center gap-3 p-4 border rounded-xl hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.departments.includes(dept)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...formData.departments, dept]
                              : formData.departments.filter((d) => d !== dept);
                            updateForm("departments", updated);
                          }}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="font-medium">{dept}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Grade / Form Levels in Your School
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {["DayCare", "PP1", "PP2", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12", "Form 1", "Form 2", "Form 3", "Form 4"].map((level) => (
                      <label key={level} className="flex items-center gap-3 p-4 border rounded-xl hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.gradeLevels.includes(level)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...formData.gradeLevels, level]
                              : formData.gradeLevels.filter((l) => l !== level);
                            updateForm("gradeLevels", updated);
                          }}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="font-medium">{level}</span>
                      </label>
                    ))}
                  </div>
                </div>
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
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  All Set! Your school is ready
                </h3>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
                  You've completed the initial setup. You can now start adding students, staff, and managing your school efficiently.
                </p>

                <div className="bg-gray-50 rounded-xl p-6 max-w-2xl mx-auto text-left">
                  <h4 className="font-semibold mb-4">Summary</h4>
                  <div className="space-y-3 text-sm">
                    <p><span className="font-medium">School:</span> {formData.schoolName || "Not set"}</p>
                    <p><span className="font-medium">Currency:</span> {formData.currency}</p>
                    <p><span className="font-medium">Academic Year:</span> {formData.academicYearStart} – {formData.academicYearEnd}</p>
                    <p><span className="font-medium">Curriculum:</span> {formData.curriculumName}</p>
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
              disabled={currentStep === 0}
              className="px-6 py-3 text-gray-700 font-medium rounded-xl hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>

            <button
              onClick={nextStep}
              disabled={isLoading}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl flex items-center gap-2"
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