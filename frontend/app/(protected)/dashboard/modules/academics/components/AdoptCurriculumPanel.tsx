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

export function AdoptCurriculumPanel({
  templates,
  loading,
  onAdopted,
}: {
  templates: CurriculumTemplate[];
  loading: boolean;
  onAdopted: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const mut = useMutation({
    mutationFn: () => adoptCurriculumTemplate(selected!),
    onSuccess: () => {
      toast.success("Academic system loaded — grade levels are ready");
      onAdopted();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || "Could not adopt system";
      toast.error(msg);
    },
  });

  return (
    <div
      className="rounded-2xl border-2 border-dashed p-5 sm:p-6"
      style={{ borderColor: "#0F766E55", background: "linear-gradient(135deg, #F0FDFA, #FFFBEB)" }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <GraduationCap className="h-5 w-5" style={{ color: "#0F766E" }} />
            Choose your academic system
          </h2>
          <p className="text-sm text-stone-600 mt-1 max-w-2xl">
            CBC, 8-4-4, Cambridge and others are pre-seeded. Pick one and we load the matching
            grade levels automatically — you should not type PP1–Grade 12 by hand.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-stone-500 text-sm py-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading systems…
        </div>
      ) : templates.length === 0 ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          No curriculum templates in the database yet. On the server run{" "}
          <code className="text-xs bg-white px-1 rounded">python manage.py migrate</code>
          {" "}(templates seed after migrate) or load{" "}
          <code className="text-xs bg-white px-1 rounded">apps/academics/fixtures/initial_templates.json</code>.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((t) => {
            const active = selected === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t.id)}
                className="text-left rounded-xl border-2 p-4 transition-all bg-white"
                style={{
                  borderColor: active ? "#0F766E" : "#E7E5E4",
                  boxShadow: active ? "0 0 0 3px #0F766E22" : undefined,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-stone-900 text-sm leading-snug">{t.name}</p>
                  {active && <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#0F766E" }} />}
                </div>
                {t.short_code && (
                  <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{ background: "#CCFBF1", color: "#115E59" }}>
                    {t.short_code}
                  </span>
                )}
                {t.description && (
                  <p className="text-xs text-stone-500 mt-2 line-clamp-3">{t.description}</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          className="text-white"
          style={{ background: "#0F766E" }}
          disabled={!selected || mut.isPending}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading system…</>
          ) : (
            <>Load selected system &amp; classes</>
          )}
        </Button>
        <p className="text-xs text-stone-500">
          You can still add extra sections (A, B, Blue…) after grades are loaded.
        </p>
      </div>
    </div>
  );
}

