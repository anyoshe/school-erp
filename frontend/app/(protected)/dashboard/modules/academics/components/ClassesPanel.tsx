"use client";

import api from "@/utils/api";
import { SchoolPrintHeader } from "@/components/print/SchoolPrintHeader";
import { AcademicReportForm } from "@/components/print/ParentAcademicReport";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { toast } from "sonner";
import {
  TrendingUp,
  BookOpen, CalendarRange, Layers, GraduationCap, Plus, Sparkles,
  CheckCircle2, Circle, ChevronRight, Users, Loader2, ClipboardList,
  FileText, ChevronDown,
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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  fetchAcademicYears, createAcademicYear, activateAcademicYear, addTerm,
  setCurrentTerm, setTermLocked, seedDefaultTerms, fetchCurrentCalendar, fetchLearnerProgress,
  fetchGradeLevels, createGradeLevel, createSection,
  fetchClassRegister, ensureGradeSections, assignStudentsToSection,
  fetchSubjects, createSubject, fetchCurricula,
  fetchGradeSubjects, assignSubjectToGrade, removeGradeSubject,
  seedSubjectMap, mapDefaultSubjectsForGrade,
  rolloverAcademicYear, promoteClass, fetchStudentsByGrade,
  fetchCurriculumTemplates, adoptCurriculumTemplate,
  type AcademicYear, type GradeLevel, type CurriculumTemplate, type Term,
  type ClassRegisterStudent, type Subject, type GradeSubject,
  fetchTeachers, syncTeachersFromUsers, fetchTeacherCoverage, assignSubjectTeacher, removeSubjectTeacher, updateSection, assignTeacherAllSubjects,
  fetchReportCard, fetchClassReportCards, type ReportCard, fetchMarksMatrix, saveMarksMatrix, downloadMarksCsvTemplate, importMarksCsv, prepareGradeAssessments, type MarksMatrix,
} from "../services";
import { getApiErrorDetail, gradeLabelFor, type Tab } from "../utils";
import {
  Empty,
  GradeSelect,
  PortalSelectMenu,
  ReadinessRing,
  SubjectSelect,
  TabIcon,
  useMenuPosition,
} from "./shared";

import { AdoptCurriculumPanel } from "./AdoptCurriculumPanel";

export function ClassesPanel({
  grades, curricula, loading, onRefresh,
}: {
  grades: GradeLevel[];
  curricula: { id: number; name: string }[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sectionFor, setSectionFor] = useState<GradeLevel | null>(null);
  const [form, setForm] = useState({
    name: "", short_name: "", order: 1, education_level: "PRIMARY", curriculum: 0,
  });
  const [secName, setSecName] = useState("A");
  const [secCap, setSecCap] = useState("");
  const [register, setRegister] = useState<{
    grade: GradeLevel;
    sectionId?: number | null;
    sectionName?: string | null;
  } | null>(null);
  const [roster, setRoster] = useState<ClassRegisterStudent[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterMeta, setRosterMeta] = useState<{ count: number; title: string }>({ count: 0, title: "" });
  const [teachers, setTeachers] = useState<
    { id: string; full_name?: string; user_email?: string }[]
  >([]);
  const [savingTeacher, setSavingTeacher] = useState<number | null>(null);

  useEffect(() => {
    fetchTeachers()
      .then((list) => setTeachers(list))
      .catch(() => setTeachers([]));
  }, []);

  const setClassTeacher = async (sectionId: number, teacherId: string) => {
    setSavingTeacher(sectionId);
    try {
      await updateSection(sectionId, {
        class_teacher: teacherId ? teacherId : null,
      });
      toast.success(teacherId ? "Class teacher saved" : "Class teacher cleared");
      onRefresh();
    } catch {
      toast.error("Could not set class teacher");
    } finally {
      setSavingTeacher(null);
    }
  };

  const createMut = useMutation({
    mutationFn: () =>
      createGradeLevel({
        ...form,
        curriculum: form.curriculum || curricula[0]?.id,
      }),
    onSuccess: () => {
      toast.success("Grade level created");
      setOpen(false);
      onRefresh();
    },
    onError: () => toast.error("Could not create grade level"),
  });

  const secMut = useMutation({
    mutationFn: () =>
      createSection({
        grade_level: sectionFor!.id,
        name: secName.trim() || "A",
        capacity: secCap ? Number(secCap) : undefined,
      }),
    onSuccess: () => {
      toast.success("Section added");
      setSectionFor(null);
      setSecName("A");
      setSecCap("");
      onRefresh();
    },
    onError: () => toast.error("Could not add section"),
  });

  const ensureMut = useMutation({
    mutationFn: (gradeId: number) => ensureGradeSections(gradeId, ["A"]),
    onSuccess: (data) => {
      toast.success(
        data?.created?.length
          ? `Created section(s): ${data.created.join(", ")}`
          : "Section already exists"
      );
      onRefresh();
    },
    onError: () => toast.error("Could not create default section"),
  });

  const sectionAssignMut = useMutation({
    mutationFn: (payload: {
      grade_level_id: number;
      section_id: number;
      only_unassigned?: boolean;
    }) => assignStudentsToSection(payload),
    onSuccess: (data) => {
      toast.success(
        data.updated
          ? `Moved ${data.updated} learner(s) into section ${data.section}`
          : "No learners needed updating"
      );
      onRefresh();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Could not assign section");
    },
  });

  const openRegister = async (
    grade: GradeLevel,
    sectionId?: number | null,
    sectionName?: string | null
  ) => {
    setRegister({ grade, sectionId, sectionName });
    setRosterLoading(true);
    setRoster([]);
    try {
      const data = await fetchClassRegister({
        grade_level: grade.id,
        section: sectionId,
      });
      setRoster(data.students || []);
      setRosterMeta({
        count: data.count || 0,
        title: data.section
          ? `${data.grade.name} — ${data.section.name}`
          : data.grade.name,
      });
    } catch {
      toast.error("Could not load class register");
    } finally {
      setRosterLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <p className="text-textMuted text-sm">
          Grades and sections are where learners sit. Open a register to see who is enrolled.
        </p>
        <Button className="bg-primary hover:bg-primary-700" onClick={() => setOpen(true)} disabled={!curricula.length}>
          <Plus className="h-4 w-4 mr-2" /> Grade level
        </Button>
      </div>
      {!curricula.length && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          Add a curriculum first (often done during onboarding), then create grade levels.
        </p>
      )}
      {loading ? (
        <div className="h-32 animate-pulse bg-stone-100 rounded-2xl" />
      ) : grades.length === 0 ? (
        <Empty hint="Adopt an academic system first (CBC / 8-4-4) — grades load automatically" />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {grades.slice().sort((a, b) => a.order - b.order).map((g) => {
            const sections = g.sections || [];
            const total = g.student_count ?? 0;
            return (
              <Card key={g.id} className="border-border rounded-2xl overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-semibold text-textPrimary text-lg">{g.name}</p>
                      <p className="text-xs text-textMuted capitalize">
                        {(g.education_level || "").toLowerCase().replace(/_/g, " ") || "Grade"}
                        {g.curriculum_name ? ` · ${g.curriculum_name}` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-primary-50 text-primary-900 border-0">
                      <Users className="h-3 w-3 mr-1" />
                      {total} learners
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {sections.length === 0 ? (
                      <span className="text-xs text-amber-800 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                        No sections yet
                      </span>
                    ) : (
                      sections.map((s) => (
                        <div
                          key={s.id}
                          className="flex flex-col gap-1 rounded-xl border border-border bg-white px-2.5 py-1.5 min-w-[9rem]"
                        >
                          <button
                            type="button"
                            onClick={() => openRegister(g, s.id, s.name)}
                            className="text-left text-xs hover:text-primary transition-colors"
                          >
                            <span className="font-medium">{s.name}</span>
                            <span className="text-muted-foreground ml-1">
                              {s.student_count ?? 0}
                              {s.capacity != null ? `/${s.capacity}` : ""}
                            </span>
                          </button>
                          <select
                            className="h-7 text-[11px] rounded-md border border-input bg-background px-1 max-w-[12rem]"
                            value={s.class_teacher ? String(s.class_teacher) : ""}
                            disabled={savingTeacher === s.id}
                            onChange={(e) => setClassTeacher(s.id, e.target.value)}
                            title="Class / form teacher"
                          >
                            <option value="">Class teacher…</option>
                            {teachers.map((tch) => (
                              <option key={tch.id} value={tch.id}>
                                {tch.full_name || tch.user_email || tch.id}
                              </option>
                            ))}
                          </select>
                          {s.class_teacher_name ? (
                            <span className="text-[10px] text-emerald-700 truncate">
                              {s.class_teacher_name}
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700">No class teacher</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => openRegister(g, null, null)}>
                      Class register
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSectionFor(g)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Section
                    </Button>
                    {sections.length === 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={ensureMut.isPending}
                        onClick={() => ensureMut.mutate(g.id)}
                      >
                        Add default “A”
                      </Button>
                    )}
                    {sections.map((s) => (
                      <Button
                        key={`to-sec-${g.id}-${s.id}`}
                        size="sm"
                        variant="ghost"
                        className="text-primary"
                        disabled={sectionAssignMut.isPending}
                        title={`Assign unsectioned learners to ${s.name}`}
                        onClick={() => {
                          if (
                            !confirm(
                              `Assign all ${g.name} learners who have no section yet to "${s.name}"?`
                            )
                          )
                            return;
                          sectionAssignMut.mutate({
                            grade_level_id: g.id,
                            section_id: s.id,
                            only_unassigned: true,
                          });
                        }}
                      >
                        → {s.name}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New grade */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle>New grade level</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Grade 1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Short name</Label>
                <Input value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} placeholder="G1" />
              </div>
              <div>
                <Label>Order</Label>
                <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-primary" disabled={createMut.isPending} onClick={() => createMut.mutate()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New section */}
      <Dialog open={!!sectionFor} onOpenChange={(v) => !v && setSectionFor(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle>Section for {sectionFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Section name</Label>
              <Input value={secName} onChange={(e) => setSecName(e.target.value)} placeholder="A, B, East…" />
            </div>
            <div>
              <Label>Capacity (optional)</Label>
              <Input type="number" min={1} value={secCap} onChange={(e) => setSecCap(e.target.value)} placeholder="e.g. 40" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionFor(null)}>Cancel</Button>
            <Button className="bg-primary" disabled={secMut.isPending} onClick={() => secMut.mutate()}>Add section</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Class register */}
      <Dialog open={!!register} onOpenChange={(v) => !v && setRegister(null)}>
        <DialogContent className="rounded-2xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Class register — {rosterMeta.title || register?.grade.name}
              {register?.sectionName ? "" : register ? " (all sections)" : ""}
            </DialogTitle>
          </DialogHeader>
          {rosterLoading ? (
            <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading roster…
            </div>
          ) : roster.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No learners placed in this class yet. Enrolled students with this grade appear here.
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{rosterMeta.count} learner(s)</p>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Adm #</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Section</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">{s.admission_number || "—"}</td>
                        <td className="px-3 py-2 font-medium">{s.full_name}</td>
                        <td className="px-3 py-2">{s.section_name || "—"}</td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {s.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between items-stretch sm:items-center">
            <div className="flex flex-wrap gap-2">
              {register &&
                (register.grade.sections || []).map((sec) => (
                  <Button
                    key={`reg-assign-${sec.id}`}
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={sectionAssignMut.isPending}
                    onClick={() => {
                      const onlyUnassigned = !register.sectionId;
                      const msg = onlyUnassigned
                        ? `Assign all ${register.grade.name} learners with no section to "${sec.name}"?`
                        : `Move all learners in this register view into section "${sec.name}"?`;
                      if (!confirm(msg)) return;
                      sectionAssignMut.mutate(
                        {
                          grade_level_id: register.grade.id,
                          section_id: sec.id,
                          only_unassigned: onlyUnassigned,
                        },
                        {
                          onSuccess: () => {
                            openRegister(
                              register.grade,
                              register.sectionId,
                              register.sectionName
                            );
                          },
                        }
                      );
                    }}
                  >
                    {sectionAssignMut.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : null}
                    Assign to {sec.name}
                  </Button>
                ))}
            </div>
            <Button variant="outline" onClick={() => setRegister(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



