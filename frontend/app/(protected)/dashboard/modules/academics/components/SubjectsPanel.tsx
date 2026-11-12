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

export function SubjectsPanel({
  subjects, grades, loading, onRefresh,
}: {
  subjects: Subject[];
  grades: GradeLevel[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", is_compulsory: true });
  const [gradeId, setGradeId] = useState<number | "">("");
  const [mapped, setMapped] = useState<GradeSubject[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [assignId, setAssignId] = useState<string>("");

  const sortedGrades = useMemo(
    () => grades.slice().sort((a, b) => a.order - b.order),
    [grades]
  );

  const loadMap = async (gid: number) => {
    setMapLoading(true);
    try {
      const rows = await fetchGradeSubjects(gid);
      setMapped(rows);
    } catch {
      setMapped([]);
      toast.error("Could not load subjects for this grade");
    } finally {
      setMapLoading(false);
    }
  };

  useEffect(() => {
    if (gradeId === "") {
      setMapped([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void loadMap(Number(gradeId));
    }, 200);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeId]);

  const mut = useMutation({
    mutationFn: () => createSubject(form),
    onSuccess: () => {
      toast.success("Subject created");
      setOpen(false);
      setForm({ name: "", code: "", is_compulsory: true });
      onRefresh();
    },
    onError: () => toast.error("Could not create subject"),
  });

  const seedMut = useMutation({
    mutationFn: () => seedSubjectMap(false),
    onSuccess: (data) => {
      toast.success(
        `Catalog ready (${data.subjects} subjects). Mapped ${data.mapped} links across ${data.grades} grades.`
      );
      onRefresh();
      if (gradeId) loadMap(Number(gradeId));
    },
    onError: () => toast.error("Could not seed subject map"),
  });

  const mapGradeMut = useMutation({
    mutationFn: () => mapDefaultSubjectsForGrade(Number(gradeId), false),
    onSuccess: (data) => {
      toast.success(`${data.grade}: added ${data.created} subject(s)`);
      loadMap(Number(gradeId));
      onRefresh();
    },
    onError: () => toast.error("Could not map subjects for grade"),
  });

  const assignMut = useMutation({
    mutationFn: () =>
      assignSubjectToGrade({
        grade_level: Number(gradeId),
        subject: Number(assignId),
        is_compulsory: true,
        order: mapped.length + 1,
      }),
    onSuccess: () => {
      toast.success("Subject assigned");
      setAssignId("");
      loadMap(Number(gradeId));
    },
    onError: (err: any) => {
      const d = err?.response?.data;
      toast.error(d?.detail || d?.non_field_errors?.[0] || "Already assigned or failed");
    },
  });

  const unassigned = subjects.filter(
    (s) => !mapped.some((m) => Number(m.subject) === Number(s.id))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <p className="text-textMuted text-sm">
          Build a subject catalog, then map core and optional subjects to each grade.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={seedMut.isPending}
            onClick={() => seedMut.mutate()}
          >
            {seedMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Seed CBC subject map
          </Button>
          <Button className="bg-primary hover:bg-primary-700" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Subject
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Catalog */}
        <Card className="lg:col-span-2 border-border rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Subject catalog</CardTitle>
            <p className="text-xs text-muted-foreground">{subjects.length} subject(s)</p>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="h-24 animate-pulse bg-stone-100 rounded-xl" />
            ) : subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No subjects yet. Seed the CBC map or add subjects manually.
              </p>
            ) : (
              subjects.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{s.name}</p>
                    {s.code ? (
                      <p className="text-[11px] text-muted-foreground font-mono">{s.code}</p>
                    ) : null}
                  </div>
                  {s.is_compulsory ? (
                    <Badge className="bg-primary/10 text-primary border-0 text-[10px]">Core</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Optional</Badge>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Grade map */}
        <Card className="lg:col-span-3 border-border rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Subjects by grade</CardTitle>
            <p className="text-xs text-muted-foreground">
              Select a grade to view or edit its teaching subjects.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="min-w-[180px] flex-1">
                <Label>Grade</Label>
                <GradeSelect
                  grades={grades}
                  value={gradeId}
                  emptyLabel="Select grade…"
                  onChange={(v) => {
                    setGradeId(v);
                    if (!v) setMapped([]);
                  }}
                />
              </div>
              {gradeId !== "" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={mapGradeMut.isPending}
                  onClick={() => mapGradeMut.mutate()}
                >
                  Apply default subjects
                </Button>
              )}
            </div>

            {!gradeId ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Choose a grade to see its subject list.
              </p>
            ) : mapLoading ? (
              <div className="flex justify-center py-10 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : (
              <>
                <div className="rounded-xl border overflow-hidden">
                  <div className="table-scroll">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Subject</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2 w-20" />
                      </tr>
                    </thead>
                    <tbody>
                      {mapped.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                            No subjects mapped. Use &quot;Apply default subjects&quot; or assign from catalog.
                          </td>
                        </tr>
                      ) : (
                        mapped.map((row, idx) => (
                          <tr key={row.id} className="border-t">
                            <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium">
                              {row.subject_name}
                              {row.subject_code ? (
                                <span className="ml-2 text-[11px] font-mono text-muted-foreground">
                                  {row.subject_code}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">
                              {row.is_compulsory ? (
                                <Badge className="bg-emerald-50 text-emerald-800 border-0 text-[10px]">
                                  Compulsory
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                  Optional
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 h-8"
                                onClick={async () => {
                                  try {
                                    await removeGradeSubject(row.id);
                                    toast.success("Removed");
                                    loadMap(Number(gradeId));
                                  } catch {
                                    toast.error("Could not remove");
                                  }
                                }}
                              >
                                Remove
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>

                {unassigned.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-end pt-1">
                    <div className="min-w-[200px] flex-1">
                      <Label>Assign from catalog</Label>
                      <select
                        className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={assignId}
                        onChange={(e) => setAssignId(e.target.value)}
                      >
                        <option value="">Select subject…</option>
                        {unassigned.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      size="sm"
                      className="bg-primary"
                      disabled={!assignId || assignMut.isPending}
                      onClick={() => assignMut.mutate()}
                    >
                      Assign
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader><DialogTitle>New subject</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mathematics" />
            </div>
            <div>
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MATH" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_compulsory}
                onChange={(e) => setForm({ ...form, is_compulsory: e.target.checked })}
              />
              Compulsory / core subject
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-primary" onClick={() => mut.mutate()} disabled={!form.name || mut.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


