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

export function TeachersPanel({
  grades,
  years,
  loading,
}: {
  grades: GradeLevel[];
  years: AcademicYear[];
  loading: boolean;
}) {
  const [gradeId, setGradeId] = useState<number | "">("");
  const [yearId, setYearId] = useState<number | "">("");
  const [teachers, setTeachers] = useState<
    { id: string; full_name?: string; user_email?: string }[]
  >([]);
  const [coverage, setCoverage] = useState<{
    total_subjects: number;
    assigned_subjects: number;
    unassigned_subjects: number;
    rows: {
      subject: number | string;
      subject_name: string;
      is_compulsory?: boolean;
      assigned: boolean;
      assignments: {
        id: number | string;
        teacher_name?: string;
        teacher_email?: string;
        teacher: string;
      }[];
    }[];
    academic_year: { id: number; name: string } | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<Record<string, string>>({});

  const sortedGrades = useMemo(
    () => grades.slice().sort((a, b) => a.order - b.order),
    [grades]
  );
  const activeYear = years.find((y) => y.is_active) || years[0];

  useEffect(() => {
    if (activeYear && yearId === "") setYearId(activeYear.id);
  }, [activeYear, yearId]);

  const loadTeachers = async () => {
    try {
      let list = await fetchTeachers();
      if (!list.length) {
        const synced = await syncTeachersFromUsers();
        list = synced.teachers || [];
        if (synced.created) {
          toast.success(`Linked ${synced.created} teacher account(s)`);
        }
      }
      setTeachers(list);
    } catch {
      setTeachers([]);
    }
  };

  const loadCoverage = async (gid: number, yid: number | "") => {
    if (!gid) {
      setCoverage(null);
      return;
    }
    setBusy(true);
    try {
      const data = await fetchTeacherCoverage({
        grade_level: Number(gid),
        academic_year: yid ? Number(yid) : undefined,
      });
      setCoverage(data);
    } catch {
      toast.error("Could not load teacher coverage");
      setCoverage(null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, []);

  // Debounce so native <select> can finish open/close without a remount mid-gesture
  useEffect(() => {
    if (!gradeId) {
      setCoverage(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void loadCoverage(Number(gradeId), yearId);
    }, 200);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeId, yearId]);

  const assignAllSubjects = async () => {
    if (!gradeId || !yearId) {
      toast.message("Select grade and year first");
      return;
    }
    const teacherId =
      Object.values(pick).find((v) => v) ||
      (teachers[0] && teachers[0].id) ||
      "";
    // Prefer explicit pick from a dedicated select if present
    const selected =
      (document.getElementById("bulk-teacher-pick") as HTMLSelectElement | null)
        ?.value || teacherId;
    if (!selected) {
      toast.message("Choose a teacher for bulk assign");
      return;
    }
    if (
      !confirm(
        "Assign this teacher to ALL subjects mapped for this grade and year?"
      )
    )
      return;
    setBusy(true);
    try {
      const r = await assignTeacherAllSubjects({
        grade_level: Number(gradeId),
        academic_year: Number(yearId),
        teacher: selected,
      });
      toast.success(
        r.created
          ? `Assigned ${r.created} subject(s) (${r.existing} already linked)`
          : `All ${r.existing} subjects already assigned to this teacher`
      );
      await loadCoverage(Number(gradeId), yearId);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Bulk assign failed");
    } finally {
      setBusy(false);
    }
  };

  const assign = async (subjectId: number | string) => {
    const teacher = pick[String(subjectId)];
    const y = yearId || activeYear?.id;
    if (!teacher || !gradeId || !y) {
      toast.message("Select a teacher and ensure an academic year is active");
      return;
    }
    setBusy(true);
    try {
      await assignSubjectTeacher({
        subject: subjectId,
        grade_level: Number(gradeId),
        teacher,
        academic_year: Number(y),
        is_active: true,
      });
      toast.success("Teacher assigned");
      await loadCoverage(Number(gradeId), yearId);
    } catch (err: any) {
      const d = err?.response?.data;
      toast.error(
        typeof d === "string"
          ? d
          : d?.detail || d?.non_field_errors?.[0] || "Assignment failed"
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number | string) => {
    if (!confirm("Remove this teacher assignment?")) return;
    setBusy(true);
    try {
      await removeSubjectTeacher(id);
      toast.success("Assignment removed");
      await loadCoverage(Number(gradeId), yearId);
    } catch {
      toast.error("Could not remove assignment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3 items-start">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Assign teachers to subjects for each class. Unassigned subjects show here so you can
          fill gaps before timetable and marks entry.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              const r = await syncTeachersFromUsers();
              setTeachers(r.teachers || []);
              toast.success(
                r.created
                  ? `Created ${r.created} staff profile(s) from teacher users`
                  : "Teacher list up to date"
              );
            } catch {
              toast.error("Could not sync teachers — add staff under HR or create teacher users");
            }
          }}
        >
          Sync teacher users
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 max-w-xl">
        <div>
          <Label>Academic year</Label>
          <select
            className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={yearId === "" ? "" : String(yearId)}
            onChange={(e) => setYearId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Select year…</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
                {y.is_active ? " (active)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Grade / class</Label>
          <GradeSelect
            grades={grades}
            value={gradeId}
            emptyLabel="Select class…"
            onChange={setGradeId}
          />
        </div>
      </div>

      {!teachers.length && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          No teacher staff profiles yet. Use <strong>Sync teacher users</strong> if accounts
          with role Teacher exist, or create staff under Human Resources.
        </p>
      )}

      {!gradeId ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          Choose a grade to see subject coverage and assign teachers.
        </p>
      ) : busy || loading ? (
        <div className="flex justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading coverage…
        </div>
      ) : coverage ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end justify-between">
            <div className="flex flex-wrap gap-2 text-sm items-center">
            <Badge variant="secondary">
              {coverage.assigned_subjects}/{coverage.total_subjects} subjects covered
            </Badge>
            {coverage.unassigned_subjects > 0 && (
              <Badge variant="outline" className="border-amber-300 text-amber-800">
                {coverage.unassigned_subjects} unassigned
              </Badge>
            )}
            {coverage.academic_year && (
              <Badge variant="outline">Year {coverage.academic_year.name}</Badge>
            )}
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <Label className="text-xs">Bulk assign</Label>
                <select
                  id="bulk-teacher-pick"
                  className="mt-1 h-9 rounded-md border px-2 text-sm min-w-[12rem] block"
                >
                  <option value="">Select teacher…</option>
                  {teachers.map((tch) => (
                    <option key={tch.id} value={tch.id}>
                      {tch.full_name || tch.user_email || tch.id}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || !yearId}
                onClick={assignAllSubjects}
              >
                Assign to all subjects
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Assigned teacher(s)</th>
                  <th className="px-3 py-2">Assign</th>
                </tr>
              </thead>
              <tbody>
                {coverage.rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                      No subjects mapped to this grade. Map subjects under the Subjects tab
                      first.
                    </td>
                  </tr>
                ) : (
                  coverage.rows.map((row) => (
                    <tr key={String(row.subject)} className="border-t align-top">
                      <td className="px-3 py-2 font-medium">
                        {row.subject_name}
                        {row.is_compulsory === false && (
                          <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.assignments?.length ? (
                          <ul className="space-y-1">
                            {row.assignments.map((a) => (
                              <li key={String(a.id)} className="flex items-center gap-2">
                                <span>
                                  {a.teacher_name || a.teacher_email || a.teacher}
                                </span>
                                <button
                                  type="button"
                                  className="text-xs text-red-600 hover:underline"
                                  onClick={() => remove(a.id)}
                                >
                                  Remove
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-amber-700 text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2 items-center">
                          <select
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[10rem]"
                            value={pick[String(row.subject)] || ""}
                            onChange={(e) =>
                              setPick((p) => ({
                                ...p,
                                [String(row.subject)]: e.target.value,
                              }))
                            }
                          >
                            <option value="">Teacher…</option>
                            {teachers.map((tch) => (
                              <option key={tch.id} value={tch.id}>
                                {tch.full_name || tch.user_email || tch.id}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!pick[String(row.subject)]}
                            onClick={() => assign(row.subject)}
                          >
                            Assign
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}


