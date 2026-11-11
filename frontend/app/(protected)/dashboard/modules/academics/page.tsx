"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { GraduationCap } from "lucide-react";
import {
  fetchAcademicYears,
  fetchGradeLevels,
  fetchSubjects,
  fetchCurricula,
  fetchCurrentCalendar,
  fetchCurriculumTemplates,
  type AcademicYear,
  type GradeLevel,
  type Subject,
  type CurriculumTemplate,
} from "./services";
import { ACADEMICS_TABS, EMPTY_LIST, type Tab } from "./utils";
import { ReadinessRing, TabIcon } from "./components/shared";
import { OverviewPanel } from "./components/OverviewPanel";
import { YearsPanel } from "./components/YearsPanel";
import { ClassesPanel } from "./components/ClassesPanel";
import { SubjectsPanel } from "./components/SubjectsPanel";
import { TeachersPanel } from "./components/TeachersPanel";
import { MarksEntryPanel } from "./components/MarksEntryPanel";
import { ReportCardsPanel } from "./components/ReportCardsPanel";
import { LearnerProgressPanel } from "./components/LearnerProgressPanel";
import { PromotionPanel } from "./components/PromotionPanel";
import { AdoptCurriculumPanel } from "./components/AdoptCurriculumPanel";

export default function AcademicsPage() {
  const { currentSchool } = useCurrentSchool();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [tabsReady, setTabsReady] = useState(false);
  const [shellReady, setShellReady] = useState(false);

  useEffect(() => {
    setTabsReady(true);
    setShellReady(true);
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

  const workTabs = tab === "marks" || tab === "report-cards" || tab === "teachers";

  if (!shellReady) {
    return (
      <div className="max-w-7xl mx-auto space-y-3 pb-4" suppressHydrationWarning>
        <div className="h-10 w-48 rounded-lg bg-muted/50 animate-pulse" />
        <div className="h-9 w-full rounded-lg bg-muted/40 animate-pulse" />
        <div className="h-40 w-full rounded-xl bg-muted/30 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-3 pb-4" suppressHydrationWarning>
      {/* Compact header — full blurb only on structure overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wide">
            <GraduationCap className="h-3.5 w-3.5" /> Academic management
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-textPrimary tracking-tight truncate">
            {tab === "marks"
              ? "Marks entry"
                : tab === "report-cards"
                  ? "Report cards"
                  : tab === "teachers"
                    ? "Teachers"
                    : tab === "promotion"
                      ? "Promotion"
                      : "Academic structure"}
          </h1>
          {!workTabs && (
            <p className="text-textMuted text-sm mt-0.5 max-w-2xl line-clamp-2">
              Years, classes and subjects for {currentSchool?.name || "your school"}.
            </p>
          )}
        </div>
        {tab === "overview" && <ReadinessRing score={readiness.score} />}
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

      <div className="flex flex-wrap gap-2 print:hidden">
        <Link
          href="/dashboard/modules/academics/transcripts"
          className="text-xs px-3 py-1.5 rounded-lg border bg-white hover:border-primary/40 text-primary font-medium"
        >
          Official transcripts
        </Link>
        <Link
          href="/dashboard/modules/academics/exams"
          className="text-xs px-3 py-1.5 rounded-lg border bg-white hover:border-primary/40 text-primary font-medium"
        >
          Exam hall scheduling
        </Link>
        <Link
          href="/dashboard/modules/parent"
          className="text-xs px-3 py-1.5 rounded-lg border bg-white hover:border-primary/40 text-primary font-medium"
        >
          Parent results portal
        </Link>
      </div>

      {/* Sticky sub-nav so tabs stay visible while scrolling content */}
      <div
        className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-background/95 backdrop-blur border-b border-border supports-[backdrop-filter]:bg-background/80"
        suppressHydrationWarning
      >
        <div className="flex flex-wrap gap-1.5">
          {ACADEMICS_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                tab === id
                  ? "bg-primary text-white shadow-sm"
                  : "text-textMuted hover:bg-primary-50 hover:text-primary bg-white border border-border/80"
              }`}
            >
              {tabsReady ? (
                <TabIcon id={id} className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <span className="inline-block h-3.5 w-3.5" aria-hidden />
              )}
              <span className="whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>
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
          loading={gradesQ.isLoading || yearsQ.isLoading || subjectsQ.isLoading}
        />
      )}

      {tab === "report-cards" && (
        <ReportCardsPanel grades={grades} years={years} loading={gradesQ.isLoading || yearsQ.isLoading} />
      )}
      {tab === "progress" && (
        <LearnerProgressPanel />
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

