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

export function MarksEntryPanel({
  grades,
  years,
  subjects,
  loading,
}: {
  grades: GradeLevel[];
  years: AcademicYear[];
  subjects: Subject[];
  loading?: boolean;
}) {
  const [yearId, setYearId] = useState<number | "">("");
  const [termId, setTermId] = useState<number | "">("");
  const [gradeId, setGradeId] = useState<number | "">("");
  const [sectionId, setSectionId] = useState<number | "">("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [matrix, setMatrix] = useState<MarksMatrix | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
    const csvInputRef = useRef<HTMLInputElement>(null);
  const [sortBy, setSortBy] = useState<"name" | "admission">("name");

  const activeYear = years.find((y) => y.is_active) || years[0];
  const yearObj = years.find((y) => y.id === yearId) || activeYear;
  const terms = yearObj?.terms || [];
  const gradeObj = grades.find((g) => g.id === gradeId);
  const sections = gradeObj?.sections || [];

  useEffect(() => {
    if (activeYear && yearId === "") setYearId(activeYear.id);
  }, [activeYear, yearId]);

  useEffect(() => {
    if (yearObj && termId === "") {
      const cur = yearObj.terms?.find((tm) => tm.is_current) || yearObj.terms?.[0];
      if (cur) setTermId(cur.id);
    }
  }, [yearObj, termId]);

  const cellKey = (studentId: string, assessmentId: string) =>
    `${studentId}__${assessmentId}`;

  
  
  const downloadTemplate = async () => {
    if (!yearId || !termId || !gradeId || !subjectId) {
      toast.message("Select year, term, grade and subject first");
      return;
    }
    try {
      const blob = await downloadMarksCsvTemplate({
        academic_year: Number(yearId),
        term: Number(termId),
        grade_level: Number(gradeId),
        subject: subjectId,
        section: sectionId || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "marks_template.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Template downloaded — fill scores and import");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not download template");
    }
  };

  const onCsvSelected = async (file: File | null) => {
    if (!file) return;
    if (!yearId || !termId || !gradeId || !subjectId) {
      toast.message("Select year, term, grade and subject first");
      return;
    }
    setBusy(true);
    try {
      const res = await importMarksCsv(
        {
          academic_year: Number(yearId),
          term: Number(termId),
          grade_level: Number(gradeId),
          subject: subjectId,
          section: sectionId || undefined,
        },
        file
      );
      const errN = res.error_count || 0;
      if (res.saved) {
        toast.success(
          `Imported ${res.saved} mark(s)` +
            (errN ? ` · ${errN} row issue(s)` : "")
        );
      } else {
        toast.message(errN ? `${errN} issue(s) — nothing saved` : "No marks imported");
      }
      if (res.errors?.length) {
        console.warn("marks csv errors", res.errors);
      }
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "CSV import failed");
    } finally {
      setBusy(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

const prepareAllSubjects = async () => {
    if (!yearId || !termId || !gradeId) {
      toast.message("Select year, term and grade first");
      return;
    }
    setBusy(true);
    try {
      const res = await prepareGradeAssessments({
        academic_year: Number(yearId),
        term: Number(termId),
        grade_level: Number(gradeId),
      });
      toast.success(
        res.assessments_created
          ? `Prepared ${res.assessments_created} assessments across ${res.subjects} subject(s)`
          : `Plans already in place for ${res.subjects} subject(s)`
      );
      if (subjectId) await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not prepare assessments");
    } finally {
      setBusy(false);
    }
  };

const load = async (opts?: { quiet?: boolean }) => {
    if (!yearId || !termId || !gradeId || !subjectId) {
      if (!opts?.quiet) toast.message("Select year, term, grade and subject");
      return;
    }
    setBusy(true);
    try {
      const data = await fetchMarksMatrix({
        academic_year: Number(yearId),
        term: Number(termId),
        grade_level: Number(gradeId),
        subject: subjectId,
        section: sectionId || undefined,
        sort: sortBy === "admission" ? "admission" : "name",
      });
      setMatrix(data);
      const d: Record<string, string> = {};
      for (const row of data.rows) {
        for (const col of data.columns) {
          const cell = row.cells[col.id];
          d[cellKey(row.student_id, col.id)] =
            cell?.score != null && !cell?.is_absent ? String(cell.score) : "";
        }
      }
      setDraft(d);
      if (!opts?.quiet && data.columns.length) {
        toast.success(
          `Markbook ready: ${data.columns.map((column) => column.name).join(" · ")}`
        );
      }
    } catch (e: unknown) {
      if (!opts?.quiet) {
        toast.error(getApiErrorDetail(e) || "Could not load markbook");
        setMatrix(null);
      }
      // quiet refresh: keep previous markbook on screen
    } finally {
      setBusy(false);
    }
  };

  // Auto-open markbook as soon as year/term/grade/subject are chosen
  useEffect(() => {
    if (!yearId || !termId || !gradeId || !subjectId) {
      setMatrix(null);
      setDraft({});
      return;
    }
    // Keep prior grid visible while the next subject loads (no blank flash)
    const handle = window.setTimeout(() => {
      void load({ quiet: true });
    }, 40);
    return () => window.clearTimeout(handle);
    // section + sort also refresh the grid
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearId, termId, gradeId, subjectId, sectionId, sortBy]);

  const save = async () => {
    if (!matrix || !yearId || !termId || !gradeId || !subjectId) return;
    setSaving(true);
    try {
      const marks: {
        student: string;
        assessment: string;
        score?: number | null;
        is_absent?: boolean;
      }[] = [];
      for (const row of matrix.rows) {
        for (const col of matrix.columns) {
          const key = cellKey(row.student_id, col.id);
          const raw = draft[key];
          if (raw === undefined) continue;
          const trimmed = String(raw).trim();
          const prev = row.cells[col.id];
          const prevScore =
            prev?.score != null && !prev?.is_absent ? Number(prev.score) : null;

          if (trimmed === "") {
            // Only clear cells that previously had a value
            if (prevScore != null) {
              marks.push({
                student: row.student_id,
                assessment: col.id,
                score: null,
                is_absent: false,
              });
            }
            continue;
          }
          const n = Number(trimmed);
          if (Number.isNaN(n)) continue;
          if (prevScore === n) continue; // unchanged — skip
          marks.push({
            student: row.student_id,
            assessment: col.id,
            score: n,
            is_absent: false,
          });
        }
      }
      if (!marks.length) {
        toast.message("No changes to save");
        return;
      }
      if ((matrix as any)?.term_locked) {
        toast.error("This term is locked. Unlock it under Years & Terms to edit marks.");
        return;
      }
      const res = await saveMarksMatrix(
        {
          academic_year: Number(yearId),
          term: Number(termId),
          grade_level: Number(gradeId),
          subject: subjectId,
          section: sectionId || undefined,
        },
        marks
      );
      // Patch local matrix so we do not wait for a full reload
      setMatrix((prev) => {
        if (!prev) return prev;
        const nextRows = prev.rows.map((row) => {
          const cells = { ...row.cells };
          for (const col of prev.columns) {
            const key = cellKey(row.student_id, col.id);
            if (!(key in draft)) continue;
            const trimmed = String(draft[key] ?? "").trim();
            if (trimmed === "") {
              cells[col.id] = {
                ...(cells[col.id] || {}),
                score: null,
                is_absent: false,
                percentage: null,
              };
            } else {
              const score = Number(trimmed);
              if (Number.isNaN(score)) continue;
              const max = col.max_score || 100;
              const percentage = max ? (score / max) * 100 : null;
              cells[col.id] = {
                ...(cells[col.id] || {}),
                score,
                is_absent: false,
                percentage,
              };
            }
          }
          return { ...row, cells };
        });
        return { ...prev, rows: nextRows };
      });
      toast.success(`Saved ${res.saved} mark(s)`);
    } catch (e: unknown) {
      toast.error(getApiErrorDetail(e) || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const liveRows = useMemo(() => {
    if (!matrix) return [];
    const rows = matrix.rows.map((row) => {
      let weighted = 0;
      let wsum = 0;
      for (const col of matrix.columns) {
        const raw = draft[cellKey(row.student_id, col.id)];
        if (raw === undefined || String(raw).trim() === "") continue;
        const score = Number(raw);
        if (Number.isNaN(score) || !col.max_score) continue;
        const pct = (score / col.max_score) * 100;
        const weight = col.weight ?? 1;
        weighted += pct * weight;
        wsum += weight;
      }
      const average = wsum > 0 ? Math.round((weighted / wsum) * 10) / 10 : null;
      return { ...row, liveAverage: average };
    });
    return rows.slice().sort((a, b) => {
      if (sortBy === "admission") {
        return (a.admission_number || "").localeCompare(b.admission_number || "", undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }
      return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
    });
  }, [matrix, draft, sortBy]);

  const labelFor = (avg: number | null) => {
    return gradeLabelFor(avg, matrix?.grading_system || "percentage", matrix?.passing_mark ?? 50);
  };
  const classAverage = useMemo(() => {
    const averages = liveRows
      .map((row) => row.liveAverage)
      .filter((average): average is number => average != null);
    if (!averages.length) return null;
    return Math.round((averages.reduce((sum, average) => sum + average, 0) / averages.length) * 10) / 10;
  }, [liveRows]);
  const classAssessmentAverages = useMemo(() => {
    if (!matrix) return [];
    return matrix.columns.map((column) => {
      const scores = matrix.rows
        .filter((row) => !row.cells[column.id]?.is_absent)
        .map((row) => draft[cellKey(row.student_id, column.id)])
        .filter((raw) => raw != null && raw.trim() !== "")
        .map(Number)
        .filter((score) => Number.isFinite(score));
      const average = scores.length
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : null;
      return { id: column.id, average };
    });
  }, [matrix, draft]);

  return (
    <div className="flex flex-col gap-2 h-[min(78vh,calc(100vh-11rem))] min-h-[28rem]">
      <div className="shrink-0 relative z-[80] overflow-visible rounded-xl border bg-white shadow-sm p-2.5 sm:p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground max-w-xl">
            Markbook opens as soon as year, term, grade and subject are selected. Standard columns: CAT 1–3 and End of Term.
            Averages update as you type.
          </p>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              disabled={busy || loading || !yearId || !termId || !gradeId}
              onClick={prepareAllSubjects}
              title="Create CAT 1–3 / End of Term for every subject in this grade"
            >
              Prepare all subjects
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !yearId || !termId || !gradeId || !subjectId}
              onClick={downloadTemplate}
            >
              CSV template
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !yearId || !termId || !gradeId || !subjectId}
              onClick={() => csvInputRef.current?.click()}
            >
              Import CSV
            </Button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onCsvSelected(e.target.files?.[0] || null)}
            />
            <Button size="sm" variant="outline" disabled={busy || loading} onClick={() => load()}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              {busy ? "Loading…" : "Reload"}
            </Button>
            {matrix?.columns.length ? (
              <Button size="sm" className="bg-primary" disabled={saving || !!(matrix as any)?.term_locked} onClick={save}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Save all
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 items-end">
          <div>
            <Label className="text-[11px]">Year</Label>
            <select
              className="w-full mt-0.5 h-9 rounded-md border px-2 text-sm bg-background"
              value={yearId === "" ? "" : String(yearId)}
              onChange={(e) => {
                setYearId(e.target.value ? Number(e.target.value) : "");
                setTermId("");
              }}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[11px]">Term</Label>
            <select
              className="w-full mt-0.5 h-9 rounded-md border px-2 text-sm bg-background"
              value={termId === "" ? "" : String(termId)}
              onChange={(e) => setTermId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Select…</option>
              {terms.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[11px]">Grade</Label>
            <GradeSelect
              grades={grades}
              value={gradeId}
              emptyLabel="Select…"
              className="h-9 w-full mt-0.5 bg-background"
              onChange={(v) => {
                setGradeId(v);
                setSectionId("");
                setMatrix(null);
              }}
            />
          </div>
          <div>
            <Label className="text-[11px]">Section</Label>
            <select
              className="w-full mt-0.5 h-9 rounded-md border px-2 text-sm bg-background"
              value={sectionId === "" ? "" : String(sectionId)}
              onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">All</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1 lg:col-span-2">
            <Label className="text-[11px]">Subject</Label>
            <SubjectSelect
              subjects={subjects}
              value={subjectId}
              className="h-9 w-full mt-0.5 bg-background"
              onChange={(v) => {
                setSubjectId(v);
                setMatrix(null);
              }}
            />
          </div>
        </div>
        {(matrix as any)?.term_locked ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          This term is <strong>locked</strong>. You can view marks but not edit them. Unlock under Years &amp; Terms.
        </p>
      ) : null}
      {matrix ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              {matrix.grade_level.name} · {matrix.subject.name} · {matrix.term.name} ·{" "}
              {matrix.academic_year.name} · grading {matrix.grading_system} (pass{" "}
              {matrix.passing_mark}%) · {liveRows.length} learner(s)
            </p>
            <div className="inline-flex rounded-lg border overflow-hidden text-[11px]">
              <button
                type="button"
                className={`px-2.5 py-1 ${sortBy === "name" ? "bg-primary text-white" : "bg-white text-muted-foreground"}`}
                onClick={() => setSortBy("name")}
              >
                A–Z name
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 border-l ${sortBy === "admission" ? "bg-primary text-white" : "bg-white text-muted-foreground"}`}
                onClick={() => setSortBy("admission")}
              >
                Adm #
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 relative z-[1] rounded-xl border bg-white overflow-hidden flex flex-col">
        {matrix && matrix.columns.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="font-medium">Preparing standard markbook…</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Columns are CAT 1–3 and End of Term (plus Practical for lab subjects).
              Open the markbook again if this stays empty.
            </p>
            <Button disabled={busy} onClick={() => load()}>
              Retry
            </Button>
          </div>
        ) : matrix ? (
          <div className={`flex-1 min-h-0 overflow-auto ${(matrix as any)?.term_locked ? "opacity-95" : ""}`}>
            <div className="table-scroll">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground sticky top-0 z-[1] shadow-sm">
                <tr>
                  <th className="px-2 py-2 sticky left-0 bg-slate-50 z-[2] min-w-[4.5rem]">Adm</th>
                  <th className="px-2 py-2 sticky left-[4.5rem] bg-slate-50 z-[2] min-w-[8rem]">Learner</th>
                  {matrix.columns.map((c) => (
                    <th key={c.id} className="px-1.5 py-2 text-center min-w-[5.5rem] bg-slate-50">
                      <div className="normal-case font-semibold text-foreground text-xs">{c.name}</div>
                      <div className="font-normal normal-case text-[10px] opacity-70">/{c.max_score}</div>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right bg-slate-50">Avg</th>
                  <th className="px-2 py-2 text-center bg-slate-50">Grade</th>
                </tr>
              </thead>
              <tbody>
                {liveRows.map((row) => (
                  <tr key={row.student_id} className="border-t hover:bg-slate-50/80">
                    <td className="px-2 py-1 font-mono text-[11px] sticky left-0 bg-white z-[1]">
                      {row.admission_number}
                    </td>
                    <td className="px-2 py-1 font-medium sticky left-[4.5rem] bg-white z-[1] whitespace-nowrap text-xs">
                      {row.name}
                    </td>
                    {matrix.columns.map((col) => (
                      <td key={col.id} className="px-1 py-0.5">
                        <Input
                          type="number" readOnly={!!(matrix as any)?.term_locked}
                          min={0}
                          max={col.max_score}
                          step="0.5"
                          className="h-8 text-center tabular-nums text-sm px-1"
                          value={draft[cellKey(row.student_id, col.id)] ?? ""}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              [cellKey(row.student_id, col.id)]: e.target.value,
                            }))
                          }
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right tabular-nums font-semibold text-xs">
                      {row.liveAverage != null ? row.liveAverage.toFixed(1) : "—"}
                    </td>
                    <td className="px-2 py-1 text-center font-semibold text-primary text-xs">
                      {labelFor(row.liveAverage)}
                    </td>
                  </tr>
                ))}
                {liveRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={(matrix.columns.length || 0) + 4}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      No learners in this class/section.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              <tfoot className="border-t-2 bg-slate-50 font-semibold text-xs">
                <tr>
                  <th
                    colSpan={2}
                    className="px-2 py-2 text-left sticky left-0 bg-slate-50 z-[1] whitespace-nowrap"
                  >
                    Class average
                  </th>
                  {classAssessmentAverages.map((assessment) => {
                    const column = matrix.columns.find((item) => item.id === assessment.id);
                    return (
                      <td key={assessment.id} className="px-1.5 py-2 text-center tabular-nums">
                        {assessment.average == null
                          ? "—"
                          : `${assessment.average.toFixed(1)}/${column?.max_score ?? ""}`}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-right tabular-nums">
                    {classAverage == null ? "—" : `${classAverage.toFixed(1)}%`}
                  </td>
                  <td className="px-2 py-2 text-center text-primary">
                    {labelFor(classAverage)}
                  </td>
                </tr>
              </tfoot>
            </table>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground px-4 py-8">
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading markbook…
              </span>
            ) : (
              "Select year, term, grade and subject above, then open the markbook."
            )}
          </div>
        )}
      </div>
    </div>
  );
}

