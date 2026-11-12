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

export function LearnerProgressPanel() {
  const [q, setQ] = useState("");
  const [students, setStudents] = useState<{ id: string; name: string; admission_number?: string }[]>([]);
  const [studentId, setStudentId] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchLearnerProgress>> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/students/", { params: { page_size: 200 } });
        const list = res.data?.results ?? res.data ?? [];
        const rows = (Array.isArray(list) ? list : []).map((s: any) => ({
          id: String(s.id),
          name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.admission_number || "Student",
          admission_number: s.admission_number,
        }));
        if (!cancelled) setStudents(rows);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = students.filter((s) => {
    if (!q.trim()) return true;
    const blob = `${s.name} ${s.admission_number || ""}`.toLowerCase();
    return blob.includes(q.trim().toLowerCase());
  });

  const load = async (id: string) => {
    setStudentId(id);
    setBusy(true);
    try {
      const d = await fetchLearnerProgress(id);
      setData(d);
    } catch (e: unknown) {
      toast.error(getApiErrorDetail(e) || "Could not load progress");
      setData(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Learner progress</CardTitle>
          <p className="text-sm text-muted-foreground">
            Full history by year and term — from joining to date. Marks stay after promotion.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Search learner by name or admission number"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="max-h-40 overflow-y-auto rounded-lg border divide-y">
            {filtered.slice(0, 40).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => load(s.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 ${
                  studentId === s.id ? "bg-primary/10" : ""
                }`}
              >
                <span className="font-medium">{s.name}</span>
                {s.admission_number ? (
                  <span className="text-muted-foreground ml-2 text-xs">{s.admission_number}</span>
                ) : null}
              </button>
            ))}
            {!filtered.length && (
              <p className="px-3 py-4 text-sm text-muted-foreground">No learners match.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {busy && <p className="text-sm text-muted-foreground">Loading progress…</p>}

      {data && !busy && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold">{data.student.name}</h3>
              <p className="text-sm text-muted-foreground">
                {data.student.admission_number}
                {data.student.current_class ? ` · now ${data.student.current_class}` : ""}
              </p>
            </div>
          </div>

          {(data.periods || []).map((p, idx) => (
            <Card key={idx} className="border-border rounded-2xl overflow-hidden">
              <CardHeader className="py-3 bg-slate-50">
                <CardTitle className="text-sm font-semibold">
                  {p.academic_year?.name} · {p.term?.name} · {p.grade_level?.name}
                  {p.overall_average != null ? (
                    <span className="ml-2 text-primary">
                      Overall {p.overall_average}% {p.overall_grade || ""}
                    </span>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left px-3 py-2">Subject</th>
                      <th className="text-right px-3 py-2">Average</th>
                      <th className="text-center px-3 py-2">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(p.subjects || []).map((s) => (
                      <tr key={s.subject_name} className="border-t">
                        <td className="px-3 py-1.5">{s.subject_name}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {s.average != null ? `${s.average}%` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-center font-medium">{s.grade_letter || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </CardContent>
            </Card>
          ))}

          {(data.subject_trends || []).length > 0 && (
            <Card className="border-border rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Subject trends</CardTitle>
                <p className="text-xs text-muted-foreground">Average % across terms (growth at a glance)</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data.subject_trends || []).map((tr) => (
                  <div key={tr.subject_name}>
                    <p className="text-sm font-medium mb-1">{tr.subject_name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(tr.points || []).map((pt, i) => (
                        <span
                          key={i}
                          className="text-[11px] px-2 py-1 rounded-md bg-primary/10 text-primary-900 border border-primary/20 tabular-nums"
                          title={`${pt.academic_year} ${pt.term} (${pt.grade})`}
                        >
                          {pt.term}: {pt.average}%
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {!data.periods?.length && (
            <p className="text-sm text-muted-foreground">No marks recorded for this learner yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
