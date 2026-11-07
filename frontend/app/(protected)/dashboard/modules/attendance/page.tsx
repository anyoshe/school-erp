"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import api from "@/utils/api";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Save,
  Users,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type GradeLevel = {
  id: number;
  name: string;
  order: number;
  sections?: { id: number; name: string }[];
  student_count?: number;
};

type SheetRow = {
  student_id: string;
  admission_number: string;
  full_name: string;
  section_id?: string | null;
  section_name?: string | null;
  status: string | null;
  notes: string;
  attendance_id?: string | null;
};

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

const STATUS_META: Record<
  Status,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  PRESENT: {
    label: "Present",
    className: "bg-emerald-600 text-white border-emerald-700",
    icon: CheckCircle2,
  },
  ABSENT: {
    label: "Absent",
    className: "bg-red-600 text-white border-red-700",
    icon: XCircle,
  },
  LATE: {
    label: "Late",
    className: "bg-amber-500 text-white border-amber-600",
    icon: Clock,
  },
  EXCUSED: {
    label: "Excused",
    className: "bg-sky-600 text-white border-sky-700",
    icon: ShieldCheck,
  },
};

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

async function fetchGrades(): Promise<GradeLevel[]> {
  const { data } = await api.get("/academics/grade-levels/");
  return (data.results ?? data) as GradeLevel[];
}

export default function AttendancePage() {
  const { currentSchool } = useCurrentSchool();
  const [date, setDate] = useState(todayISO);
  const [gradeId, setGradeId] = useState<number | "">("");
  const [sectionId, setSectionId] = useState<number | "">("");
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState({
    PRESENT: 0,
    ABSENT: 0,
    LATE: 0,
    EXCUSED: 0,
    UNMARKED: 0,
  });

  const gradesQ = useQuery({
    queryKey: ["grade-levels", currentSchool?.id],
    queryFn: fetchGrades,
    enabled: !!currentSchool?.id,
  });

  const grades = useMemo(
    () => (gradesQ.data || []).slice().sort((a, b) => a.order - b.order),
    [gradesQ.data]
  );

  const selectedGrade = grades.find((g) => g.id === gradeId);
  const sections = selectedGrade?.sections || [];

  const summaryQ = useQuery({
    queryKey: ["attendance-summary", currentSchool?.id, date],
    queryFn: async () => {
      const { data } = await api.get("/attendance/summary/", { params: { date } });
      return data as {
        present: number;
        absent: number;
        late: number;
        excused: number;
        total_marked: number;
      };
    },
    enabled: !!currentSchool?.id,
  });

  const loadSheet = useCallback(async () => {
    if (!gradeId) return;
    setLoadingSheet(true);
    try {
      const { data } = await api.get("/attendance/sheet/", {
        params: {
          date,
          grade_level: gradeId,
          ...(sectionId ? { section: sectionId } : {}),
        },
      });
      const list = (data.students || []) as SheetRow[];
      setRows(list);
      setCounts(
        data.counts || {
          PRESENT: 0,
          ABSENT: 0,
          LATE: 0,
          EXCUSED: 0,
          UNMARKED: 0,
        }
      );
      const next: Record<string, Status> = {};
      list.forEach((r) => {
        if (r.status && r.status in STATUS_META) {
          next[r.student_id] = r.status as Status;
        }
      });
      setMarks(next);
    } catch {
      toast.error("Could not load attendance sheet");
      setRows([]);
    } finally {
      setLoadingSheet(false);
    }
  }, [date, gradeId, sectionId]);

  useEffect(() => {
    if (gradeId) loadSheet();
    else {
      setRows([]);
      setMarks({});
    }
  }, [gradeId, sectionId, date, loadSheet]);

  const setAll = (status: Status) => {
    const next: Record<string, Status> = {};
    rows.forEach((r) => {
      next[r.student_id] = status;
    });
    setMarks(next);
  };

  const dirtyCount = rows.filter((r) => marks[r.student_id]).length;

  const save = async () => {
    if (!gradeId) return;
    const payloadMarks = rows
      .filter((r) => marks[r.student_id])
      .map((r) => ({
        student_id: r.student_id,
        status: marks[r.student_id],
        notes: r.notes || "",
      }));
    if (!payloadMarks.length) {
      toast.message("Mark at least one learner before saving");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/attendance/sheet/", {
        date,
        grade_level: gradeId,
        section: sectionId || undefined,
        marks: payloadMarks,
      });
      toast.success(`Saved ${data.saved} attendance record(s)`);
      await loadSheet();
      summaryQ.refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const sum = summaryQ.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-textPrimary tracking-tight">
          Attendance Tracking
        </h1>
        <p className="text-textMuted mt-2">
          Mark daily class attendance for {currentSchool?.name || "your school"}. Uses
          grades and sections from Academic Management.
        </p>
      </div>

      {/* School-wide snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Present today", value: sum?.present ?? "—", tone: "text-emerald-700" },
          { label: "Absent", value: sum?.absent ?? "—", tone: "text-red-700" },
          { label: "Late", value: sum?.late ?? "—", tone: "text-amber-700" },
          { label: "Marked", value: sum?.total_marked ?? "—", tone: "text-primary" },
        ].map((c) => (
          <Card key={c.label} className="border-border rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className={`text-2xl font-bold tabular-nums mt-1 ${c.tone}`}>
                {summaryQ.isLoading ? "…" : c.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Class attendance sheet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Grade / class</Label>
              <select
                className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={gradeId === "" ? "" : String(gradeId)}
                onChange={(e) => {
                  setGradeId(e.target.value ? Number(e.target.value) : "");
                  setSectionId("");
                }}
              >
                <option value="">Select class…</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                    {g.student_count != null ? ` (${g.student_count})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Section (optional)</Label>
              <select
                className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={sectionId === "" ? "" : String(sectionId)}
                onChange={(e) =>
                  setSectionId(e.target.value ? Number(e.target.value) : "")
                }
                disabled={!sections.length}
              >
                <option value="">All sections</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                className="bg-primary flex-1"
                disabled={!gradeId || saving || !dirtyCount}
                onClick={save}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save ({dirtyCount})
              </Button>
            </div>
          </div>

          {gradeId !== "" && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground mr-1">Mark all:</span>
              {(Object.keys(STATUS_META) as Status[]).map((st) => (
                <Button
                  key={st}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAll(st)}
                  disabled={!rows.length}
                >
                  {STATUS_META[st].label}
                </Button>
              ))}
              <div className="flex flex-wrap gap-2 ml-auto text-xs">
                <Badge variant="secondary">Present {counts.PRESENT}</Badge>
                <Badge variant="secondary">Absent {counts.ABSENT}</Badge>
                <Badge variant="secondary">Late {counts.LATE}</Badge>
                <Badge variant="secondary">Excused {counts.EXCUSED}</Badge>
                <Badge variant="outline">Unmarked {counts.UNMARKED}</Badge>
              </div>
            </div>
          )}

          {!gradeId ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Select a grade to load the class register and mark attendance.
            </p>
          ) : loadingSheet ? (
            <div className="flex justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading register…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Users className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No learners in this class
                {sectionId ? " / section" : ""}. Place students under Academics or
                Students first.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 w-10">#</th>
                    <th className="px-3 py-2">Adm #</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Section</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const current = marks[r.student_id];
                    return (
                      <tr key={r.student_id} className="border-t">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {r.admission_number || "—"}
                        </td>
                        <td className="px-3 py-2 font-medium">{r.full_name}</td>
                        <td className="px-3 py-2">{r.section_name || "—"}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {(Object.keys(STATUS_META) as Status[]).map((st) => {
                              const active = current === st;
                              const meta = STATUS_META[st];
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() =>
                                    setMarks((m) => ({ ...m, [r.student_id]: st }))
                                  }
                                  className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                                    active
                                      ? meta.className
                                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                                  }`}
                                >
                                  {meta.label}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
