"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { toast } from "sonner";
import {
  BookOpen, CalendarRange, Layers, GraduationCap, Plus, Sparkles,
  CheckCircle2, Circle, ChevronRight, Users, Loader2, ClipboardList,
  FileText,
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
  setCurrentTerm, seedDefaultTerms, fetchCurrentCalendar,
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
  fetchAssessments, createAssessment, fetchMarksheet, saveMarksheet, fetchClassResults, fetchReportCard, fetchClassReportCards, type ReportCard, fetchMarksMatrix, saveMarksMatrix, type MarksMatrix,
} from "./services";

type Tab =
  | "overview"
  | "years"
  | "classes"
  | "subjects"
  | "teachers"
  | "marks"
  | "assessments"
  | "report-cards"
  | "promotion";

/** Stable tab list (module scope) — avoids SSR/client icon identity mismatches. */
const EMPTY_LIST: never[] = [];

const ACADEMICS_TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Structure Map" },
  { id: "years", label: "Years & Terms" },
  { id: "classes", label: "Classes" },
  { id: "subjects", label: "Subjects" },
  { id: "teachers", label: "Teachers" },
  { id: "marks", label: "Marks entry" },
  { id: "assessments", label: "Assessments" },
  { id: "report-cards", label: "Report cards" },
  { id: "promotion", label: "Promotion" },
];

function TabIcon({ id, className }: { id: Tab; className?: string }) {
  const cn = className || "h-4 w-4";
  switch (id) {
    case "overview":
      return <Sparkles className={cn} />;
    case "years":
      return <CalendarRange className={cn} />;
    case "classes":
      return <Layers className={cn} />;
    case "subjects":
      return <BookOpen className={cn} />;
    case "teachers":
      return <Users className={cn} />;
    case "marks":
      return <ClipboardList className={cn} />;
    case "assessments":
      return <ClipboardList className={cn} />;
    case "report-cards":
      return <FileText className={cn} />;
    case "promotion":
      return <GraduationCap className={cn} />;
    default:
      return <BookOpen className={cn} />;
  }
}


function GradeSelect({
  grades,
  value,
  onChange,
  placeholder = "Select grade…",
  emptyLabel,
  className,
  getLabel,
}: {
  grades: GradeLevel[];
  value: number | "";
  onChange: (v: number | "") => void;
  placeholder?: string;
  /** When set, shows an empty option (e.g. "All grades" or "Select grade…") */
  emptyLabel?: string;
  className?: string;
  getLabel?: (g: GradeLevel) => string;
}) {
  const sorted = useMemo(
    () => grades.slice().sort((a, b) => a.order - b.order),
    [grades]
  );
  const selectValue = value === "" ? "__empty__" : String(value);
  return (
    <Select
      value={selectValue}
      onValueChange={(v) => {
        if (v === "__empty__") onChange("");
        else onChange(Number(v));
      }}
    >
      <SelectTrigger className={className || "h-10 w-full mt-1 bg-background"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" className="z-[200] max-h-60">
        {emptyLabel != null ? (
          <SelectItem value="__empty__">{emptyLabel}</SelectItem>
        ) : null}
        {sorted.map((g) => (
          <SelectItem key={g.id} value={String(g.id)}>
            {getLabel ? getLabel(g) : g.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function AcademicsPage() {
  const { currentSchool } = useCurrentSchool();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [tabsReady, setTabsReady] = useState(false);

  useEffect(() => {
    setTabsReady(true);
  }, []);

  const yearsQ = useQuery({ queryKey: ["academic-years"], queryFn: fetchAcademicYears });
  const calendarQ = useQuery({ queryKey: ["current-calendar"], queryFn: fetchCurrentCalendar });
  const gradesQ = useQuery({ queryKey: ["grade-levels"], queryFn: fetchGradeLevels });
  const subjectsQ = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const curriculaQ = useQuery({ queryKey: ["curricula"], queryFn: fetchCurricula });
  const templatesQ = useQuery({
    queryKey: ["curriculum-templates"],
    queryFn: fetchCurriculumTemplates,
  });

  const years = yearsQ.data ?? (EMPTY_LIST as AcademicYear[]);
  const grades = gradesQ.data ?? (EMPTY_LIST as GradeLevel[]);
  const subjects = subjectsQ.data ?? (EMPTY_LIST as Subject[]);
  const curricula = curriculaQ.data ?? (EMPTY_LIST as { id: number; name: string }[]);
  const templates = templatesQ.data ?? (EMPTY_LIST as CurriculumTemplate[]);
  const activeYear = years.find((y) => y.is_active) ?? years[0];
  const needsCurriculum = !curriculaQ.isLoading && curricula.length === 0;

  const readiness = useMemo(() => {
    const checks = [
      { ok: curricula.length > 0, label: "Curriculum defined" },
      { ok: grades.length > 0, label: "Grade levels set" },
      { ok: grades.some((g) => (g.sections?.length ?? 0) > 0), label: "Class sections created" },
      { ok: years.length > 0, label: "Academic year exists" },
      { ok: !!years.find((y) => y.is_active), label: "Active year selected" },
      { ok: subjects.length > 0, label: "Subjects catalogued" },
    ];
    const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
    return { checks, score };
  }, [curricula, grades, years, subjects]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-primary text-sm font-semibold mb-1">
            <GraduationCap className="h-4 w-4" /> Academic Core
          </div>
          <h1 className="text-3xl font-bold text-textPrimary tracking-tight">
            Academic Structure
          </h1>
          <p className="text-textMuted mt-1 max-w-xl">
            Design how {currentSchool?.name || "your school"} is organised — years, classes, and subjects.
            Everything else (students, fees, attendance) hangs on this spine.
          </p>
        </div>
        <ReadinessRing score={readiness.score} />
      </div>

      {needsCurriculum && (
        <AdoptCurriculumPanel
          templates={templates}
          loading={templatesQ.isLoading}
          onAdopted={() => {
            qc.invalidateQueries({ queryKey: ["curricula"] });
            qc.invalidateQueries({ queryKey: ["grade-levels"] });
            qc.invalidateQueries({ queryKey: ["school-pulse"] });
          }}
        />
      )}

      {/* Tabs — icons rendered after mount to avoid lucide SSR/client path mismatches */}
      <div
        className="flex flex-wrap gap-2 border-b border-border pb-2"
        suppressHydrationWarning
      >
        {ACADEMICS_TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === id
                ? "bg-primary text-white shadow-md"
                : "text-textMuted hover:bg-primary-50 hover:text-primary"
            }`}
          >
            {tabsReady ? (
              <TabIcon id={id} className="h-4 w-4" />
            ) : (
              <span className="inline-block h-4 w-4" aria-hidden />
            )}
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
        <Card className="border-emerald-200 bg-emerald-50/40 rounded-2xl shadow-sm">
          <CardContent className="p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">System calendar</p>
              <p className="text-lg font-bold text-emerald-950 mt-0.5">
                {calendarQ.data?.year_label || "—"} · {calendarQ.data?.term_label || "No current term"}
              </p>
              <p className="text-xs text-emerald-900/70 mt-1">
                Finance, main dashboard and enrollment use this year and term. Set it under Years &amp; Terms.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setTab("years")}>
              Manage years &amp; terms
            </Button>
          </CardContent>
        </Card>

        <OverviewPanel
          readiness={readiness}
          activeYear={activeYear}
          grades={grades}
          subjectsCount={subjects.length}
          onJump={setTab}
        />
      </>
      )}

      {tab === "years" && (
        <YearsPanel
          years={years}
          loading={yearsQ.isLoading}
          onRefresh={() => qc.invalidateQueries({ queryKey: ["academic-years"] })}
        />
      )}
      {tab === "classes" && (
        <ClassesPanel
          grades={grades}
          curricula={curricula}
          loading={gradesQ.isLoading}
          onRefresh={() => qc.invalidateQueries({ queryKey: ["grade-levels"] })}
        />
      )}
      {tab === "subjects" && (
        <SubjectsPanel
          subjects={subjects}
          grades={grades}
          loading={subjectsQ.isLoading}
          onRefresh={() => {
            qc.invalidateQueries({ queryKey: ["subjects"] });
            qc.invalidateQueries({ queryKey: ["grade-levels"] });
          }}
        />
      )}

      {tab === "teachers" && (
        <TeachersPanel
          grades={grades}
          years={years}
          loading={gradesQ.isLoading || yearsQ.isLoading}
        />
      )}

      {tab === "marks" && (
        <MarksEntryPanel
          grades={grades}
          years={years}
          subjects={subjects}
          loading={gradesQ.isLoading || yearsQ.isLoading}
        />
      )}
      {tab === "assessments" && (
        <AssessmentsPanel
          grades={grades}
          years={years}
          subjects={subjects}
          loading={gradesQ.isLoading || yearsQ.isLoading}
        />
      )}

      {tab === "report-cards" && (
        <ReportCardsPanel grades={grades} years={years} loading={gradesQ.isLoading || yearsQ.isLoading} />
      )}
      {tab === "promotion" && (
        <PromotionPanel
          years={years}
          grades={grades}
          loading={yearsQ.isLoading || gradesQ.isLoading}
          onRefresh={() => {
            qc.invalidateQueries({ queryKey: ["academic-years"] });
            qc.invalidateQueries({ queryKey: ["grade-levels"] });
            qc.invalidateQueries({ queryKey: ["current-calendar"] });
          }}
        />
      )}
    </div>
  );
}

function ReadinessRing({ score }: { score: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = score >= 80 ? "#0F766E" : score >= 50 ? "#D97706" : "#EA580C";
  return (
    <div suppressHydrationWarning className="flex items-center gap-3 bg-white border border-border rounded-2xl px-4 py-3 shadow-card">
      <svg width="88" height="88" className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#E7E5E4" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div>
        <p className="text-2xl font-bold text-textPrimary">{score}%</p>
        <p className="text-xs text-textMuted font-medium">Structure readiness</p>
        <p className="text-[11px] text-textMuted">Unique to your school setup</p>
      </div>
    </div>
  );
}

function OverviewPanel({
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

function YearsPanel({
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
                        <button
                          key={term.id}
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
                          <span className={term.is_current ? "ml-1 opacity-90" : "text-primary-700/70 ml-1"}>
                            {term.start_date?.slice(5)} – {term.end_date?.slice(5)}
                          </span>
                        </button>
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
                    {(y.terms || []).length === 0 && !y.is_active && (
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
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New academic year</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Name</Label>
              <Input placeholder="2026" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add term to {termOpen?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Term name</Label>
              <Input placeholder="Term 1" value={termForm.name} onChange={(e) => setTermForm({ ...termForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
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


function ClassesPanel({
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



function SubjectsPanel({
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


function PromotionPanel({
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


function AdoptCurriculumPanel({
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

function Empty({ hint }: { hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white/60 py-14 text-center text-textMuted">
      Nothing here yet — {hint}
    </div>
  );
}


function TeachersPanel({
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


function AssessmentsPanel({
  grades,
  years,
  subjects,
  loading,
}: {
  grades: GradeLevel[];
  years: AcademicYear[];
  subjects: Subject[];
  loading: boolean;
}) {
  const [list, setList] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [yearId, setYearId] = useState<number | "">("");
  const [gradeId, setGradeId] = useState<number | "">("");
  const [termId, setTermId] = useState<number | "">("");
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({
    name: "CAT 1",
    kind: "CAT",
    subject: "" as string | number | "",
    max_score: "100",
    assessment_date: "",
  });
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [sheetRows, setSheetRows] = useState<any[]>([]);
  const [sheetMeta, setSheetMeta] = useState<any>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [absent, setAbsent] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<any[] | null>(null);

  const activeYear = years.find((y) => y.is_active) || years[0];
  const yearObj = years.find((y) => y.id === yearId) || activeYear;
  const terms = yearObj?.terms || [];

  useEffect(() => {
    if (activeYear && yearId === "") setYearId(activeYear.id);
  }, [activeYear, yearId]);

  const load = async () => {
    setBusy(true);
    try {
      const data = await fetchAssessments({
        academic_year: yearId ? Number(yearId) : undefined,
        grade_level: gradeId ? Number(gradeId) : undefined,
        term: termId ? Number(termId) : undefined,
      });
      setList(data);
    } catch {
      toast.error("Could not load assessments");
      setList([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearId, gradeId, termId]);

  const openSheet = async (id: string) => {
    setBusy(true);
    try {
      const data = await fetchMarksheet(id);
      setSheetId(id);
      setSheetMeta(data.assessment);
      setSheetRows(data.rows || []);
      const sc: Record<string, string> = {};
      const ab: Record<string, boolean> = {};
      (data.rows || []).forEach((r: any) => {
        sc[r.student] = r.score != null ? String(r.score) : "";
        ab[r.student] = !!r.is_absent;
      });
      setScores(sc);
      setAbsent(ab);
    } catch {
      toast.error("Could not open marksheet");
    } finally {
      setBusy(false);
    }
  };

  const saveSheet = async () => {
    if (!sheetId) return;
    setBusy(true);
    try {
      const marks = sheetRows.map((r) => ({
        student: r.student,
        score: absent[r.student]
          ? null
          : scores[r.student] === "" || scores[r.student] == null
            ? null
            : Number(scores[r.student]),
        is_absent: !!absent[r.student],
        remarks: r.remarks || "",
      }));
      const res = await saveMarksheet(sheetId, marks);
      toast.success(`Saved ${res.saved} mark(s)`);
      await openSheet(sheetId);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!yearId || !gradeId || !form.subject || !form.name.trim()) {
      toast.message("Year, grade, subject and name are required");
      return;
    }
    setBusy(true);
    try {
      const a = await createAssessment({
        name: form.name.trim(),
        kind: form.kind,
        academic_year: Number(yearId),
        term: termId || null,
        grade_level: Number(gradeId),
        subject: form.subject,
        max_score: form.max_score || 100,
        assessment_date: form.assessment_date || null,
      });
      toast.success("Assessment created");
      setOpenCreate(false);
      await load();
      if (a?.id) openSheet(a.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const loadResults = async () => {
    if (!gradeId) {
      toast.message("Select a grade for class results");
      return;
    }
    setBusy(true);
    try {
      const data = await fetchClassResults({
        grade_level: Number(gradeId),
        academic_year: yearId ? Number(yearId) : undefined,
        term: termId ? Number(termId) : undefined,
      });
      setResults(data.results || []);
    } catch {
      toast.error("Could not load results");
    } finally {
      setBusy(false);
    }
  };

  const gradeSubjects = subjects; // filter client-side optional

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Create CATs, midterms and end-of-term assessments, enter marks by class, and view simple
          averages. Grades use A (80+) · B (70+) · C (60+) · D (50+) · E.
        </p>
        <Button className="bg-primary" onClick={() => setOpenCreate(true)} disabled={!gradeId}>
          <Plus className="h-4 w-4 mr-1" /> New assessment
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 max-w-3xl">
        <div>
          <Label>Year</Label>
          <select
            className="w-full mt-1 h-10 rounded-md border px-3 text-sm"
            value={yearId === "" ? "" : String(yearId)}
            onChange={(e) => {
              setYearId(e.target.value ? Number(e.target.value) : "");
              setTermId("");
            }}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
                {y.is_active ? " (active)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Term (optional)</Label>
          <select
            className="w-full mt-1 h-10 rounded-md border px-3 text-sm"
            value={termId === "" ? "" : String(termId)}
            onChange={(e) => setTermId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">All terms</option>
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
            emptyLabel="All grades"
            onChange={setGradeId}
          />
        </div>
      </div>

      {(loading || busy) && !sheetId ? (
        <div className="flex justify-center py-10 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Assessment</th>
                <th className="px-3 py-2">Class</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Max</th>
                <th className="px-3 py-2">Entered</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    No assessments yet. Select a grade and create one.
                  </td>
                </tr>
              ) : (
                list.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2 font-medium">
                      {a.name}
                      <span className="ml-2 text-xs text-muted-foreground">{a.kind}</span>
                    </td>
                    <td className="px-3 py-2">{a.grade_name}</td>
                    <td className="px-3 py-2">{a.subject_name}</td>
                    <td className="px-3 py-2">{a.max_score}</td>
                    <td className="px-3 py-2">
                      {a.entered_count ?? 0}/{a.marks_count ?? 0}
                    </td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="secondary" onClick={() => openSheet(a.id)}>
                        Enter marks
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={loadResults} disabled={!gradeId}>
          Class averages
        </Button>
      </div>
      {results && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Adm</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Average %</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.student_id} className="border-t">
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.admission_number}</td>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2">{r.average != null ? r.average : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New assessment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Type</Label>
              <select
                className="w-full h-10 rounded-md border px-3 text-sm"
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
              >
                <option value="CAT">CAT / Continuous</option>
                <option value="MIDTERM">Midterm</option>
                <option value="END_TERM">End of term</option>
                <option value="PROJECT">Project</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <Label>Subject</Label>
              <select
                className="w-full h-10 rounded-md border px-3 text-sm"
                value={String(form.subject || "")}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              >
                <option value="">Select…</option>
                {gradeSubjects.map((s) => (
                  <option key={String(s.id)} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Max score</Label>
                <Input
                  value={form.max_score}
                  onChange={(e) => setForm((f) => ({ ...f, max_score: e.target.value }))}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.assessment_date}
                  onChange={(e) => setForm((f) => ({ ...f, assessment_date: e.target.value }))}
                />
              </div>
            </div>
            {!gradeId && (
              <p className="text-xs text-amber-700">Select a grade in the filters first.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>
              Cancel
            </Button>
            <Button className="bg-primary" onClick={create} disabled={busy || !gradeId}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sheetId} onOpenChange={(v) => !v && setSheetId(null)}>
        <DialogContent className="rounded-2xl sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Marksheet — {sheetMeta?.name} · {sheetMeta?.subject_name} · {sheetMeta?.grade_name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Max score: {sheetMeta?.max_score}. Leave blank if not entered. Tick absent if the
            learner missed the paper.
          </p>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">Adm</th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Score</th>
                  <th className="px-2 py-2">Absent</th>
                  <th className="px-2 py-2">Grade</th>
                </tr>
              </thead>
              <tbody>
                {sheetRows.map((r) => {
                  const max = Number(sheetMeta?.max_score || 100);
                  const raw = scores[r.student];
                  const pct =
                    !absent[r.student] && raw !== "" && raw != null
                      ? (Number(raw) / max) * 100
                      : null;
                  let letter = "—";
                  if (pct != null && !Number.isNaN(pct)) {
                    if (pct >= 80) letter = "A";
                    else if (pct >= 70) letter = "B";
                    else if (pct >= 60) letter = "C";
                    else if (pct >= 50) letter = "D";
                    else letter = "E";
                  }
                  return (
                    <tr key={r.student} className="border-t">
                      <td className="px-2 py-1.5 font-mono text-xs">{r.admission_number}</td>
                      <td className="px-2 py-1.5 font-medium">{r.student_name}</td>
                      <td className="px-2 py-1.5">
                        <Input
                          className="h-8 w-24"
                          type="number"
                          disabled={!!absent[r.student]}
                          value={scores[r.student] ?? ""}
                          onChange={(e) =>
                            setScores((s) => ({ ...s, [r.student]: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={!!absent[r.student]}
                          onChange={(e) =>
                            setAbsent((a) => ({ ...a, [r.student]: e.target.checked }))
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5 font-semibold">{letter}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSheetId(null)}>
              Close
            </Button>
            <Button className="bg-primary" onClick={saveSheet} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save marks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function ReportCardsPanel({
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
        <div className="report-card-print space-y-4">
          {/* single selected for screen; all for print via CSS could be added later */}
          <Card className="border-border rounded-2xl overflow-hidden max-w-3xl mx-auto">
            <CardContent className="p-6 sm:p-8 space-y-5">
              <div className="text-center space-y-1 border-b pb-4">
                {card.school.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.school.logo}
                    alt=""
                    className="h-16 mx-auto object-contain mb-2"
                  />
                ) : null}
                <h2 className="text-xl font-bold tracking-tight">{card.school.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {[card.school.address, card.school.phone, card.school.email]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-sm font-semibold mt-2 uppercase tracking-wide text-primary">
                  Academic Report Card
                </p>
                <p className="text-sm text-muted-foreground">
                  {card.academic_year?.name || "—"}
                  {card.term ? ` · ${card.term.name}` : ""}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Learner:</span>{" "}
                  <strong>{card.student.full_name}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Admission #:</span>{" "}
                  {card.student.admission_number || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Class:</span>{" "}
                  {card.grade?.name || "—"}
                  {card.section ? ` · ${card.section.name}` : ""}
                </p>
                <p>
                  <span className="text-muted-foreground">Class teacher:</span>{" "}
                  {card.class_teacher_name || "—"}
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">Assessments</th>
                      <th className="px-3 py-2 text-right">Average %</th>
                      <th className="px-3 py-2 text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {card.subjects.map((s) => (
                      <tr key={s.subject_id} className="border-t">
                        <td className="px-3 py-2 font-medium">{s.subject_name}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {s.entries.length
                            ? s.entries
                                .map(
                                  (e) =>
                                    `${e.assessment}: ${e.percentage.toFixed(0)}%`
                                )
                                .join(" · ")
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {s.average != null ? s.average.toFixed(1) : "—"}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold">
                          {s.grade_letter || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap justify-between items-center gap-3 pt-2 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Overall average</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {card.overall_average != null
                      ? `${card.overall_average.toFixed(1)}%`
                      : "—"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Overall grade</p>
                  <p className="text-3xl font-bold text-primary">
                    {card.overall_grade || "—"}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground max-w-[12rem]">
                  Based on {card.subjects_with_marks} subject(s) with marks entered.
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6 pt-6 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-6">Class teacher</p>
                  <div className="border-t border-dashed pt-1">
                    {card.class_teacher_name || "Signature"}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-6">Head teacher</p>
                  <div className="border-t border-dashed pt-1">Signature / stamp</div>
                </div>
              </div>
            </CardContent>
          </Card>
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


function MarksEntryPanel({
  grades,
  years,
  subjects,
  loading,
}: {
  grades: GradeLevel[];
  years: AcademicYear[];
  subjects: Subject[];
  loading: boolean;
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

  const cellKey = (studentId: string, assessmentId: string) =>
    `${studentId}__${assessmentId}`;

  const load = async () => {
    if (!yearId || !termId || !gradeId || !subjectId) {
      toast.message("Select year, term, grade and subject");
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
      toast.success(
        `Markbook ready: ${(data.preset || []).join(" · ") || data.columns.map((c) => c.name).join(" · ")}`
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not load markbook");
      setMatrix(null);
    } finally {
      setBusy(false);
    }
  };

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
          const raw = draft[cellKey(row.student_id, col.id)];
          if (raw === undefined) continue;
          const trimmed = String(raw).trim();
          if (trimmed === "") {
            // leave blank — do not overwrite unless previously had value and cleared
            marks.push({
              student: row.student_id,
              assessment: col.id,
              score: null,
              is_absent: false,
            });
          } else {
            const n = Number(trimmed);
            if (Number.isNaN(n)) continue;
            marks.push({
              student: row.student_id,
              assessment: col.id,
              score: n,
              is_absent: false,
            });
          }
        }
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
      toast.success(`Saved ${res.saved} mark(s)`);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Live averages from draft
  const liveRows = useMemo(() => {
    if (!matrix) return [];
    return matrix.rows.map((row) => {
      let weighted = 0;
      let wsum = 0;
      for (const col of matrix.columns) {
        const raw = draft[cellKey(row.student_id, col.id)];
        if (raw === undefined || String(raw).trim() === "") continue;
        const score = Number(raw);
        if (Number.isNaN(score) || !col.max_score) continue;
        const pct = (score / col.max_score) * 100;
        weighted += pct * (col.weight || 1);
        wsum += col.weight || 1;
      }
      const average = wsum > 0 ? Math.round((weighted / wsum) * 10) / 10 : null;
      return { ...row, liveAverage: average };
    });
  }, [matrix, draft]);

  const labelFor = (avg: number | null) => {
    if (avg == null || !matrix) return "—";
    const sys = (matrix.grading_system || "percentage").toLowerCase();
    const pass = matrix.passing_mark || 50;
    if (sys === "cbc" || sys === "competency" || sys === "competency_based") {
      if (avg >= 80) return "EE";
      if (avg >= 60) return "ME";
      if (avg >= 40) return "AE";
      return "BE";
    }
    if (sys === "mastery") {
      if (avg >= 80) return "Mastery";
      if (avg >= 60) return "Approaching";
      return "Beginning";
    }
    if (sys === "pass_fail" || sys === "pass/fail") {
      return avg >= pass ? "Pass" : "Fail";
    }
    if (avg >= 80) return "A";
    if (avg >= 70) return "B";
    if (avg >= 60) return "C";
    if (avg >= 50) return "D";
    return "E";
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        <p className="font-semibold text-primary">Preset markbook</p>
        <p className="text-muted-foreground mt-0.5">
          CAT 1–3 and End of Term are created automatically for the subject and term.
          Practical appears for science/ICT-style subjects. Enter marks, save once —
          averages and grade labels update immediately.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div>
          <Label>Year</Label>
          <select
            className="w-full mt-1 h-10 rounded-md border px-3 text-sm bg-background"
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
            className="w-full mt-1 h-10 rounded-md border px-3 text-sm bg-background"
            value={termId === "" ? "" : String(termId)}
            onChange={(e) => setTermId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Select term…</option>
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
              setMatrix(null);
            }}
          />
        </div>
        <div>
          <Label>Section</Label>
          <select
            className="w-full mt-1 h-10 rounded-md border px-3 text-sm bg-background"
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
        <div>
          <Label>Subject</Label>
          <select
            className="w-full mt-1 h-10 rounded-md border px-3 text-sm bg-background"
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setMatrix(null);
            }}
          >
            <option value="">Select subject…</option>
            {subjects
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button className="bg-primary flex-1" disabled={busy || loading} onClick={load}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Open markbook
          </Button>
        </div>
      </div>

      {matrix && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {matrix.grade_level.name} · {matrix.subject.name} · {matrix.term.name} ·{" "}
              {matrix.academic_year.name}
              <span className="ml-2 text-xs">
                Grading: {matrix.grading_system} (pass {matrix.passing_mark}%)
              </span>
            </p>
            <Button className="bg-primary" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save all marks
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 sticky left-0 bg-slate-50">Adm</th>
                  <th className="px-3 py-2 sticky left-16 bg-slate-50">Learner</th>
                  {matrix.columns.map((c) => (
                    <th key={c.id} className="px-2 py-2 text-center min-w-[88px]">
                      <div>{c.name}</div>
                      <div className="font-normal normal-case text-[10px] opacity-70">
                        /{c.max_score} · w{c.weight}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">Average</th>
                  <th className="px-3 py-2 text-center">Grade</th>
                </tr>
              </thead>
              <tbody>
                {liveRows.map((row) => (
                  <tr key={row.student_id} className="border-t hover:bg-slate-50/80">
                    <td className="px-3 py-1.5 font-mono text-xs sticky left-0 bg-white">
                      {row.admission_number}
                    </td>
                    <td className="px-3 py-1.5 font-medium sticky left-16 bg-white whitespace-nowrap">
                      {row.name}
                    </td>
                    {matrix.columns.map((col) => (
                      <td key={col.id} className="px-1 py-1">
                        <Input
                          type="number"
                          min={0}
                          max={col.max_score}
                          step="0.5"
                          className="h-9 text-center tabular-nums"
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
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                      {row.liveAverage != null ? row.liveAverage.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-center font-semibold text-primary">
                      {labelFor(row.liveAverage)}
                    </td>
                  </tr>
                ))}
                {liveRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={(matrix.columns.length || 0) + 4}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      No learners in this class/section.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!matrix && !busy && (
        <p className="text-center text-sm text-muted-foreground py-12">
          Choose year, term, grade and subject, then open the markbook.
        </p>
      )}
    </div>
  );
}
