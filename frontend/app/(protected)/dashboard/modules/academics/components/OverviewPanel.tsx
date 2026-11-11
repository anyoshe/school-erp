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

export function OverviewPanel({
  readiness, activeYear, grades, subjectsCount, onJump,
}: {
  readiness: { checks: { ok: boolean; label: string }[]; score: number };
  activeYear?: AcademicYear;
  grades: GradeLevel[];
  subjectsCount: number;
  onJump: (t: Tab) => void;
}) {
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 border-border shadow-card rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary-800 to-primary-900 text-white">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" /> Living class map
          </CardTitle>
          <p className="text-primary-100 text-sm">Students and fees attach to these classes</p>
        </CardHeader>
        <CardContent className="p-5">
          {grades.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-textMuted mb-4">No grade levels yet — adopt CBC, 8-4-4 or another system above to load them.</p>
              <Button onClick={() => onJump("classes")} className="bg-primary hover:bg-primary-700">
                <Plus className="h-4 w-4 mr-2" /> Add grade levels
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {grades
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((g) => (
                  <div
                    key={g.id}
                    className="rounded-xl border border-border bg-background/80 p-4 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-textPrimary">{g.name}</p>
                        <p className="text-xs text-textMuted capitalize">
                          {(g.education_level || "").toLowerCase().replace("_", " ")}
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-primary-50 text-primary-800 border-0">
                        <Users className="h-3 w-3 mr-1" />
                        {g.student_count ?? 0}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(g.sections || []).length === 0 ? (
                        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          No sections
                        </span>
                      ) : (
                        g.sections.map((s) => (
                          <span
                            key={s.id}
                            className="text-xs bg-white border border-border px-2 py-0.5 rounded-full text-textPrimary"
                          >
                            {s.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-border shadow-card rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Setup checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {readiness.checks.map((c) => (
              <div key={c.label} className="flex items-center gap-2 text-sm">
                {c.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-stone-300 shrink-0" />
                )}
                <span className={c.ok ? "text-textPrimary" : "text-textMuted"}>{c.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border shadow-card rounded-2xl bg-gradient-to-br from-secondary-50 to-white">
          <CardContent className="p-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary-700">Active year</p>
            {activeYear ? (
              <>
                <p className="text-xl font-bold text-textPrimary">{activeYear.name}</p>
                <p className="text-sm text-textMuted">
                  {activeYear.start_date} → {activeYear.end_date}
                </p>
                <p className="text-sm text-textMuted">{activeYear.term_count ?? activeYear.terms?.length ?? 0} terms</p>
              </>
            ) : (
              <p className="text-textMuted text-sm">No academic year yet</p>
            )}
            <Button variant="outline" size="sm" className="mt-2" onClick={() => onJump("years")}>
              Manage years <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border shadow-card rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">Subjects</p>
            <p className="text-2xl font-bold text-textPrimary mt-1">{subjectsCount}</p>
            <Button variant="ghost" size="sm" className="mt-1 px-0 text-primary" onClick={() => onJump("subjects")}>
              Open catalogue →
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

