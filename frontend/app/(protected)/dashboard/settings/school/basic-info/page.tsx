"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import api from "@/utils/api";
import { toast } from "sonner";
import {
  Phone,
  Mail,
  MapPin,
  Upload,
  Globe,
  Calendar,
  Building2,
  Save,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Sweet modern color palette
const colors = {
  primary: '#1E3A8A',      // Deep navy
  secondary: '#10B981',    // Emerald green
  accent: '#38BDF8',       // Sky blue
  background: '#F8FAFC',   // Very light slate
  surface: 'rgba(255, 255, 255, 0.7)', // Glassmorphism base
  textPrimary: '#0F172A',
  textMuted: '#64748B',
  danger: '#EF4444',
  warning: '#F59E0B',
  border: 'rgba(226, 232, 240, 0.8)',
};

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const getMonthName = (num?: number) => (num ? monthNames[num - 1] : "January");
const getMonthNumber = (name: string) => monthNames.indexOf(name) + 1 || 1;

export default function EditSchoolBasicInfoPage() {
  const { currentSchool, refreshSchools } = useCurrentSchool();

  const [formData, setFormData] = useState({
    schoolName: "",
    shortName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "Kenya",
    website: "",
    currency: "KES",
    academicYearStart: "January",
    academicYearEnd: "December",
    termSystem: "terms",
    numberOfTerms: 3,
    gradingSystem: "percentage",
    passingMark: 50,
    officialRegistrationNumber: "",
    registrationAuthority: "",
    registrationDate: "",
    logo: null as File | null,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
  if (currentSchool) {
    console.log("Raw currentSchool from API:", currentSchool); // ← you already have this

    setFormData({
      schoolName: currentSchool.name || "",
      shortName: currentSchool.short_name || "",                    // ← fix: snake_case
      email: currentSchool.email || "",
      phone: currentSchool.phone || "",
      address: currentSchool.address || "",
      city: currentSchool.city || "",
      country: currentSchool.country || "Kenya",
      website: currentSchool.website || "",
      currency: currentSchool.currency || "KES",

      // Month fields – these are almost certainly snake_case too
      academicYearStart: getMonthName(currentSchool.academic_year_start_month),
      academicYearEnd: getMonthName(currentSchool.academic_year_end_month),

      termSystem: currentSchool.term_system || "terms",
      numberOfTerms: currentSchool.number_of_terms || 3,
      gradingSystem: currentSchool.grading_system || "percentage",
      passingMark: currentSchool.passing_mark || 50,

      officialRegistrationNumber: currentSchool.official_registration_number || "",
      registrationAuthority: currentSchool.registration_authority || "",
      registrationDate: currentSchool.registration_date || "",

      logo: null, // file input stays null until user selects new one
    });

    // Optional: extra debug to confirm values
    console.log("Prefill values → short_name:", currentSchool.short_name);
    console.log("Prefill values → website:", currentSchool.website);
  }
}, [currentSchool]);

  const updateForm = <K extends keyof typeof formData>(key: K, value: typeof formData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!currentSchool?.id) {
      toast.error("No school selected");
      return;
    }

    setIsSaving(true);

    try {
      const payload = new FormData();
      payload.append("name", formData.schoolName.trim());
      payload.append("short_name", formData.shortName.trim());
      payload.append("email", formData.email.trim());
      payload.append("phone", formData.phone.trim());
      payload.append("address", formData.address.trim());
      payload.append("city", formData.city.trim());
      payload.append("country", formData.country.trim());
      payload.append("website", formData.website.trim());
      payload.append("currency", formData.currency.trim());
      payload.append("academic_year_start_month", getMonthNumber(formData.academicYearStart).toString());
      payload.append("academic_year_end_month", getMonthNumber(formData.academicYearEnd).toString());
      payload.append("term_system", formData.termSystem);
      payload.append("number_of_terms", formData.numberOfTerms.toString());
      payload.append("grading_system", formData.gradingSystem);
      payload.append("passing_mark", formData.passingMark.toString());
      payload.append("official_registration_number", formData.officialRegistrationNumber.trim());
      payload.append("registration_authority", formData.registrationAuthority.trim());

      if (formData.registrationDate) {
        payload.append("registration_date", formData.registrationDate);
      }

      if (formData.logo) {
        payload.append("logo", formData.logo);
      }

      await api.patch(`/schools/${currentSchool.id}/`, payload);

      toast.success("School information updated successfully!", {
        style: { background: colors.secondary, color: 'white' }
      });
      setSuccess(true);
      await refreshSchools();

      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update school", {
        style: { background: colors.danger, color: 'white' }
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-slate-50 to-indigo-50/30 p-6 md:p-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="max-w-5xl mx-auto"
      >
        {/* Glass Card Container */}
        <div
          className="backdrop-blur-xl bg-white/70 border border-white/30 rounded-3xl shadow-2xl shadow-black/5 overflow-hidden"
          style={{ background: 'rgba(255, 255, 255, 0.65)' }}
        >
          {/* Header */}
          <div className="px-8 py-10 bg-gradient-to-r from-[var(--primary)] to-indigo-900 text-white">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <Building2 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Edit School Profile</h1>
                <p className="text-blue-100/90 mt-1.5 opacity-90">
                  Keep your school's information up-to-date and beautiful
                </p>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-8 md:p-12 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* School Name */}
              <div className="space-y-2 group">
                <Label className="text-base font-medium text-slate-700 group-focus-within:text-[var(--primary)] transition-colors">
                  School Full Name
                </Label>
                <div className="relative">
                  <Input
                    value={formData.schoolName}
                    onChange={(e) => updateForm("schoolName", e.target.value)}
                    className="h-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30 transition-all shadow-sm hover:shadow-md"
                    placeholder="e.g. The Destiny Scholars School"
                  />
                </div>
              </div>

              {/* Short Name */}
              <div className="space-y-2 group">
                <Label className="text-base font-medium text-slate-700 group-focus-within:text-[var(--primary)] transition-colors">
                  Short Name
                </Label>
                <Input
                  value={formData.shortName}
                  onChange={(e) => updateForm("shortName", e.target.value)}
                  className="h-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30 transition-all shadow-sm hover:shadow-md"
                  placeholder="e.g. TDSS"
                />
              </div>

              {/* Email & Phone */}
              <div className="space-y-2 group">
                <Label className="text-base font-medium text-slate-700 group-focus-within:text-[var(--primary)] transition-colors">
                  Official Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[var(--accent)] transition-colors" />
                  <Input
                    type="email"
                    className="h-12 pl-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30 transition-all shadow-sm hover:shadow-md"
                    value={formData.email}
                    onChange={(e) => updateForm("email", e.target.value)}
                    placeholder="admin@school.ac.ke"
                  />
                </div>
              </div>

              <div className="space-y-2 group">
                <Label className="text-base font-medium text-slate-700 group-focus-within:text-[var(--primary)] transition-colors">
                  Phone Number
                </Label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[var(--accent)] transition-colors" />
                  <Input
                    type="tel"
                    className="h-12 pl-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30 transition-all shadow-sm hover:shadow-md"
                    value={formData.phone}
                    onChange={(e) => updateForm("phone", e.target.value)}
                    placeholder="+254 700 123 456"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="lg:col-span-2 space-y-2 group">
                <Label className="text-base font-medium text-slate-700 group-focus-within:text-[var(--primary)] transition-colors">
                  Physical Address
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 h-5 w-5 text-slate-400 group-focus-within:text-[var(--accent)] transition-colors" />
                  <Input
                    className="h-12 pl-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30 transition-all shadow-sm hover:shadow-md"
                    value={formData.address}
                    onChange={(e) => updateForm("address", e.target.value)}
                    placeholder="Malindi Complex, Along Malindi - Lamu Road, Malindi"
                  />
                </div>
              </div>

              {/* More fields... */}
              {/* Add City, Country, Website, Currency, Academic Year, Registration fields similarly */}
              {/* ... */}

              {/* Logo Section */}
              <div className="lg:col-span-2 space-y-3">
                <Label className="text-base font-medium text-slate-700">School Logo</Label>
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <label className="flex-1 cursor-pointer group">
                    <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all duration-300">
                      <Upload className="mx-auto h-12 w-12 text-slate-400 group-hover:text-[var(--accent)] transition-colors" />
                      <p className="mt-4 text-slate-600 group-hover:text-[var(--accent)] transition-colors">
                        Click to upload new logo
                      </p>
                      <p className="text-xs text-slate-400 mt-1">PNG, JPG • max 5MB</p>
                      {formData.logo && (
                        <p className="mt-3 text-[var(--accent)] font-medium">
                          Selected: {formData.logo.name}
                        </p>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const file = e.target.files?.[0];
                        if (file) updateForm("logo", file);
                      }}
                    />
                  </label>

                  {/* Current Logo Preview */}
                  {currentSchool?.logo && !formData.logo && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-white shadow-lg"
                    >
                      <img
                        src={currentSchool.logo}
                        alt="Current school logo"
                        className="w-full h-full object-cover"
                      />
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-8">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="lg"
                className="min-w-[200px] bg-gradient-to-r from-[var(--primary)] to-indigo-700 hover:from-indigo-800 hover:to-indigo-900 text-white shadow-lg shadow-indigo-200/50 transition-all duration-300"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}