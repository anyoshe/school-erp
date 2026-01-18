"use client";

import { useEffect, useState } from "react";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import api from "@/utils/api";
import { toast } from "sonner";
import {
  Users,
  BookOpen,
  DollarSign,
  Calendar,
  Library,
  GraduationCap,
  FileText,
  BarChart3,
  Settings,
  Plus,
  X,
  RefreshCw,
  Book,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ---------------------------------- */
/* Types                               */
/* ---------------------------------- */
interface Module {
  id: number;
  name: string;
  code: string;
  description?: string;
}

/* ---------------------------------- */
/* Icon Mapping                        */
/* ---------------------------------- */
const iconMap: Record<string, React.ReactNode> = {
  students: <Users className="w-8 h-8" />,
  admissions: <GraduationCap className="w-8 h-8" />,
  finance: <DollarSign className="w-8 h-8" />,
  academics: <BookOpen className="w-8 h-8" />,
  attendance: <Calendar className="w-8 h-8" />,
  library: <Library className="w-8 h-8" />,
  reports: <BarChart3 className="w-8 h-8" />,
  hr: <FileText className="w-8 h-8" />,
  parent_portal: <Users className="w-8 h-8" />,
  alumni: <GraduationCap className="w-8 h-8" />,
  transport: <Users className="w-8 h-8" />,
  procurement: <DollarSign className="w-8 h-8" />,
  health: <Book className="w-8 h-8" />,
  default: <Settings className="w-8 h-8" />,
};


export default function ModulesSettingsPage() {
  const { currentSchool, refreshSchools } = useCurrentSchool();

  const [allModules, setAllModules] = useState<Module[]>([]);
  const [enabledModuleIds, setEnabledModuleIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentSchool) return;

    const loadModules = async () => {
      try {
        setLoading(true);

        const modulesRes = await api.get("/modules/");
        const normalizedModules = modulesRes.data.map((m: any) => ({
          ...m,
          id: Number(m.id),
        }));
        setAllModules(normalizedModules);

        const enabledModulesData = currentSchool?.modules || [];
        const enabledIds = enabledModulesData
          .map(m => Number(m.id))
          .filter(id => !isNaN(id));

        setEnabledModuleIds(enabledIds);
      } catch (err) {
        console.error(err);
        toast.error("Could not load modules");
      } finally {
        setLoading(false);
      }
    };

    loadModules();
  }, [currentSchool]);

  const toggleModule = (moduleId: number) => {
    setEnabledModuleIds((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleSave = async () => {
    if (!currentSchool?.id) return;

    try {
      setSaving(true);
      await api.patch(`/schools/${currentSchool.id}/`, {
        module_ids: enabledModuleIds,
      });

      await refreshSchools();
      toast.success("Modules updated successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to save modules");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        <RefreshCw className="w-6 h-6 mr-2 animate-spin" />
        Loading modules...
      </div>
    );
  }

  const enabledModules = allModules.filter((m) => enabledModuleIds.includes(m.id));
  const availableModules = allModules.filter((m) => !enabledModuleIds.includes(m.id));

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-16">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Manage School Modules</h1>
          <p className="text-lg text-gray-600 mt-3">
            Choose which features should be active for this school
          </p>
        </div>

        {/* SECTION 1: Currently Active Modules */}
        <section className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              Active Modules
              <Badge 
                variant="outline" 
                className="bg-green-50 text-green-700 border-green-200 px-3 py-1 text-sm"
              >
                {enabledModules.length}
              </Badge>
            </h2>
          </div>

          {enabledModules.length === 0 ? (
            <div className="text-center py-16 bg-white/80 rounded-2xl border border-dashed border-gray-300 text-gray-500 shadow-sm">
              No modules are currently active for this school
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enabledModules.map((module) => {
                const Icon = iconMap[module.code] || iconMap.default;
                return (
                  <Card
                    key={module.id}
                    className="border border-gray-200 bg-white/80 backdrop-blur-sm hover:shadow-md hover:border-gray-300 transition-all duration-300 rounded-xl overflow-hidden"
                  >
                    <CardHeader className="pb-4 bg-gradient-to-r from-gray-50 to-white">
                      <div className="flex items-center justify-between">
                        <div className="p-3 rounded-lg bg-primary/10 text-primary">
                          {Icon}
                        </div>
                        <Badge className="bg-green-600 text-white border-none px-3 py-1">
                          Active
                        </Badge>
                      </div>
                      <CardTitle className="mt-5 text-xl font-semibold text-gray-900">
                        {module.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <p className="text-sm text-gray-600 mb-6 min-h-[3.5rem]">
                        {module.description || `Manage ${module.name.toLowerCase()} features`}
                      </p>
                      <Button
                        variant="destructive"
                        size="default"
                        className="w-full bg-red-600 hover:bg-red-700 text-white transition-colors"
                        onClick={() => toggleModule(module.id)}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Disable Module
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION 2: Available to Enable */}
        <section className="space-y-8">
          <h2 className="text-2xl font-bold text-gray-900">Available Modules</h2>

          {availableModules.length === 0 ? (
            <div className="text-center py-16 bg-white/80 rounded-2xl border border-dashed border-gray-300 text-gray-500 shadow-sm">
              All available modules are already enabled ✓
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableModules.map((module) => {
                const Icon = iconMap[module.code] || iconMap.default;
                return (
                  <Card
                    key={module.id}
                    className="border border-gray-200 bg-white/80 backdrop-blur-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 rounded-xl overflow-hidden"
                  >
                    <CardHeader className="pb-4 bg-gradient-to-r from-gray-50 to-white">
                      <div className="p-3 rounded-lg bg-primary/10 text-primary inline-block">
                        {Icon}
                      </div>
                      <CardTitle className="mt-5 text-xl font-semibold text-gray-900">
                        {module.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <p className="text-sm text-gray-600 mb-6 min-h-[3.5rem]">
                        {module.description || `Manage ${module.name.toLowerCase()} features`}
                      </p>
                      <Button
                        size="default"
                        className="w-full bg-primary hover:bg-primary/90 text-white transition-colors"
                        onClick={() => toggleModule(module.id)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Enable Module
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Floating Save Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200 px-6 py-5 shadow-2xl z-50">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              <span className="font-bold text-gray-900">{enabledModuleIds.length}</span> active module
              {enabledModuleIds.length !== 1 ? "s" : ""}
            </p>

            <Button
              onClick={handleSave}
              disabled={saving || enabledModuleIds.length === 0}
              className="min-w-[180px] bg-primary hover:bg-primary/90 text-white shadow-lg"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>

        {/* Bottom spacer */}
        <div className="h-24 md:h-32" />
      </div>
    </div>
  );
}