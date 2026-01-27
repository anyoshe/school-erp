"use client";

import { useState, useEffect, FormEvent, useMemo } from "react";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import api from "@/utils/api";
import { toast } from "sonner";
import {
  Calendar,
  BookOpen,
  Percent,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const colors = {
  primary: "#1E3A8A",
  secondary: "#10B981",
  accent: "#38BDF8",
  surface: "rgba(255, 255, 255, 0.75)",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface GradeLevel {
  id: string;
  name: string;
  order: number;
  short_name?: string;
  code?: string;
}

interface Curriculum {
  id: string;
  name: string;
}

export default function SchoolAcademicConfigPage() {
  const { currentSchool, refreshSchools } = useCurrentSchool();

  const [formData, setFormData] = useState({
    academicYearStartMonth: "January",
    academicYearEndMonth: "December",
    termSystem: "terms",
    numberOfTerms: 3,
    gradingSystem: "percentage",
    passingMark: 50,
  });

  const [schoolCurriculum, setSchoolCurriculum] = useState<Curriculum | null>(null);
  const [templateCurriculumId, setTemplateCurriculumId] = useState<string | null>(null);

  const [currentGradeLevels, setCurrentGradeLevels] = useState<GradeLevel[]>([]);
  const [templateGradeLevels, setTemplateGradeLevels] = useState<GradeLevel[]>([]);
  const [originalGradeLevels, setOriginalGradeLevels] = useState<GradeLevel[]>([]);
  const [newGradeName, setNewGradeName] = useState("");

  const [loading, setLoading] = useState(false);
  const [gradesLoading, setGradesLoading] = useState(true);

  // Fetch data once on mount + when school changes
  useEffect(() => {
    if (!currentSchool?.id) return;

    const safeMonth = (num?: number) =>
      num && num >= 1 && num <= 12 ? MONTHS[num - 1] : "January";

    setFormData({
      academicYearStartMonth: safeMonth(currentSchool.academic_year_start_month),
      academicYearEndMonth: safeMonth(currentSchool.academic_year_end_month),
      termSystem: currentSchool.term_system ?? "terms",
      numberOfTerms: currentSchool.number_of_terms ?? 3,
      gradingSystem: currentSchool.grading_system ?? "percentage",
      passingMark: currentSchool.passing_mark ?? 50,
    });

    const fetchData = async () => {
      setGradesLoading(true);
      try {
        // 1. Get school's curriculum (one per school)
        const currRes = await api.get("/academics/curricula/", {
          headers: { "X-School-ID": currentSchool.id },
        });
        const schoolCurr = (currRes.data.results || currRes.data)[0];
        setSchoolCurriculum(schoolCurr);

        // 2. Try to match with a template by name
        const templatesRes = await api.get("/academics/curriculum-templates/");
        const matchingTemplate = templatesRes.data.find(
          (t: Curriculum) => t.name === schoolCurr?.name
        );
        if (matchingTemplate) {
          setTemplateCurriculumId(matchingTemplate.id);

          // 3. Fetch template grade levels
          const tempGradesRes = await api.get("/academics/grade-levels/", {
            params: { curriculum: matchingTemplate.id, school__isnull: "true" },
          });
          setTemplateGradeLevels(
            (tempGradesRes.data.results || tempGradesRes.data || []).map((g: any) => ({
              ...g,
              id: String(g.id),
            }))
          );
        }

        // 4. Fetch current school grade levels
        await loadCurrentGrades();
      } catch (err: any) {
        console.error("Initial fetch failed:", err);
        toast.error("Failed to load data", {
          description: err?.response?.data?.detail || "Connection issue",
        });
      } finally {
        setGradesLoading(false);
      }
    };

    fetchData();
  }, [currentSchool]);

  // Helper to reload current grades
  const loadCurrentGrades = async () => {
    if (!currentSchool?.id) return;
    try {
      const res = await api.get("/academics/grade-levels/", {
        headers: { "X-School-ID": currentSchool.id },
      });
      const data = res.data.results || res.data || [];
      const normalized = data.map((g: any) => ({
        ...g,
        id: String(g.id),
      }));
      setCurrentGradeLevels(normalized);
      const originalCopy: GradeLevel[] = normalized.map((g: any) => ({ ...g }));
      setOriginalGradeLevels(originalCopy);
      console.log("Loaded grades:", originalCopy);
    } catch (err) {
      console.error("Failed to reload grades:", err);
    }
  };

  // Available grades = template grades not already in current school grades
  const availableGrades = useMemo(() => {
    const currentNames = new Set(currentGradeLevels.map((g) => g.name.trim().toLowerCase()));
    return templateGradeLevels.filter(
      (g) => !currentNames.has(g.name.trim().toLowerCase())
    );
  }, [currentGradeLevels, templateGradeLevels]);

  const handleChange = (field: keyof typeof formData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addCustomGrade = () => {
    if (!newGradeName.trim()) return;
    const newLevel: GradeLevel = {
      id: `temp-${Date.now()}`,
      name: newGradeName.trim(),
      order: currentGradeLevels.length,
    };
    setCurrentGradeLevels([...currentGradeLevels, newLevel]);
    setNewGradeName("");
  };

  const addFromTemplate = (grade: GradeLevel) => {
    const newLevel: GradeLevel = {
      id: `temp-${Date.now()}`,
      name: grade.name,
      short_name: grade.short_name,
      code: grade.code,
      order: currentGradeLevels.length,
    };
    setCurrentGradeLevels([...currentGradeLevels, newLevel]);
  };

  const removeGradeLevel = (id: string) => {
    setCurrentGradeLevels(currentGradeLevels.filter((g) => g.id !== id));
  };

  const updateGradeName = (id: string, name: string) => {
    setCurrentGradeLevels(
      currentGradeLevels.map((g) => (g.id === id ? { ...g, name } : g))
    );
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const items = Array.from(currentGradeLevels);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    const reindexed = items.map((item, idx) => ({ ...item, order: idx }));
    setCurrentGradeLevels(reindexed);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentSchool?.id) return toast.error("No school selected");

    setLoading(true);

    try {
      console.log("=== BEFORE SUBMIT ===");
      console.log("currentGradeLevels:", currentGradeLevels);
      console.log("originalGradeLevels:", originalGradeLevels);

      // 1. Update school academic config
      const schoolPayload = {
        academic_year_start_month: MONTHS.indexOf(formData.academicYearStartMonth) + 1,
        academic_year_end_month: MONTHS.indexOf(formData.academicYearEndMonth) + 1,
        term_system: formData.termSystem,
        number_of_terms: formData.numberOfTerms,
        grading_system: formData.gradingSystem,
        passing_mark: formData.passingMark,
      };
      await api.patch(`/schools/${currentSchool.id}/`, schoolPayload, {
        headers: { "X-School-ID": currentSchool.id },
      });

      // 2. Sync grade levels (diff-based)
      const currentIds = new Set(currentGradeLevels.map((g) => g.id));
      const originalIds = new Set(originalGradeLevels.map((g) => g.id));

      const toDelete = [...originalIds].filter(
        (id) => !currentIds.has(id) && !String(id).startsWith("temp-")
      );

      console.log("=== Grade Sync Debug ===");
      console.log("Original IDs:", [...originalIds]);
      console.log("Current IDs:", [...currentIds]);
      console.log("To Delete:", toDelete);

      if (toDelete.length > 0) {
        const deleteResults = await Promise.all(
          toDelete.map((id) =>
            api.delete(`/academics/grade-levels/${id}/`, {
              headers: { "X-School-ID": currentSchool.id },
            })
              .then(() => {
                console.log(`✓ Successfully deleted grade ${id}`);
                return { id, success: true };
              })
              .catch((err) => {
                console.error(`✗ Delete failed for ${id}:`, err.response?.data || err.message);
                return { id, success: false, error: err };
              })
          )
        );
        console.log("Delete results:", deleteResults);
      }

      // Create new grades
      const toCreate = currentGradeLevels.filter((g) => g.id.startsWith("temp-"));

      console.log("To Create:", toCreate.length, "new grades");

      const createdPromises = toCreate.map(async (level) => {
        const res = await api.post(
          "/academics/grade-levels/",
          {
            name: level.name,
            order: level.order,
            short_name: level.short_name,
            code: level.code,
            school: currentSchool.id,
            curriculum: schoolCurriculum?.id,
          },
          { headers: { "X-School-ID": currentSchool.id } }
        );
        return { tempId: level.id, realId: String(res.data.id) };
      });

      const createdResults = await Promise.all(createdPromises);

      setCurrentGradeLevels((prev) =>
        prev.map((g) => {
          const created = createdResults.find((c) => c.tempId === g.id);
          return created ? { ...g, id: created.realId } : g;
        })
      );

      await loadCurrentGrades();
      await refreshSchools();

      toast.success("Academic settings saved!", {
        description: "Grade levels updated successfully.",
        style: { background: colors.secondary, color: "white" },
      });
    } catch (error: any) {
      console.error("Save failed:", error);
      toast.error("Failed to save settings", {
        description: error?.response?.data?.detail || "Check your connection or permissions.",
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
        <div
          className="backdrop-blur-xl bg-white/70 border border-white/30 rounded-3xl shadow-2xl shadow-black/5 overflow-hidden"
          style={{ background: colors.surface }}
        >
          {/* Header */}
          <div className="px-8 py-10 bg-gradient-to-r from-[var(--primary)] to-indigo-900 text-white">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <Calendar className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Academic Configuration</h1>
                <p className="text-blue-100/90 mt-1.5 opacity-90">
                  Manage calendar, grading, and grade levels
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-10">
            {/* Academic Year Section */}
            <div className="space-y-6 p-6 bg-white/40 backdrop-blur-sm rounded-2xl border border-slate-200/50">
              <h3 className="text-xl font-semibold flex items-center gap-3 text-slate-800">
                <Calendar className="h-6 w-6 text-[var(--primary)]" />
                Academic Year
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Starts In</Label>
                  <Select
                    value={formData.academicYearStartMonth}
                    onValueChange={(v) => handleChange("academicYearStartMonth", v)}
                  >
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Ends In</Label>
                  <Select
                    value={formData.academicYearEndMonth}
                    onValueChange={(v) => handleChange("academicYearEndMonth", v)}
                  >
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Term & Grading */}
            <div className="space-y-6 p-6 bg-white/40 backdrop-blur-sm rounded-2xl border border-slate-200/50">
              <h3 className="text-xl font-semibold flex items-center gap-3 text-slate-800">
                <BookOpen className="h-6 w-6 text-[var(--primary)]" />
                Term & Grading System
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Term Structure</Label>
                  <Select
                    value={formData.termSystem}
                    onValueChange={(v) => handleChange("termSystem", v)}
                  >
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="terms">Terms</SelectItem>
                      <SelectItem value="semesters">Semesters</SelectItem>
                      <SelectItem value="quarters">Quarters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Number of Terms</Label>
                  <Input
                    type="number"
                    min={1}
                    max={6}
                    value={formData.numberOfTerms}
                    onChange={(e) => handleChange("numberOfTerms", Number(e.target.value))}
                    className="h-12 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Grading System</Label>
                  <Select
                    value={formData.gradingSystem}
                    onValueChange={(v) => handleChange("gradingSystem", v)}
                  >
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (0–100)</SelectItem>
                      <SelectItem value="points">Points scale</SelectItem>
                      <SelectItem value="letter">Letter Grades</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Passing Mark (%)</Label>
                  <div className="relative">
                    <Percent className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={formData.passingMark}
                      onChange={(e) => handleChange("passingMark", Number(e.target.value))}
                      className="h-12 rounded-xl pr-12"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Grade Levels Section */}
            <div className="space-y-6 p-6 bg-white/40 backdrop-blur-sm rounded-2xl border border-slate-200/50">
              <h3 className="text-xl font-semibold flex items-center gap-3 text-slate-800">
                <BookOpen className="h-6 w-6 text-[var(--primary)]" />
                Grade Levels / Classes
              </h3>

              <div className="space-y-6">
                {/* Current Grade Levels - Drag & Drop */}
                <div>
                  <Label className="text-slate-700 font-medium mb-3 block">Current Grade Levels</Label>
                  <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="gradeLevels">
                      {(provided) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className="space-y-3 min-h-[120px]"
                        >
                          {gradesLoading ? (
                            <div className="text-center py-10 text-slate-500">Loading grade levels…</div>
                          ) : currentGradeLevels.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 italic">
                              No grade levels added yet
                            </div>
                          ) : (
                            currentGradeLevels.map((level, index) => (
                              <Draggable key={level.id} draggableId={level.id} index={index}>
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className="flex items-center gap-3 bg-white/70 p-4 rounded-xl border border-slate-200 hover:border-sky-300 transition-all group"
                                  >
                                    <div
                                      {...provided.dragHandleProps}
                                      className="cursor-grab active:cursor-grabbing"
                                    >
                                      <GripVertical className="h-5 w-5 text-slate-400" />
                                    </div>

                                    <Input
                                      value={level.name}
                                      onChange={(e) => updateGradeName(level.id, e.target.value)}
                                      className="flex-1 border-none bg-transparent focus:bg-white focus:ring-0 px-0"
                                    />

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeGradeLevel(level.id)}
                                      className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-5 w-5" />
                                    </Button>
                                  </div>
                                )}
                              </Draggable>
                            ))
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>

                {/* Add New Custom Grade */}
                <div className="flex gap-3">
                  <Input
                    placeholder="Add custom grade (e.g. Grade 13, Advanced Level)"
                    value={newGradeName}
                    onChange={(e) => setNewGradeName(e.target.value)}
                    className="flex-1 h-12 rounded-xl"
                  />
                  <Button
                    type="button"
                    onClick={addCustomGrade}
                    disabled={!newGradeName.trim() || loading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add Custom
                  </Button>
                </div>

                {/* Available Grades from Template */}
                {templateGradeLevels.length > 0 && (
                  <div>
                    <Label className="text-slate-700 font-medium mb-3 block">
                      Available from Curriculum Template
                    </Label>
                    {availableGrades.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 italic bg-slate-50 rounded-xl">
                        All available grade levels are already added
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {availableGrades.map((grade) => (
                          <div
                            key={grade.id}
                            className="flex items-center justify-between p-4 bg-white/70 rounded-xl border border-slate-200 hover:border-sky-300 transition-all"
                          >
                            <span className="font-medium">{grade.name}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addFromTemplate(grade)}
                              className="ml-2"
                            >
                              Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-8">
              <Button
                type="submit"
                disabled={loading}
                size="lg"
                className="min-w-[240px] bg-gradient-to-r from-indigo-800 to-indigo-950 hover:from-indigo-900 hover:to-black text-white shadow-lg transition-all"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    Save Settings
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