"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { toast } from "sonner";
import {
  BookOpen, CalendarRange, Layers, GraduationCap, Plus, Sparkles,
  CheckCircle2, Circle, ChevronRight, Users, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "./services";

type Tab = "overview" | "years" | "classes" | "subjects" | "promotion";

export default function AcademicsPage() {
  const { currentSchool } = useCurrentSchool();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");

  const yearsQ = useQuery({ queryKey: ["academic-years"], queryFn: fetchAcademicYears });
  const calendarQ = useQuery({ queryKey: ["current-calendar"], queryFn: fetchCurrentCalendar });
  const gradesQ = useQuery({ queryKey: ["grade-levels"], queryFn: fetchGradeLevels });
  const subjectsQ = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const curriculaQ = useQuery({ queryKey: ["curricula"], queryFn: fetchCurricula });
  const templatesQ = useQuery({
    queryKey: ["curriculum-templates"],
    queryFn: fetchCurriculumTemplates,
  });

  const years = yearsQ.data ?? [];
  const grades = gradesQ.data ?? [];
  const subjects = subjectsQ.data ?? [];
  const curricula = curriculaQ.data ?? [];
  const templates = templatesQ.data ?? [];
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

  const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: "overview", label: "Structure Map", icon: Sparkles },
    { id: "years", label: "Years & Terms", icon: CalendarRange },
    { id: "classes", label: "Classes", icon: Layers },
    { id: "subjects", label: "Subjects", icon: BookOpen },
    { id: "promotion", label: "Promotion", icon: GraduationCap },
  ];

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

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === id
                ? "bg-primary text-white shadow-md"
                : "text-textMuted hover:bg-primary-50 hover:text-primary"
            }`}
          >
            <Icon className="h-4 w-4" />
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
    <div className="flex items-center gap-3 bg-white border border-border rounded-2xl px-4 py-3 shadow-card">
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
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => openRegister(g, s.id, s.name)}
                          className="text-xs px-2.5 py-1 rounded-full border border-border bg-white hover:border-primary/50 hover:bg-primary-50 transition-colors"
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="text-muted-foreground ml-1">
                            {s.student_count ?? 0}
                            {s.capacity != null ? `/${s.capacity}` : ""}
                          </span>
                        </button>
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
                <select
                  className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={gradeId === "" ? "" : String(gradeId)}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : "";
                    setGradeId(v);
                    if (v) loadMap(Number(v));
                    else setMapped([]);
                  }}
                >
                  <option value="">Select grade…</option>
                  {sortedGrades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
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
              <select
                className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={sourceGradeId === "" ? "" : String(sourceGradeId)}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : "";
                  setSourceGradeId(v);
                  setLastResult(null);
                  if (v) loadPreview(Number(v));
                  else setPreview([]);
                }}
              >
                <option value="">Select class…</option>
                {sortedGrades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.student_count ?? 0})
                  </option>
                ))}
              </select>
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
