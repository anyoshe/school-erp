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

export function PromotionPanel({
  years, grades, loading, onRefresh,
}: {
  years: AcademicYear[];
  grades: GradeLevel[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const activeYear = years.find((y) => y.is_active) || years[0];
  const sortedGrades = useMemo(
    () => grades.slice().sort((a, b) => a.order - b.order),
    [grades]
  );

  const [targetYearId, setTargetYearId] = useState<number | "">("");
  const [sourceGradeId, setSourceGradeId] = useState<number | "">("");
  const [action, setAction] = useState<"PROMOTE" | "REPEAT" | "GRADUATE">("PROMOTE");
  const [carryFees, setCarryFees] = useState(true);
  const [carryTerm, setCarryTerm] = useState("Term 1");
  const [preview, setPreview] = useState<
    { id: string; admission_number?: string; first_name?: string; last_name?: string; status?: string }[]
  >([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    if (targetYearId !== "" || !years.length) return;
    const next = years.find((y) => !y.is_active) || activeYear;
    if (next) setTargetYearId(next.id);
  }, [years, activeYear, targetYearId]);

  const loadPreview = async (gid: number) => {
    setPreviewLoading(true);
    try {
      const rows = await fetchStudentsByGrade(gid);
      setPreview(rows);
    } catch {
      setPreview([]);
      toast.error("Could not load class list");
    } finally {
      setPreviewLoading(false);
    }
  };

  
  useEffect(() => {
    if (sourceGradeId === "") {
      setPreview([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void loadPreview(Number(sourceGradeId));
    }, 200);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceGradeId]);

const rolloverMut = useMutation({
    mutationFn: () => {
      if (!activeYear) throw new Error("No year");
      return rolloverAcademicYear(activeYear.id, { activate: true });
    },
    onSuccess: (data) => {
      toast.success(
        data.created
          ? `Created and activated ${data.academic_year.name}`
          : `Year ${data.academic_year.name} ready and activated`
      );
      setTargetYearId(data.academic_year.id);
      onRefresh();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Rollover failed");
    },
  });

  const runMut = useMutation({
    mutationFn: () =>
      promoteClass({
        grade_level_id: Number(sourceGradeId),
        academic_year_id: Number(targetYearId),
        action,
        carry_fees: carryFees,
        carry_term: carryTerm,
      }),
    onSuccess: (data) => {
      const arrears = (data.results || []).filter(
        (r) => r.arrears_amount && Number(r.arrears_amount) > 0
      ).length;
      const msg = `${data.source_grade}: ${data.processed} processed` +
        (data.errors?.length ? `, ${data.errors.length} errors` : "") +
        (arrears ? `, ${arrears} with fee arrears carried` : "");
      setLastResult(msg);
      toast.success(msg);
      if (sourceGradeId) loadPreview(Number(sourceGradeId));
      onRefresh();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Promotion failed");
    },
  });

  const targetYear = years.find((y) => y.id === targetYearId);
  const terms = targetYear?.terms || activeYear?.terms || [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-textMuted">
        Close the year by rolling into a new academic year, then promote or retain whole classes.
        Outstanding fees can carry into Term 1 of the new year.
      </p>

      {/* Step 1: New year */}
      <Card className="border-border rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">1. Next academic year</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Active now: </span>
            <span className="font-semibold">{activeYear?.name || "—"}</span>
          </div>
          <Button
            className="bg-primary"
            disabled={!activeYear || rolloverMut.isPending}
            onClick={() => rolloverMut.mutate()}
          >
            {rolloverMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Create next year &amp; activate
          </Button>
          <p className="text-xs text-muted-foreground w-full">
            Creates the following calendar year, seeds Term 1–3, sets Term 1 as current, and deactivates the old year.
          </p>
        </CardContent>
      </Card>

      {/* Step 2: Promote class */}
      <Card className="border-border rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">2. Promote a class</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label>Source grade</Label>
              <GradeSelect
                grades={grades}
                value={sourceGradeId}
                emptyLabel="Select class…"
                getLabel={(g) => `${g.name} (${g.student_count ?? 0})`}
                onChange={(v) => {
                  setSourceGradeId(v);
                  setLastResult(null);
                  if (!v) setPreview([]);
                }}
              />
            </div>
            <div>
              <Label>Into academic year</Label>
              <select
                className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={targetYearId === "" ? "" : String(targetYearId)}
                onChange={(e) => setTargetYearId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Select year…</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}{y.is_active ? " (active)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Action</Label>
              <select
                className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={action}
                onChange={(e) => setAction(e.target.value as typeof action)}
              >
                <option value="PROMOTE">Promote to next grade</option>
                <option value="REPEAT">Repeat same grade</option>
                <option value="GRADUATE">Graduate / leave</option>
              </select>
            </div>
            <div>
              <Label>Carry fee balances into</Label>
              <select
                className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={carryTerm}
                onChange={(e) => setCarryTerm(e.target.value)}
                disabled={!carryFees}
              >
                {(terms.length ? terms : [{ id: 0, name: "Term 1" }, { id: 1, name: "Term 2" }, { id: 2, name: "Term 3" }]).map((tm: any) => (
                  <option key={tm.id || tm.name} value={tm.name}>{tm.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={carryFees}
                  onChange={(e) => setCarryFees(e.target.checked)}
                />
                Carry outstanding fees into new year
              </label>
            </div>
          </div>

          {sourceGradeId !== "" && (
            <div className="rounded-xl border overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 text-xs font-medium text-muted-foreground">
                Learners in this class {previewLoading ? "…" : `(${preview.length})`}
              </div>
              {previewLoading ? (
                <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : preview.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No learners in this grade</p>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  <div className="table-scroll">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-1.5">Adm #</th>
                        <th className="px-3 py-1.5">Name</th>
                        <th className="px-3 py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((s) => (
                        <tr key={s.id} className="border-t">
                          <td className="px-3 py-1.5 font-mono text-xs">{s.admission_number || "—"}</td>
                          <td className="px-3 py-1.5">{s.first_name} {s.last_name}</td>
                          <td className="px-3 py-1.5 text-xs">{s.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={
                !sourceGradeId ||
                !targetYearId ||
                !preview.length ||
                runMut.isPending
              }
              onClick={() => {
                if (
                  !confirm(
                    `Run ${action} for ${preview.length} learner(s)? This updates their class for the selected year.`
                  )
                )
                  return;
                runMut.mutate();
              }}
            >
              {runMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Run {action.toLowerCase()}
            </Button>
            {lastResult && (
              <p className="text-sm text-emerald-800">{lastResult}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


