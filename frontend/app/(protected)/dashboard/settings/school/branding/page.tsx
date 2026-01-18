"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import api from "@/utils/api";
import { toast } from "sonner";
import { Upload, Image as ImageIcon, Save, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

// UI components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ────────────────────────────────────────────────────────────────
// Color palette (consistent across your app)
const colors = {
  primary: '#1E3A8A',      // Deep navy
  secondary: '#10B981',    // Emerald green - success
  accent: '#38BDF8',       // Sky blue - focus/hover
  background: '#F8FAFC',
  surface: 'rgba(255, 255, 255, 0.75)', // Glass base
  textPrimary: '#0F172A',
  textMuted: '#64748B',
  border: 'rgba(226, 232, 240, 0.8)',
};

export default function BrandingPage() {
  const { currentSchool, refreshSchools } = useCurrentSchool();

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Show existing logo from backend
  useEffect(() => {
    if (currentSchool?.logo) {
      setLogoPreview(currentSchool.logo);
    }
  }, [currentSchool]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file type", {
        description: "Please upload an image (PNG, JPG, etc.)",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", {
        description: "Maximum file size is 5MB",
      });
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!currentSchool?.id) {
      toast.error("No school selected");
      return;
    }

    if (!logoFile) {
      toast.info("No new logo selected");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("logo", logoFile);

      await api.patch(`/schools/${currentSchool.id}/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await refreshSchools();

      toast.success("Logo updated successfully!", {
        description: "Your school's new branding is live.",
        style: { background: colors.secondary, color: "white", border: "none" },
      });

      // Reset file input after success (optional)
      setLogoFile(null);
    } catch (error: any) {
      console.error("Branding update failed:", error);
      toast.error("Failed to update logo", {
        description: error.response?.data?.detail || "Please try again",
        style: { background: "#EF4444", color: "white" },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-slate-50 to-indigo-50/30 p-6 md:p-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto"
      >
        {/* Glass Card Container */}
        <div
          className="backdrop-blur-xl bg-white/70 border border-white/30 rounded-3xl shadow-2xl shadow-black/5 overflow-hidden"
          style={{ background: colors.surface }}
        >
          {/* Header with gradient */}
          <div className="px-8 py-10 bg-gradient-to-r from-[var(--primary)] to-indigo-900 text-white">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <ImageIcon className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">School Branding</h1>
                <p className="text-blue-100/90 mt-1.5 opacity-90">
                  Make your school instantly recognizable with a beautiful logo
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 md:p-12 space-y-10">
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-slate-800 flex items-center gap-3">
                <ImageIcon className="h-6 w-6 text-[var(--primary)]" />
                School Logo
              </h3>

              <p className="text-slate-600">
                Recommended: 512×512px square PNG or JPG, transparent background preferred.
              </p>

              {/* Preview & Upload Area */}
              <div className="flex flex-col md:flex-row items-center gap-10">
                {/* Logo Preview */}
                <div className="relative w-64 h-64 bg-white/50 backdrop-blur-sm border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center overflow-hidden shadow-inner transition-all hover:shadow-lg">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="School logo preview"
                      className="w-full h-full object-contain p-4"
                    />
                  ) : (
                    <div className="text-center text-slate-400">
                      <ImageIcon className="mx-auto h-16 w-16 mb-3 opacity-70" />
                      <p className="text-sm font-medium">No logo uploaded yet</p>
                    </div>
                  )}
                </div>

                {/* Upload Controls */}
                <div className="flex-1 space-y-6 w-full max-w-md">
                  <div>
                    <Label htmlFor="logo-upload" className="cursor-pointer block">
                      <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all duration-300">
                        <Upload className="mx-auto h-10 w-10 text-slate-400 group-hover:text-[var(--accent)] transition-colors" />
                        <p className="mt-4 text-slate-700 font-medium">
                          {logoFile ? logoFile.name : "Click or drag to upload new logo"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          PNG, JPG • Max 5MB • Square recommended
                        </p>
                      </div>
                    </Label>

                    <Input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSave}
                      disabled={loading || !logoFile}
                      size="lg"
                      className="min-w-[200px] bg-gradient-to-r from-[var(--primary)] to-indigo-700 hover:from-indigo-800 hover:to-indigo-900 text-white shadow-lg shadow-indigo-200/40 transition-all duration-300"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-5 w-5" />
                          Save Logo
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}