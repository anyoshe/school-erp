"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import api from "@/utils/api";
import { getCurrentUser } from "@/utils/api";

import {
  Users,
  BookOpen,
  DollarSign,
  Calendar,
  Library,
  GraduationCap,
  FileText,
  BarChart3,
  ChevronRight,
  Check,
  Settings,
} from "lucide-react";


// Define module shape with strict types
interface Module {
  id: string;           // UUID from backend
  title: string;
  description: string;
  icon: React.ReactNode;
  color: keyof typeof colorMap; // Restrict to valid keys
  
}

const colorMap = {
  blue: { bg: "bg-blue-100", hover: "hover:bg-blue-200", selected: "bg-blue-600", ring: "ring-blue-500" },
  indigo: { bg: "bg-indigo-100", hover: "hover:bg-indigo-200", selected: "bg-indigo-600", ring: "ring-indigo-500" },
  emerald: { bg: "bg-emerald-100", hover: "hover:bg-emerald-200", selected: "bg-emerald-600", ring: "ring-emerald-500" },
  purple: { bg: "bg-purple-100", hover: "hover:bg-purple-200", selected: "bg-purple-600", ring: "ring-purple-500" },
  amber: { bg: "bg-amber-100", hover: "hover:bg-amber-200", selected: "bg-amber-500", ring: "ring-amber-500" },
  rose: { bg: "bg-rose-100", hover: "hover:bg-rose-200", selected: "bg-rose-600", ring: "ring-rose-500" },
  teal: { bg: "bg-teal-100", hover: "hover:bg-teal-200", selected: "bg-teal-600", ring: "ring-teal-500" },
  cyan: { bg: "bg-cyan-100", hover: "hover:bg-cyan-200", selected: "bg-cyan-600", ring: "ring-cyan-500" },
} as const;

const iconMap: Record<string, React.ReactNode> = {
  students: <Users className="w-8 h-8" />,
  admissions: <GraduationCap className="w-8 h-8" />,
  finance: <DollarSign className="w-8 h-8" />,
  academics: <BookOpen className="w-8 h-8" />,
  attendance: <Calendar className="w-8 h-8" />,
  library: <Library className="w-8 h-8" />,
  reports: <BarChart3 className="w-8 h-8" />,
  hr: <FileText className="w-8 h-8" />,
};

export default function SelectModulesPage() {
  const router = useRouter();
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Get active school (required for saving modules)
        const schoolRes = await api.get("/schools/active/");
        console.log("Active school:", schoolRes.data); // Debug
        setSchoolId(schoolRes.data.id);

        // 2. Get real modules from backend
        const modulesRes = await api.get("/modules/");
        console.log("Raw modules from API:", modulesRes.data); // ← very important debug
        const formattedModules: Module[] = modulesRes.data.map((m: any) => ({
          id: m.id.toString(), // UUID as string
          title: m.name,
          description: `Manage ${m.name.toLowerCase()} features`,
          icon: iconMap[m.code] || <Settings className="w-8 h-8" />,
          color: Object.keys(colorMap)[Math.floor(Math.random() * Object.keys(colorMap).length)] as keyof typeof colorMap,
        }));

        setModules(formattedModules);
      } catch (error) {
        console.error("Failed to load data:", error);
        // Fallback to hardcoded modules if API fails (for dev)
        const fallbackModules: Module[] = [
          {
            id: "students",
            title: "Students Management",
            description: "Register students, manage profiles, classes, promotions & records",
            icon: <Users className="w-8 h-8" />,
            color: "blue",
          },
          // ... add your original hardcoded ones here if you want fallback
        ];
        setModules(fallbackModules);
      }
    };

    fetchData();
  }, [router]);

  const toggleModule = (id: string) => {
    setSelectedModuleIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    if (!schoolId || selectedModuleIds.length === 0) {
      alert("Please select at least one module");
      return;
    }

    setIsLoading(true);

    try {
      // Save selected module IDs to the active school
      console.log("Sending PATCH with module_ids:", selectedModuleIds);
      await api.patch(`/schools/${schoolId}/`, {
        module_ids: selectedModuleIds,
      });
      // This ensures next auth resolve sees the updated modules
     await getCurrentUser(true);

      // router.push("/dashboard");
      window.location.href = "/dashboard";
    } catch (error: any) {
      console.error("Failed to save modules:", error);
      alert(error.response?.data?.detail || "Could not save modules. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 lg:py-16">
        {/* Progress Indicator */}
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">1</div>
              <div className="w-20 h-1 bg-blue-600"></div>
            </div>
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">2</div>
              <div className="w-20 h-1 bg-gray-300"></div>
            </div>
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center font-bold">3</div>
              <div className="w-20 h-1 bg-gray-300"></div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center font-bold">4</div>
          </div>
          <p className="text-sm text-gray-600">Step 2 of 4: Select Modules</p>
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Choose Your School Modules
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Select the features your institution needs. You can always enable or disable modules later from settings.
          </p>
        </motion.div>

        {/* Modules Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12"
        >
          {modules.map((module) => {
            const isSelected = selectedModuleIds.includes(module.id);
            const colors = colorMap[module.color];

            return (
              <motion.button
                key={module.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleModule(module.id)}
                className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left group ${
                  isSelected
                    ? `border-transparent ring-4 ${colors.ring} ${colors.selected} text-white shadow-xl`
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
                }`}
              >
                {/* Selected Check */}
                {isSelected && (
                  <div className="absolute top-4 right-4">
                    <div className="w-8 h-8 rounded-full bg-white text-green-600 flex items-center justify-center shadow-sm">
                      <Check className="w-5 h-5" />
                    </div>
                  </div>
                )}

                {/* Icon */}
                <div
                  className={`inline-flex p-4 rounded-xl mb-4 transition-colors ${
                    isSelected ? "bg-white/20" : colors.bg
                  } group-hover:bg-opacity-90`}
                >
                  <div className={isSelected ? "text-white" : `text-${module.color}-600`}>
                    {module.icon}
                  </div>
                </div>

                {/* Content */}
                <h3
                  className={`text-lg font-bold mb-2 transition-colors ${
                    isSelected ? "text-white" : "text-gray-900 group-hover:text-gray-800"
                  }`}
                >
                  {module.title}
                </h3>
                <p
                  className={`text-sm transition-colors ${
                    isSelected ? "text-white/80" : "text-gray-600 group-hover:text-gray-700"
                  }`}
                >
                  {module.description}
                </p>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 sm:px-6 lg:px-8 shadow-lg">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                <span className="font-semibold">{selectedModuleIds.length}</span> module
                {selectedModuleIds.length !== 1 ? "s" : ""} selected
              </p>
            </div>

            <button
              onClick={handleContinue}
              disabled={selectedModuleIds.length === 0 || isLoading}
              className={`px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 ${
                selectedModuleIds.length === 0 || isLoading
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:from-blue-700 hover:to-indigo-700"
              }`}
            >
              {isLoading ? (
                <>Processing...</>
              ) : (
                <>
                 Continue to Dashboard
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Spacer for fixed button */}
        <div className="h-24" />
      </div>
    </div>
  );
}