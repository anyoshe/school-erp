// "use client";

// import { useState, useEffect, FormEvent } from "react";
// import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
// import api from "@/utils/api";
// import { toast } from "sonner";
// import { Calendar, BookOpen, Percent, Save, RefreshCw } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { motion } from "framer-motion";

// // ────────────────────────────────────────────────────────────────
// // Color palette (same as your other modern pages)
// const colors = {
//   primary: '#1E3A8A',      // Deep navy
//   secondary: '#10B981',    // Emerald green - success
//   accent: '#38BDF8',       // Sky blue - focus/hover
//   background: '#F8FAFC',
//   surface: 'rgba(255, 255, 255, 0.75)', // Glass base
//   textPrimary: '#0F172A',
//   textMuted: '#64748B',
//   border: 'rgba(226, 232, 240, 0.8)',
// };

// const MONTHS = [
//   "January", "February", "March", "April", "May", "June",
//   "July", "August", "September", "October", "November", "December"
// ];

// export default function SchoolAcademicConfigPage() {
//   const { currentSchool, refreshSchools } = useCurrentSchool();

//   const [formData, setFormData] = useState({
//     academicYearStartMonth: "January",
//     academicYearEndMonth: "December",
//     termSystem: "terms",
//     numberOfTerms: 3,
//     gradingSystem: "percentage",
//     passingMark: 50,
//   });

//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     if (!currentSchool) return;

//     const safeMonth = (monthNum?: number) => {
//       if (!monthNum || monthNum < 1 || monthNum > 12) return "January";
//       return MONTHS[monthNum - 1] || "January";
//     };

//     setFormData({
//       academicYearStartMonth: safeMonth(currentSchool.academic_year_start_month),
//       academicYearEndMonth: safeMonth(currentSchool.academic_year_end_month),
//       termSystem: currentSchool.term_system ?? "terms",
//       numberOfTerms: currentSchool.number_of_terms ?? 3,
//       gradingSystem: currentSchool.grading_system ?? "percentage",
//       passingMark: currentSchool.passing_mark ?? 50,
//     });
//   }, [currentSchool]);

//   const handleChange = (field: keyof typeof formData, value: string | number) => {
//     setFormData((prev) => ({ ...prev, [field]: value }));
//   };

//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();
//     if (!currentSchool?.id) {
//       toast.error("No school selected");
//       return;
//     }

//     setLoading(true);

//     try {
//       const payload = {
//         academic_year_start_month: MONTHS.indexOf(formData.academicYearStartMonth) + 1,
//         academic_year_end_month: MONTHS.indexOf(formData.academicYearEndMonth) + 1,
//         term_system: formData.termSystem,
//         number_of_terms: formData.numberOfTerms,
//         grading_system: formData.gradingSystem,
//         passing_mark: formData.passingMark,
//       };

//       await api.patch(`/schools/${currentSchool.id}/`, payload);
//       await refreshSchools();

//       toast.success("Academic configuration updated!", {
//         description: "School calendar & grading settings saved successfully.",
//         style: { background: colors.secondary, color: 'white' }
//       });
//     } catch (error: any) {
//       toast.error("Failed to save settings", {
//         description: error.response?.data?.detail || "Please check your connection.",
//         style: { background: '#EF4444', color: 'white' }
//       });
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-slate-50 to-indigo-50/30 p-6 md:p-10">
//       <motion.div
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.6 }}
//         className="max-w-4xl mx-auto"
//       >
//         {/* Glass Card Container */}
//         <div
//           className="backdrop-blur-xl bg-white/70 border border-white/30 rounded-3xl shadow-2xl shadow-black/5 overflow-hidden"
//           style={{ background: colors.surface }}
//         >
//           {/* Header */}
//           <div className="px-8 py-10 bg-gradient-to-r from-[var(--primary)] to-indigo-900 text-white">
//             <div className="flex items-center gap-4">
//               <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
//                 <Calendar className="h-8 w-8" />
//               </div>
//               <div>
//                 <h1 className="text-3xl font-bold tracking-tight">Academic Configuration</h1>
//                 <p className="text-blue-100/90 mt-1.5 opacity-90">
//                   Define your school's calendar and grading standards
//                 </p>
//               </div>
//             </div>
//           </div>

//           {/* Form Content */}
//           <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-10">
//             {/* Academic Year Section */}
//             <div className="space-y-6 p-6 bg-white/40 backdrop-blur-sm rounded-2xl border border-slate-200/50">
//               <h3 className="text-xl font-semibold flex items-center gap-3 text-slate-800">
//                 <Calendar className="h-6 w-6 text-[var(--primary)]" />
//                 Academic Year
//               </h3>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                 <div className="space-y-2">
//                   <Label className="text-slate-700 font-medium">Starts In</Label>
//                   <Select
//                     value={formData.academicYearStartMonth}
//                     onValueChange={(v) => handleChange("academicYearStartMonth", v)}
//                   >
//                     <SelectTrigger className="h-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30">
//                       <SelectValue placeholder="Select month" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       {MONTHS.map((month) => (
//                         <SelectItem key={month} value={month}>
//                           {month}
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                 </div>

//                 <div className="space-y-2">
//                   <Label className="text-slate-700 font-medium">Ends In</Label>
//                   <Select
//                     value={formData.academicYearEndMonth}
//                     onValueChange={(v) => handleChange("academicYearEndMonth", v)}
//                   >
//                     <SelectTrigger className="h-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30">
//                       <SelectValue placeholder="Select month" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       {MONTHS.map((month) => (
//                         <SelectItem key={month} value={month}>
//                           {month}
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                 </div>
//               </div>
//             </div>

//             {/* Term & Grading Section */}
//             <div className="space-y-6 p-6 bg-white/40 backdrop-blur-sm rounded-2xl border border-slate-200/50">
//               <h3 className="text-xl font-semibold flex items-center gap-3 text-slate-800">
//                 <BookOpen className="h-6 w-6 text-[var(--primary)]" />
//                 Term & Grading System
//               </h3>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                 <div className="space-y-2">
//                   <Label className="text-slate-700 font-medium">Term Structure</Label>
//                   <Select
//                     value={formData.termSystem}
//                     onValueChange={(v) => handleChange("termSystem", v)}
//                   >
//                     <SelectTrigger className="h-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30">
//                       <SelectValue placeholder="Select term system" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       <SelectItem value="terms">Terms (3 per year)</SelectItem>
//                       <SelectItem value="semesters">Semesters (2 per year)</SelectItem>
//                       <SelectItem value="quarters">Quarters (4 per year)</SelectItem>
//                     </SelectContent>
//                   </Select>
//                 </div>

//                 <div className="space-y-2">
//                   <Label className="text-slate-700 font-medium">Number of Terms/Semesters</Label>
//                   <Input
//                     type="number"
//                     min={2}
//                     max={4}
//                     value={formData.numberOfTerms}
//                     onChange={(e) => handleChange("numberOfTerms", Number(e.target.value))}
//                     className="h-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30"
//                   />
//                 </div>
//               </div>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                 <div className="space-y-2">
//                   <Label className="text-slate-700 font-medium">Grading System</Label>
//                   <Select
//                     value={formData.gradingSystem}
//                     onValueChange={(v) => handleChange("gradingSystem", v)}
//                   >
//                     <SelectTrigger className="h-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30">
//                       <SelectValue placeholder="Select grading system" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       <SelectItem value="percentage">Percentage (0–100%)</SelectItem>
//                       <SelectItem value="points">Points scale (e.g. 12-point)</SelectItem>
//                       <SelectItem value="letter">Letter Grades (A–F)</SelectItem>
//                     </SelectContent>
//                   </Select>
//                 </div>

//                 <div className="space-y-2">
//                   <Label className="text-slate-700 font-medium">Minimum Passing Mark (%)</Label>
//                   <div className="relative">
//                     <Percent className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
//                     <Input
//                       type="number"
//                       min={0}
//                       max={100}
//                       value={formData.passingMark}
//                       onChange={(e) => handleChange("passingMark", Number(e.target.value))}
//                       className="h-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30 pr-12"
//                     />
//                   </div>
//                 </div>
//               </div>
//             </div>

//             {/* Submit */}
//             <div className="flex justify-end pt-8">
//               <Button
//                 type="submit"
//                 disabled={loading}
//                 size="lg"
//                 className="min-w-[240px] bg-gradient-to-r from-[var(--primary)] to-indigo-700 hover:from-indigo-800 hover:to-indigo-900 text-white shadow-lg shadow-indigo-200/40 transition-all duration-300"
//               >
//                 {loading ? (
//                   <>
//                     <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
//                     Saving...
//                   </>
//                 ) : (
//                   <>
//                     <Save className="mr-2 h-5 w-5" />
//                     Save Academic Settings
//                   </>
//                 )}
//               </Button>
//             </div>
//           </form>
//         </div>
//       </motion.div>
//     </div>
//   );
// }

"use client";

import { useState, useEffect, FormEvent } from "react";
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
  Edit,
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

// ────────────────────────────────────────────────────────────────
// Color palette (same as your other modern pages)
const colors = {
  primary: "#1E3A8A",      // Deep navy
  secondary: "#10B981",    // Emerald green - success
  accent: "#38BDF8",       // Sky blue - focus/hover
  background: "#F8FAFC",
  surface: "rgba(255, 255, 255, 0.75)", // Glass base
  textPrimary: "#0F172A",
  textMuted: "#64748B",
  border: "rgba(226, 232, 240, 0.8)",
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

  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [newGradeName, setNewGradeName] = useState("");
  const [loading, setLoading] = useState(false);
  const [gradesLoading, setGradesLoading] = useState(true);

  useEffect(() => {
    if (!currentSchool) return;

    const safeMonth = (monthNum?: number) => {
      if (!monthNum || monthNum < 1 || monthNum > 12) return "January";
      return MONTHS[monthNum - 1] || "January";
    };

    setFormData({
      academicYearStartMonth: safeMonth(currentSchool.academic_year_start_month),
      academicYearEndMonth: safeMonth(currentSchool.academic_year_end_month),
      termSystem: currentSchool.term_system ?? "terms",
      numberOfTerms: currentSchool.number_of_terms ?? 3,
      gradingSystem: currentSchool.grading_system ?? "percentage",
      passingMark: currentSchool.passing_mark ?? 50,
    });

    // Load current grade levels
    const fetchGrades = async () => {
      setGradesLoading(true);
      try {
        const res = await api.get("/academics/grade-levels/");
        setGradeLevels(res.data.results || res.data);
      } catch (err) {
        toast.error("Failed to load grade levels");
      } finally {
        setGradesLoading(false);
      }
    };

    fetchGrades();
  }, [currentSchool]);

  const handleChange = (field: keyof typeof formData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addGradeLevel = () => {
    if (!newGradeName.trim()) return;
    const newLevel = {
      id: `temp-${Date.now()}`, // temp ID until saved
      name: newGradeName.trim(),
      order: gradeLevels.length,
    };
    setGradeLevels([...gradeLevels, newLevel]);
    setNewGradeName("");
  };

  const removeGradeLevel = (id: string) => {
    setGradeLevels(gradeLevels.filter((g) => g.id !== id));
  };

  const updateGradeName = (id: string, name: string) => {
    setGradeLevels(
      gradeLevels.map((g) => (g.id === id ? { ...g, name } : g))
    );
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const items = Array.from(gradeLevels);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order
    const updated = items.map((item, index) => ({
      ...item,
      order: index,
    }));

    setGradeLevels(updated);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentSchool?.id) {
      toast.error("No school selected");
      return;
    }

    setLoading(true);

    try {
      // 1. Update school academic config
      const schoolPayload = {
        academic_year_start_month: MONTHS.indexOf(formData.academicYearStartMonth) + 1,
        academic_year_end_month: MONTHS.indexOf(formData.academicYearEndMonth) + 1,
        term_system: formData.termSystem,
        number_of_terms: formData.numberOfTerms,
        grading_system: formData.gradingSystem,
        passing_mark: formData.passingMark,
      };

      await api.patch(`/schools/${currentSchool.id}/`, schoolPayload);

      // 2. Sync grade levels (create/update/delete)
      // For simplicity, we delete all existing and recreate (safe for small lists)
      // In production, you can diff and only update changed ones

      // Optional: delete old ones first
      await api.delete(`/academics/grade-levels/bulk-delete/`, {
        data: { ids: gradeLevels.map(g => g.id).filter(id => !id.startsWith("temp-")) },
      });

      // Create new/updated
      for (const level of gradeLevels) {
        const payload = {
          name: level.name,
          order: level.order,
          school: currentSchool.id,
          // curriculum: ... (add if you want to link)
        };

        if (level.id.startsWith("temp-")) {
          await api.post("/academics/grade-levels/", payload);
        } else {
          await api.patch(`/academics/grade-levels/${level.id}/`, payload);
        }
      }

      await refreshSchools();

      toast.success("Academic configuration updated!", {
        description: "Calendar, grading, and grade levels saved.",
        style: { background: colors.secondary, color: "white" },
      });
    } catch (error: any) {
      toast.error("Failed to save settings", {
        description: error.response?.data?.detail || "Please check your connection.",
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

          {/* Form Content */}
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
                    <SelectTrigger className="h-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month) => (
                        <SelectItem key={month} value={month}>
                          {month}
                        </SelectItem>
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
                    <SelectTrigger className="h-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month) => (
                        <SelectItem key={month} value={month}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Term & Grading Section */}
            <div className="space-y-6 p-6 bg-white/40 backdrop-blur-sm rounded-2xl border border-slate-200/50">
              <h3 className="text-xl font-semibold flex items-center gap-3 text-slate-800">
                <BookOpen className="h-6 w-6 text-[var(--primary)]" />
                Term & Grading System
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Term Structure</Label>
                  <Select
                    value={formData.termSystem}
                    onValueChange={(v) => handleChange("termSystem", v)}
                  >
                    <SelectTrigger className="h-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30">
                      <SelectValue placeholder="Select term system" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="terms">Terms (3 per year)</SelectItem>
                      <SelectItem value="semesters">Semesters (2 per year)</SelectItem>
                      <SelectItem value="quarters">Quarters (4 per year)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Number of Terms/Semesters</Label>
                  <Input
                    type="number"
                    min={2}
                    max={4}
                    value={formData.numberOfTerms}
                    onChange={(e) => handleChange("numberOfTerms", Number(e.target.value))}
                    className="h-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Grading System</Label>
                  <Select
                    value={formData.gradingSystem}
                    onValueChange={(v) => handleChange("gradingSystem", v)}
                  >
                    <SelectTrigger className="h-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30">
                      <SelectValue placeholder="Select grading system" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (0–100%)</SelectItem>
                      <SelectItem value="points">Points scale (e.g. 12-point)</SelectItem>
                      <SelectItem value="letter">Letter Grades (A–F)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Minimum Passing Mark (%)</Label>
                  <div className="relative">
                    <Percent className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={formData.passingMark}
                      onChange={(e) => handleChange("passingMark", Number(e.target.value))}
                      className="h-12 rounded-xl border-slate-200 focus:border-[var(--accent)] focus:ring-[var(--accent)]/30 pr-12"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Grade Levels Management */}
            <div className="space-y-6 p-6 bg-white/40 backdrop-blur-sm rounded-2xl border border-slate-200/50">
              <h3 className="text-xl font-semibold flex items-center gap-3 text-slate-800">
                <BookOpen className="h-6 w-6 text-[var(--primary)]" />
                Grade Levels / Classes
              </h3>

              <div className="space-y-4">
                {/* Add new grade */}
                <div className="flex gap-3">
                  <Input
                    placeholder="e.g. Grade 5, Form 2, Year 9"
                    value={newGradeName}
                    onChange={(e) => setNewGradeName(e.target.value)}
                    className="flex-1 h-12 rounded-xl border-slate-200 focus:border-[var(--accent)]"
                  />
                  <Button
                    type="button"
                    onClick={addGradeLevel}
                    disabled={!newGradeName.trim()}
                    className="bg-[var(--secondary)] hover:bg-emerald-700 text-white"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add Grade
                  </Button>
                </div>

                {/* Draggable list */}
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="gradeLevels">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-2 min-h-[100px]"
                      >
                        {gradesLoading ? (
                          <div className="text-center py-8 text-slate-500">
                            Loading grade levels...
                          </div>
                        ) : gradeLevels.length === 0 ? (
                          <div className="text-center py-8 text-slate-400 italic">
                            No grade levels defined yet
                          </div>
                        ) : (
                          gradeLevels.map((level, index) => (
                            <Draggable key={level.id} draggableId={level.id} index={index}>
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className="flex items-center gap-3 bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-slate-200/50 hover:border-[var(--accent)]/50 transition-all group"
                                >
                                  <div {...provided.dragHandleProps} className="cursor-grab">
                                    <GripVertical className="h-5 w-5 text-slate-400" />
                                  </div>

                                  <Input
                                    value={level.name}
                                    onChange={(e) => updateGradeName(level.id, e.target.value)}
                                    className="flex-1 border-none bg-transparent focus:bg-white/80 focus:ring-0"
                                  />

                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeGradeLevel(level.id)}
                                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 hover:bg-red-50"
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
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-8">
              <Button
                type="submit"
                disabled={loading}
                size="lg"
                className="min-w-[240px] bg-gradient-to-r from-[var(--primary)] to-indigo-700 hover:from-indigo-800 hover:to-indigo-900 text-white shadow-lg shadow-indigo-200/40 transition-all duration-300"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    Save Academic Settings
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