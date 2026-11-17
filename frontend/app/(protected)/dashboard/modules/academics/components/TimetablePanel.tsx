"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { GradeLevel, Subject } from "../services";
import { Loader2, Trash2 } from "lucide-react";

type SectionOpt = {
  id: number | string;
  name: string;
  grade_level_id?: number | string;
  grade_name?: string;
  label?: string;
};

type PeriodRow = {
  id: number;
  name: string;
  order: number;
  start_time?: string | null;
  end_time?: string | null;
  is_break: boolean;
};

type GridEntry = {
  id: number;
  weekday: number;
  period_id: number;
  subject_name: string;
  subject_id: number;
  subject_code?: string;
  teacher_name?: string;
  room?: string;
};

export function TimetablePanel({
  grades,
  subjects,
}: {
  grades: GradeLevel[];
  subjects: Subject[];
}) {
  const qc = useQueryClient();
  const [gradeFilter, setGradeFilter] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [room, setRoom] = useState("");
  const [newPeriodName, setNewPeriodName] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [busy, setBusy] = useState(false);

  const sectionsQ = useQuery({
    queryKey: ["timetable-sections", gradeFilter],
    queryFn: async () => {
      const { data } = await api.get("/academics/timetable/sections/", {
        params: gradeFilter ? { grade_level_id: gradeFilter } : {},
      });
      return (Array.isArray(data) ? data : data?.results || []) as SectionOpt[];
    },
  });

  const periodsQ = useQuery({
    queryKey: ["timetable-periods"],
    queryFn: async () => {
      const { data } = await api.get("/academics/timetable/periods/");
      return (Array.isArray(data) ? data : []) as PeriodRow[];
    },
  });

  const gridQ = useQuery({
    queryKey: ["timetable-grid", sectionId],
    queryFn: async () => {
      const { data } = await api.get("/academics/timetable/grid/", {
        params: { section_id: sectionId },
      });
      return data as {
        periods: PeriodRow[];
        entries: GridEntry[];
        weekdays: { id: number; label: string }[];
        display_name?: string;
        section_name: string;
        auto_seeded?: { created?: number; detail?: string } | null;
      };
    },
    enabled: !!sectionId,
  });

  // When grid auto-seeds periods, refresh period list
  useEffect(() => {
    if (gridQ.data?.auto_seeded?.created) {
      qc.invalidateQueries({ queryKey: ["timetable-periods"] });
      toast.success(gridQ.data.auto_seeded.detail || "Default periods created");
    }
  }, [gridQ.data?.auto_seeded, qc]);

  // Auto-seed periods once on first visit if empty
  useEffect(() => {
    if (periodsQ.isSuccess && (periodsQ.data?.length ?? 0) === 0 && !seeding) {
      void seedPeriods(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodsQ.isSuccess, periodsQ.data?.length]);

  const sections = sectionsQ.data || [];
  const periods = gridQ.data?.periods?.length ? gridQ.data.periods : periodsQ.data || [];
  const grid = gridQ.data;

  const cellMap = useMemo(() => {
    const m = new Map<string, GridEntry>();
    (grid?.entries || []).forEach((e) => m.set(`${e.weekday}-${e.period_id}`, e));
    return m;
  }, [grid]);

  const seedPeriods = async (force: boolean) => {
    setSeeding(true);
    try {
      const { data } = await api.post("/academics/timetable/periods/seed-defaults/", {
        force,
      });
      const n = data?.created ?? 0;
      if (n > 0) toast.success(data?.detail || `Created ${n} periods`);
      else toast.message(data?.detail || "Periods already in place");
      await qc.invalidateQueries({ queryKey: ["timetable-periods"] });
      if (sectionId) await qc.invalidateQueries({ queryKey: ["timetable-grid", sectionId] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not seed periods");
    } finally {
      setSeeding(false);
    }
  };

  const addPeriod = async () => {
    const name = newPeriodName.trim();
    if (!name) {
      toast.error("Enter a period name");
      return;
    }
    try {
      await api.post("/academics/timetable/periods/", {
        name,
        order: (periodsQ.data?.length || 0) + 1,
        is_break: /break|lunch|tea/i.test(name),
      });
      setNewPeriodName("");
      toast.success("Period added");
      qc.invalidateQueries({ queryKey: ["timetable-periods"] });
      if (sectionId) qc.invalidateQueries({ queryKey: ["timetable-grid", sectionId] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not add period");
    }
  };

  const deletePeriod = async (id: number) => {
    if (!window.confirm("Delete this period and its timetable slots?")) return;
    try {
      await api.delete(`/academics/timetable/periods/${id}/`);
      toast.success("Period removed");
      qc.invalidateQueries({ queryKey: ["timetable-periods"] });
      if (sectionId) qc.invalidateQueries({ queryKey: ["timetable-grid", sectionId] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not delete period");
    }
  };

  const assign = async (weekday: number, periodId: number) => {
    if (!sectionId || !subjectId) {
      toast.error("Select a section and a subject first");
      return;
    }
    setBusy(true);
    try {
      await api.post("/academics/timetable/grid/", {
        section_id: sectionId,
        period_id: periodId,
        weekday,
        subject_id: subjectId,
        room: room || undefined,
      });
      await gridQ.refetch();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not save slot");
    } finally {
      setBusy(false);
    }
  };

  const clear = async (entryId: number) => {
    setBusy(true);
    try {
      await api.delete("/academics/timetable/grid/", { params: { id: entryId } });
      await gridQ.refetch();
    } catch {
      toast.error("Could not clear slot");
    } finally {
      setBusy(false);
    }
  };

  const clearSection = async () => {
    if (!sectionId) return;
    if (!window.confirm("Clear the entire timetable for this section?")) return;
    setBusy(true);
    try {
      const { data } = await api.post("/academics/timetable/clear-section/", {
        section_id: sectionId,
      });
      toast.success(`Cleared ${data?.deleted ?? 0} slot(s)`);
      await gridQ.refetch();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not clear");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Timetable</CardTitle>
          <p className="text-sm text-muted-foreground">
            1) Seed or add periods · 2) Pick class section · 3) Choose subject · 4) Click a cell to place
            (click filled cell to remove). Teacher is filled from subject–teacher mapping when available.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={seeding}
              onClick={() => seedPeriods(false)}
            >
              {seeding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Seed default periods
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={seeding}
              onClick={() => seedPeriods(true)}
              title="Add any missing defaults without removing yours"
            >
              Fill missing defaults
            </Button>
            <span className="text-xs text-muted-foreground">
              {periodsQ.isLoading
                ? "Loading periods…"
                : `${periodsQ.data?.length ?? 0} period(s) configured`}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <Label className="text-xs">New period</Label>
              <Input
                className="h-9 w-40"
                placeholder="e.g. P9 or Break"
                value={newPeriodName}
                onChange={(e) => setNewPeriodName(e.target.value)}
              />
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={addPeriod}>
              Add period
            </Button>
          </div>

          {(periodsQ.data?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1">
              {periodsQ.data!.map((p) => (
                <span
                  key={p.id}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                    p.is_break ? "bg-slate-100 text-slate-600" : "bg-white"
                  }`}
                >
                  <span className="font-medium">{p.name}</span>
                  {p.start_time ? (
                    <span className="text-muted-foreground">
                      {p.start_time}
                      {p.end_time ? `–${p.end_time}` : ""}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="text-rose-600 hover:text-rose-800"
                    title="Delete period"
                    onClick={() => deletePeriod(p.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div>
              <Label>Grade filter</Label>
              <select
                className="mt-1 block w-full rounded-md border px-2 py-2 text-sm"
                value={gradeFilter}
                onChange={(e) => {
                  setGradeFilter(e.target.value);
                  setSectionId("");
                }}
              >
                <option value="">All grades</option>
                {grades.map((g) => (
                  <option key={String(g.id)} value={String(g.id)}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Section / class *</Label>
              <select
                className="mt-1 block w-full rounded-md border px-2 py-2 text-sm"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
              >
                <option value="">Select section…</option>
                {sections.map((s) => (
                  <option key={String(s.id)} value={String(s.id)}>
                    {s.label || `${s.grade_name || ""} — ${s.name}`.replace(/^ — /, "")}
                  </option>
                ))}
              </select>
              {sectionsQ.isSuccess && sections.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  No sections found. Create classes under Academics → Classes first.
                </p>
              )}
            </div>
            <div>
              <Label>Subject to place *</Label>
              <select
                className="mt-1 block w-full rounded-md border px-2 py-2 text-sm"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                <option value="">Select subject…</option>
                {subjects.map((s) => (
                  <option key={String(s.id)} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Room (optional)</Label>
              <Input
                className="mt-1"
                placeholder="e.g. Lab 1"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {sectionId && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-medium">
                {grid?.display_name || grid?.section_name || "Grid"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {busy ? "Saving…" : "Click empty cell to place selected subject · click filled to remove"}
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={clearSection}>
              Clear section
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {gridQ.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading grid…
              </div>
            ) : gridQ.isError ? (
              <p className="text-sm text-rose-600 py-4">
                Could not load timetable. Confirm migration ran and school is selected.
              </p>
            ) : !periods.length ? (
              <p className="text-sm text-amber-700 py-4">
                No periods yet. Click <strong>Seed default periods</strong> above.
              </p>
            ) : (
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="border px-2 py-1 bg-slate-50 text-left sticky left-0">Period</th>
                    {(grid?.weekdays || []).map((d) => (
                      <th key={d.id} className="border px-2 py-1 bg-slate-50">
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id} className={p.is_break ? "bg-slate-100/80" : ""}>
                      <td className="border px-2 py-1 font-medium whitespace-nowrap sticky left-0 bg-inherit">
                        <div>{p.name}</div>
                        {p.start_time ? (
                          <div className="text-[10px] text-muted-foreground font-normal">
                            {p.start_time}
                            {p.end_time ? `–${p.end_time}` : ""}
                          </div>
                        ) : null}
                      </td>
                      {(grid?.weekdays || []).map((d) => {
                        const cell = cellMap.get(`${d.id}-${p.id}`);
                        return (
                          <td key={d.id} className="border px-1 py-1 align-top min-w-[6rem]">
                            {p.is_break ? (
                              <span className="text-muted-foreground text-[10px]">Break</span>
                            ) : cell ? (
                              <button
                                type="button"
                                className="w-full text-left rounded bg-teal-50 px-1.5 py-1 hover:bg-teal-100 border border-teal-100"
                                title="Click to remove"
                                onClick={() => clear(cell.id)}
                              >
                                <div className="font-semibold text-teal-900 leading-tight">
                                  {cell.subject_code || cell.subject_name}
                                </div>
                                {cell.subject_code ? (
                                  <div className="text-[10px] text-teal-800/80 truncate">
                                    {cell.subject_name}
                                  </div>
                                ) : null}
                                {cell.teacher_name ? (
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {cell.teacher_name}
                                  </div>
                                ) : null}
                                {cell.room ? (
                                  <div className="text-[10px] text-muted-foreground">{cell.room}</div>
                                ) : null}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busy || !subjectId}
                                className="w-full rounded border border-dashed px-1 py-3 text-muted-foreground hover:border-teal-400 hover:text-teal-800 disabled:opacity-40"
                                onClick={() => assign(d.id, p.id)}
                              >
                                +
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
