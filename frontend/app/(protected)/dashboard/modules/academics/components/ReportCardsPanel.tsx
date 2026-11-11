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

export function ReportCardsPanel({
  grades,
  years,
  loading,
}: {
  grades: GradeLevel[];
  years: AcademicYear[];
  loading: boolean;
}) {
  const [yearId, setYearId] = useState<number | "">("");
  const [termId, setTermId] = useState<number | "">("");
  const [gradeId, setGradeId] = useState<number | "">("");
  const [sectionId, setSectionId] = useState<number | "">("");
  const [cards, setCards] = useState<ReportCard[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const sortedGrades = useMemo(
    () => grades.slice().sort((a, b) => a.order - b.order),
    [grades]
  );
  const activeYear = years.find((y) => y.is_active) || years[0];
  const yearObj = years.find((y) => y.id === yearId) || activeYear;
  const terms = yearObj?.terms || [];
  const gradeObj = grades.find((g) => g.id === gradeId);
  const sections = gradeObj?.sections || [];

  useEffect(() => {
    if (activeYear && yearId === "") setYearId(activeYear.id);
  }, [activeYear, yearId]);

  useEffect(() => {
    if (yearObj) {
      const cur = yearObj.terms?.find((t) => t.is_current) || yearObj.terms?.[0];
      if (cur) setTermId(cur.id);
    }
  }, [yearObj?.id]);

  const load = async () => {
    if (!gradeId) {
      toast.message("Select a grade");
      return;
    }
    setBusy(true);
    try {
      const data = await fetchClassReportCards({
        grade_level: Number(gradeId),
        academic_year: yearId ? Number(yearId) : undefined,
        term: termId ? Number(termId) : undefined,
        section: sectionId ? Number(sectionId) : undefined,
      });
      setCards(data.cards || []);
      setSelectedIdx(0);
      if (!(data.cards || []).length) {
        toast.message("No learners found for this class");
      }
    } catch {
      toast.error("Could not load report cards");
      setCards([]);
    } finally {
      setBusy(false);
    }
  };

  const card = cards[selectedIdx];
  const subjectSummaries = useMemo(() => {
    const summaries = new Map<string, { name: string; total: number; count: number }>();
    for (const report of cards) {
      for (const subject of report.subjects) {
        const summary = summaries.get(subject.subject_id) ?? {
          name: subject.subject_name,
          total: 0,
          count: 0,
        };
        if (subject.average != null) {
          summary.total += subject.average;
          summary.count += 1;
        }
        summaries.set(subject.subject_id, summary);
      }
    }
    return Array.from(summaries.entries())
      .map(([id, summary]) => {
        const average = summary.count
          ? Math.round((summary.total / summary.count) * 10) / 10
          : null;
        return {
          id,
          name: summary.name,
          average,
          learners: summary.count,
          grade: gradeLabelFor(
            average,
            cards[0]?.school.grading_system || "percentage",
            cards[0]?.school.passing_mark ?? 50
          ),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);
  const classOverallAverage = useMemo(() => {
    const averages = cards
      .map((report) => report.overall_average)
      .filter((average): average is number => average != null);
    if (!averages.length) return null;
    return Math.round((averages.reduce((sum, average) => sum + average, 0) / averages.length) * 10) / 10;
  }, [cards]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground max-w-2xl">
        Term report cards from entered marks. Weighted subject averages use assessment weights.
        Print one learner or the whole class (use browser print).
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <Label>Year</Label>
          <select
            className="w-full mt-1 h-10 rounded-md border px-3 text-sm"
            value={yearId === "" ? "" : String(yearId)}
            onChange={(e) => setYearId(e.target.value ? Number(e.target.value) : "")}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Term</Label>
          <select
            className="w-full mt-1 h-10 rounded-md border px-3 text-sm"
            value={termId === "" ? "" : String(termId)}
            onChange={(e) => setTermId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">All / default</option>
            {terms.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Grade</Label>
          <GradeSelect
            grades={grades}
            value={gradeId}
            emptyLabel="Select…"
            onChange={(v) => {
              setGradeId(v);
              setSectionId("");
            }}
          />
        </div>
        <div>
          <Label>Section</Label>
          <select
            className="w-full mt-1 h-10 rounded-md border px-3 text-sm"
            value={sectionId === "" ? "" : String(sectionId)}
            onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">All sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button className="bg-primary" disabled={busy || loading} onClick={load}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Load cards
          </Button>
          {cards.length > 0 && (
            <Button variant="outline" onClick={() => window.print()}>
              Print
            </Button>
          )}
        </div>
      </div>

      {cards.length > 0 && (
        <Card className="border-border rounded-xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="font-semibold">{gradeObj?.name || "Class"} subject averages</h3>
                <p className="text-xs text-muted-foreground">
                  Mean of learners&apos; subject averages; learners without a subject mark are excluded.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Overall class average</p>
                <p className="font-bold tabular-nums">
                  {classOverallAverage == null ? "—" : `${classOverallAverage.toFixed(1)}%`}
                  {" · "}
                  {gradeLabelFor(
                    classOverallAverage,
                    cards[0]?.school.grading_system || "percentage",
                    cards[0]?.school.passing_mark ?? 50
                  )}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2 text-right">Class average</th>
                    <th className="px-3 py-2 text-center">Overall grade</th>
                    <th className="px-3 py-2 text-right">Learners</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectSummaries.map((subject) => (
                    <tr key={subject.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{subject.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {subject.average == null ? "—" : `${subject.average.toFixed(1)}%`}
                      </td>
                      <td className="px-3 py-2 text-center font-semibold text-primary">
                        {subject.grade}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{subject.learners}</td>
                    </tr>
                  ))}
                  {classOverallAverage != null && (
                    <tr className="border-t bg-slate-50 font-semibold">
                      <td className="px-3 py-2">Overall class average</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {classOverallAverage.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-center text-primary">
                        {gradeLabelFor(
                          classOverallAverage,
                          cards[0]?.school.grading_system || "percentage",
                          cards[0]?.school.passing_mark ?? 50
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {cards.filter((report) => report.overall_average != null).length}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {cards.length > 0 && (
        <Card className="border-border rounded-xl print:hidden">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">Class ranking</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Position by overall term average. Learners without marks are listed last.
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Pos</th>
                    <th className="px-3 py-2">Adm</th>
                    <th className="px-3 py-2">Learner</th>
                    <th className="px-3 py-2 text-right">Average</th>
                    <th className="px-3 py-2 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {[...cards]
                    .sort((a, b) => {
                      const ap = a.position ?? 9999;
                      const bp = b.position ?? 9999;
                      if (ap !== bp) return ap - bp;
                      return (a.student.full_name || "").localeCompare(b.student.full_name || "");
                    })
                    .map((c) => {
                      const idx = cards.findIndex((x) => x.student.id === c.student.id);
                      return (
                        <tr
                          key={c.student.id}
                          className={`border-t cursor-pointer hover:bg-primary/5 ${
                            idx === selectedIdx ? "bg-primary/10" : ""
                          }`}
                          onClick={() => setSelectedIdx(idx)}
                        >
                          <td className="px-3 py-2 font-semibold tabular-nums">
                            {c.position != null ? c.position : "—"}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{c.student.admission_number}</td>
                          <td className="px-3 py-2 font-medium">{c.student.full_name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {c.overall_average != null ? `${c.overall_average.toFixed(1)}%` : "—"}
                          </td>
                          <td className="px-3 py-2 text-center font-semibold text-primary">
                            {c.overall_grade || "—"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {cards.length > 1 && (
        <div className="flex flex-wrap gap-2 print:hidden">
          {cards.map((c, i) => (
            <button
              key={c.student.id}
              type="button"
              onClick={() => setSelectedIdx(i)}
              className={`text-xs px-2.5 py-1 rounded-full border ${
                i === selectedIdx
                  ? "bg-primary text-white border-primary"
                  : "bg-white border-border"
              }`}
            >
              {c.student.full_name || c.student.admission_number}
            </button>
          ))}
        </div>
      )}

      {card ? (
        <div className="print-document report-card-print space-y-4">
          <AcademicReportForm data={card as any} />
          {/* Print entire class: each learner on a page */}
          <div className="hidden print:block space-y-0">
            {cards.map((c, i) =>
              i === selectedIdx ? null : (
                <div key={c.student?.id || i} className="break-before-page">
                  <AcademicReportForm data={c as any} />
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        !busy && (
          <p className="text-center text-sm text-muted-foreground py-12">
            Select year, term and grade, then load report cards.
          </p>
        )
      )}
    </div>
  );
}

