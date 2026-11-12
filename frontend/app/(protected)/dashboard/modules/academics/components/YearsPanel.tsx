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

export function YearsPanel({
  years, loading, onRefresh,
}: {
  years: AcademicYear[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [termOpen, setTermOpen] = useState<AcademicYear | null>(null);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", is_active: true });
  const [termForm, setTermForm] = useState({ name: "", start_date: "", end_date: "", order: 1 });

  const createMut = useMutation({
    mutationFn: () => createAcademicYear(form),
    onSuccess: () => {
      toast.success("Academic year created");
      setOpen(false);
      setForm({ name: "", start_date: "", end_date: "", is_active: true });
      onRefresh();
    },
    onError: () => toast.error("Could not create year"),
  });

  const activateMut = useMutation({
    mutationFn: (id: number) => activateAcademicYear(id, { seed_terms: true }),
    onSuccess: () => {
      toast.success("Year activated — default terms added if none existed");
      onRefresh();
    },
  });

  const seedMut = useMutation({
    mutationFn: (id: number) => seedDefaultTerms(id),
    onSuccess: (data) => {
      toast.success(data?.created ? `Added ${data.created} terms` : "Terms already present");
      onRefresh();
    },
    onError: () => toast.error("Could not seed terms"),
  });

  const currentMut = useMutation({
    mutationFn: (termId: number) => setCurrentTerm(termId),
    onSuccess: () => {
      toast.success("Current term updated — dashboards & finance will use this");
      onRefresh();
    },
    onError: () => toast.error("Could not set current term"),
  });

  const lockMut = useMutation({
    mutationFn: ({ id, locked }: { id: number; locked: boolean }) => setTermLocked(id, locked),
    onSuccess: (_, v) => {
      toast.success(v.locked ? "Term locked — marks are view-only" : "Term unlocked — marks can be edited");
      onRefresh();
    },
    onError: () => toast.error("Could not update term lock"),
  });

  const termMut = useMutation({
    mutationFn: () => addTerm(termOpen!.id, termForm),
    onSuccess: () => {
      toast.success("Term added");
      setTermOpen(null);
      setTermForm({ name: "", start_date: "", end_date: "", order: 1 });
      onRefresh();
    },
    onError: () => toast.error("Could not add term"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-textMuted text-sm">Activate one year at a time — invoices and attendance follow it.</p>
        <Button className="bg-primary hover:bg-primary-700" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New year
        </Button>
      </div>

      {loading ? (
        <div className="h-32 animate-pulse bg-stone-100 rounded-2xl" />
      ) : years.length === 0 ? (
        <Empty hint="Create your first academic year (e.g. 2026)" />
      ) : (
        <div className="space-y-3">
          {years.map((y) => (
            <Card key={y.id} className={`border-border rounded-2xl overflow-hidden ${y.is_active ? "ring-2 ring-primary/30" : ""}`}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-textPrimary">{y.name}</h3>
                      {y.is_active && (
                        <Badge className="bg-primary text-white border-0">Active</Badge>
                      )}
                    </div>
                    <p className="text-sm text-textMuted mt-0.5">
                      {y.start_date} → {y.end_date}
                    </p>
                    {/* Mini timeline */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(y.terms || []).map((term) => (
                        <div key={term.id} className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => currentMut.mutate(term.id)}
                            disabled={currentMut.isPending}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors text-left ${
                              term.is_current
                                ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                                : "bg-primary-50 text-primary-900 border-primary-100 hover:border-emerald-400"
                            }`}
                            title="Set as current term"
                          >
                            <span className="font-semibold">{term.name}</span>
                            {term.is_current && (
                              <span className="ml-1 font-bold">· current</span>
                            )}
                            {term.is_locked && (
                              <span className="ml-1 font-bold">· locked</span>
                            )}
                            <span className={term.is_current ? "ml-1 opacity-90" : "text-primary-700/70 ml-1"}>
                              {term.start_date?.slice(5)} – {term.end_date?.slice(5)}
                            </span>
                          </button>
                          <button
                            type="button"
                            className={`text-[10px] px-2 py-1 rounded-md border ${
                              term.is_locked
                                ? "bg-amber-50 text-amber-900 border-amber-200"
                                : "bg-white text-muted-foreground border-border"
                            }`}
                            title={term.is_locked ? "Unlock marks for this term" : "Lock marks (view-only)"}
                            disabled={lockMut.isPending}
                            onClick={() =>
                              lockMut.mutate({ id: term.id, locked: !Boolean(term.is_locked) })
                            }
                          >
                            {term.is_locked ? "Unlock" : "Lock"}
                          </button>
                        </div>
                      ))}
                      {(y.terms || []).length === 0 && (
                        <span className="text-xs text-textMuted">No terms yet — activate year or seed terms</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!y.is_active && (
                      <Button size="sm" variant="outline" onClick={() => activateMut.mutate(y.id)}>
                        Set active
                      </Button>
                    )}
                    {y.is_active && (y.terms || []).length === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={seedMut.isPending}
                        onClick={() => seedMut.mutate(y.id)}
                      >
                        Seed Term 1–3
                      </Button>
                    )}
                    <Button size="sm" className="bg-secondary hover:bg-secondary-700 text-white" onClick={() => setTermOpen(y)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Term
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-1.25rem)] rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New academic year</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Name</Label>
              <Input placeholder="2026" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Start</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <Label>End</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-primary" disabled={createMut.isPending} onClick={() => createMut.mutate()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!termOpen} onOpenChange={(v) => !v && setTermOpen(null)}>
        <DialogContent className="w-[calc(100%-1.25rem)] rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add term to {termOpen?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Term name</Label>
              <Input placeholder="Term 1" value={termForm.name} onChange={(e) => setTermForm({ ...termForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Start</Label>
                <Input type="date" value={termForm.start_date} onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })} />
              </div>
              <div>
                <Label>End</Label>
                <Input type="date" value={termForm.end_date} onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Order</Label>
              <Input type="number" min={1} value={termForm.order} onChange={(e) => setTermForm({ ...termForm, order: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTermOpen(null)}>Cancel</Button>
            <Button className="bg-primary" disabled={termMut.isPending} onClick={() => termMut.mutate()}>
              Add term
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


