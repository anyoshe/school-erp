"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import api from "@/utils/api";
import { toast } from "sonner";
import {
  Phone,
  Mail,
  MapPin,
  Globe,
  Building2,
  Save,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Sweet color palette (same as your other page)
const colors = {
  primary: '#1E3A8A',      // Deep navy
  secondary: '#10B981',    // Emerald green (success)
  accent: '#38BDF8',       // Sky blue (focus/hover)
  background: '#F8FAFC',
  surface: 'rgba(255, 255, 255, 0.75)', // Glass base
  textPrimary: '#0F172A',
  textMuted: '#64748B',
  border: 'rgba(226, 232, 240, 0.8)',
};

export default function SchoolContactPage() {
  const { currentSchool, refreshSchools } = useCurrentSchool();

  const [formData, setFormData] = useState({
    phone: "",
    alternativePhone: "",
    emergencyPhone: "",
    email: "",
    website: "",
    address: "",
    postalAddress: "",
    city: "",
    country: "",
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentSchool) {
      console.log("CURRENT SCHOOL RAW (after refresh):", currentSchool);
      setFormData({
        phone: currentSchool.phone ?? "",
        alternativePhone: currentSchool.alternative_phone ?? "",
        emergencyPhone: currentSchool.emergency_phone ?? "",
        email: currentSchool.email ?? "",
        website: currentSchool.website ?? "",
        address: currentSchool.address ?? "",
        postalAddress: currentSchool.postal_address ?? "",
        city: currentSchool.city ?? "",
        country: currentSchool.country ?? "Kenya",
      });
    }
  }, [currentSchool]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentSchool?.id) {
      toast.error("No school selected");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        phone: formData.phone.trim(),
        alternative_phone: formData.alternativePhone.trim(),
        emergency_phone: formData.emergencyPhone.trim(),
        email: formData.email.trim(),
        website: formData.website.trim(),
        address: formData.address.trim(),
        postal_address: formData.postalAddress.trim(),
        city: formData.city.trim(),
        country: formData.country.trim(),
      };

      await api.patch(`/schools/${currentSchool.id}/`, payload);
      await refreshSchools();

      toast.success("Contact information updated successfully!", {
        style: { background: colors.secondary, color: "white", border: "none" },
        description: "All changes saved and synced.",
      });
    } catch (error: any) {
      console.error("Update failed:", error);
      toast.error("Failed to update contact information", {
        style: { background: "#EF4444", color: "white" },
        description: error.response?.data?.detail || "Please try again.",
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
        {/* Glass Card */}
        <div
          className="backdrop-blur-xl bg-white/70 border border-white/30 rounded-3xl shadow-2xl shadow-black/5 overflow-hidden"
          style={{ background: 'rgba(255, 255, 255, 0.65)' }}
        >
          {/* Header with gradient */}
          <div className="px-8 py-10 bg-gradient-to-r from-[var(--primary)] to-indigo-900 text-white">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <Phone className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Contact & Address</h1>
                <p className="text-blue-100/90 mt-1.5 opacity-90">
                  Keep your school's contact details current and accessible
                </p>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Phone Numbers Section */}
              <div className="space-y-6">
                <div className="space-y-2 group">
                  <Label className="text-base font-medium text-slate-700 group-focus-within:text-[var(--primary)] transition-colors">
                    Main Phone Number
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[var(--accent)] transition-colors" />
                    <Input
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="h-12 pl-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30 transition-all shadow-sm hover:shadow-md"
                      placeholder="+254 700 000 000"
                    />
                  </div>
                </div>

                <div className="space-y-2 group">
                  <Label className="text-base font-medium text-slate-700 group-focus-within:text-[var(--primary)] transition-colors">
                    Alternative Phone (optional)
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[var(--accent)] transition-colors" />
                    <Input
                      name="alternativePhone"
                      value={formData.alternativePhone}
                      onChange={handleChange}
                      className="h-12 pl-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30 transition-all shadow-sm hover:shadow-md"
                    />
                  </div>
                </div>

                <div className="space-y-2 group">
                  <Label className="text-base font-medium text-slate-700 group-focus-within:text-[var(--primary)] transition-colors">
                    Emergency Contact
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-red-400 group-focus-within:text-red-500 transition-colors" />
                    <Input
                      name="emergencyPhone"
                      value={formData.emergencyPhone}
                      onChange={handleChange}
                      className="h-12 pl-12 rounded-xl border-slate-200 focus:border-red-400 focus:ring-red-400/30 transition-all shadow-sm hover:shadow-md"
                      placeholder="+254 722 123 456"
                    />
                  </div>
                </div>
              </div>

              {/* Email & Website */}
              <div className="space-y-6">
                <div className="space-y-2 group">
                  <Label className="text-base font-medium text-slate-700 group-focus-within:text-[var(--primary)] transition-colors">
                    Official Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[var(--accent)] transition-colors" />
                    <Input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="h-12 pl-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30 transition-all shadow-sm hover:shadow-md"
                    />
                  </div>
                </div>

                <div className="space-y-2 group">
                  <Label className="text-base font-medium text-slate-700 group-focus-within:text-[var(--primary)] transition-colors">
                    Website (optional)
                  </Label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[var(--accent)] transition-colors" />
                    <Input
                      name="website"
                      type="url"
                      value={formData.website}
                      onChange={handleChange}
                      className="h-12 pl-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30 transition-all shadow-sm hover:shadow-md"
                      placeholder="https://www.yourschool.ac.ke"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Address Section */}
            <div className="space-y-6">
              <div className="space-y-2 group">
                <Label className="text-base font-medium text-slate-700 group-focus-within:text-[var(--primary)] transition-colors">
                  Physical Address
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[var(--accent)] transition-colors" />
                  <Input
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="h-12 pl-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30 transition-all shadow-sm hover:shadow-md"
                    placeholder="P.O. Box 12345 - 00100, Nairobi"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2 group">
                  <Label className="text-base font-medium text-slate-700 group-focus-within:text-[var(--primary)] transition-colors">
                    City
                  </Label>
                  <Input
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="h-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30 transition-all shadow-sm hover:shadow-md"
                  />
                </div>

                <div className="space-y-2 group">
                  <Label className="text-base font-medium text-slate-700 group-focus-within:text-[var(--primary)] transition-colors">
                    Country
                  </Label>
                  <Input
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    className="h-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30 transition-all shadow-sm hover:shadow-md"
                  />
                </div>

                <div className="space-y-2 group">
                  <Label className="text-base font-medium text-slate-700 group-focus-within:text-[var(--primary)] transition-colors">
                    Postal Address (optional)
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[var(--accent)] transition-colors" />
                    <Input
                      name="postalAddress"
                      value={formData.postalAddress}
                      onChange={handleChange}
                      className="h-12 pl-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30 transition-all shadow-sm hover:shadow-md"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-8">
              <Button
                type="submit"
                disabled={isSaving}
                size="lg"
                className="min-w-[220px] bg-gradient-to-r from-[var(--primary)] to-indigo-700 hover:from-indigo-800 hover:to-indigo-900 text-white shadow-lg shadow-indigo-200/50 transition-all duration-300"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    Save Contact Details
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}