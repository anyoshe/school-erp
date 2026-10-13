"use client";

import { useMemo, useState } from "react";
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
  fetchGradeLevels, createGradeLevel, createSection,
  fetchSubjects, createSubject, fetchCurricula,
  fetchCurriculumTemplates, adoptCurriculumTemplate,
  type AcademicYear, type GradeLevel, type CurriculumTemplate,
} from "./services";

type Tab = "overview" | "years" | "classes" | "subjects";

export default function AcademicsPage() {
  const { currentSchool } = useCurrentSchool();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");

  const yearsQ = useQuery({ queryKey: ["academic-years"], queryFn: fetchAcademicYears });
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
        <OverviewPanel
          readiness={readiness}
          activeYear={activeYear}
          grades={grades}
          subjectsCount={subjects.length}
          onJump={setTab}
        />
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
          loading={subjectsQ.isLoading}
          onRefresh={() => qc.invalidateQueries({ queryKey: ["subjects"] })}
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
    mutationFn: (id: number) => activateAcademicYear(id),
    onSuccess: () => {
      toast.success("Year activated");
      onRefresh();
    },
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
                      {(y.terms || []).map((t) => (
                        <div
                          key={t.id}
                          className="text-xs px-3 py-1.5 rounded-lg bg-primary-50 text-primary-900 border border-primary-100"
                        >
                          <span className="font-semibold">{t.name}</span>
                          <span className="text-primary-700/70 ml-1">
                            {t.start_date?.slice(5)} – {t.end_date?.slice(5)}
                          </span>
                        </div>
                      ))}
                      {(y.terms || []).length === 0 && (
                        <span className="text-xs text-textMuted">No terms yet</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!y.is_active && (
                      <Button size="sm" variant="outline" onClick={() => activateMut.mutate(y.id)}>
                        Set active
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
  const [secName, setSecName] = useState("");

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
    mutationFn: () => createSection({ grade_level: sectionFor!.id, name: secName }),
    onSuccess: () => {
      toast.success("Section added");
      setSectionFor(null);
      setSecName("");
      onRefresh();
    },
    onError: () => toast.error("Could not add section"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-textMuted text-sm">
          Grades and sections are where students sit — keep names the school already uses.
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
          {grades.slice().sort((a, b) => a.order - b.order).map((g) => (
            <Card key={g.id} className="border-border rounded-2xl">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-textPrimary">{g.name}</p>
                    <p className="text-xs text-textMuted">{g.curriculum_name || "Curriculum"} · {g.student_count} students</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSectionFor(g)}>
                    <Plus className="h-3 w-3 mr-1" /> Section
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(g.sections || []).map((s) => (
                    <span key={s.id} className="text-xs bg-primary-50 text-primary-900 px-2.5 py-1 rounded-full border border-primary-100">
                      {s.name}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle>New grade level</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Name</Label>
              <Input placeholder="Grade 4" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Short name</Label>
                <Input placeholder="G4" value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
              </div>
              <div>
                <Label>Order</Label>
                <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Education level</Label>
              <select
                className="w-full border border-border rounded-lg h-10 px-3 text-sm"
                value={form.education_level}
                onChange={(e) => setForm({ ...form, education_level: e.target.value })}
              >
                {["PRE_PRIMARY", "PRIMARY", "JUNIOR", "SENIOR", "TERTIARY", "OTHER"].map((l) => (
                  <option key={l} value={l}>{l.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            {curricula.length > 0 && (
              <div>
                <Label>Curriculum</Label>
                <select
                  className="w-full border border-border rounded-lg h-10 px-3 text-sm"
                  value={form.curriculum || curricula[0].id}
                  onChange={(e) => setForm({ ...form, curriculum: Number(e.target.value) })}
                >
                  {curricula.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-primary" onClick={() => createMut.mutate()} disabled={createMut.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sectionFor} onOpenChange={(v) => !v && setSectionFor(null)}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader><DialogTitle>Section for {sectionFor?.name}</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>Section name</Label>
            <Input placeholder="A / Blue / East" value={secName} onChange={(e) => setSecName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionFor(null)}>Cancel</Button>
            <Button className="bg-primary" onClick={() => secMut.mutate()} disabled={!secName || secMut.isPending}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubjectsPanel({
  subjects, loading, onRefresh,
}: {
  subjects: { id: number; name: string; code?: string; is_compulsory: boolean }[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", is_compulsory: true });
  const mut = useMutation({
    mutationFn: () => createSubject(form),
    onSuccess: () => {
      toast.success("Subject added");
      setOpen(false);
      setForm({ name: "", code: "", is_compulsory: true });
      onRefresh();
    },
    onError: () => toast.error("Could not add subject"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-textMuted text-sm">Subject catalogue for timetables, teachers, and later exams.</p>
        <Button className="bg-primary hover:bg-primary-700" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Subject
        </Button>
      </div>
      {loading ? (
        <div className="h-32 animate-pulse bg-stone-100 rounded-2xl" />
      ) : subjects.length === 0 ? (
        <Empty hint="Math, English, Kiswahili…" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {subjects.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-white px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-textPrimary">{s.name}</p>
                {s.code && <p className="text-xs text-textMuted">{s.code}</p>}
              </div>
              {s.is_compulsory && (
                <Badge className="bg-secondary-50 text-secondary-800 border-0 text-[10px]">Core</Badge>
              )}
            </div>
          ))}
        </div>
      )}
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
