"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { GradeLevel, Subject } from "../services";

type SectionOpt = { id: number | string; name: string; grade_level?: number | string };

export function TimetablePanel({
  grades,
  subjects,
}: {
  grades: GradeLevel[];
  subjects: Subject[];
}) {
  const qc = useQueryClient();
  const [sectionId, setSectionId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");

  const sectionsQ = useQuery({
    queryKey: ["sections-all"],
    queryFn: async () => {
      const { data } = await api.get("/academics/sections/");
      const list = Array.isArray(data) ? data : data?.results || [];
      return list as SectionOpt[];
    },
  });

  const gridQ = useQuery({
    queryKey: ["timetable-grid", sectionId],
    queryFn: async () => {
      const { data } = await api.get("/academics/timetable/grid/", {
        params: { section_id: sectionId },
      });
      return data as {
        periods: { id: number; name: string; is_break: boolean }[];
        entries: {
          id: number;
          weekday: number;
          period_id: number;
          subject_name: string;
          subject_id: number;
        }[];
        weekdays: { id: number; label: string }[];
        section_name: string;
      };
    },
    enabled: !!sectionId,
  });

  const periodsQ = useQuery({
    queryKey: ["timetable-periods"],
    queryFn: async () => {
      const { data } = await api.get("/academics/timetable/periods/");
      return data as { id: number; name: string }[];
    },
  });

  const sections = sectionsQ.data || [];
  const grid = gridQ.data;

  const cellMap = useMemo(() => {
    const m = new Map<string, (typeof grid extends { entries: infer E } ? E : any) extends (infer U)[] ? U : any>();
    (grid?.entries || []).forEach((e) => m.set(`${e.weekday}-${e.period_id}`, e));
    return m;
  }, [grid]);

  const seedPeriods = async () => {
    try {
      const { data } = await api.post("/academics/timetable/periods/seed-defaults/", {});
      toast.success(data?.created ? `Created ${data.created} periods` : "Periods already set");
      qc.invalidateQueries({ queryKey: ["timetable-periods"] });
      qc.invalidateQueries({ queryKey: ["timetable-grid"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not seed periods");
    }
  };

  const assign = async (weekday: number, periodId: number) => {
    if (!sectionId || !subjectId) {
      toast.error("Select a section and subject first");
      return;
    }
    try {
      await api.post("/academics/timetable/grid/", {
        section_id: sectionId,
        period_id: periodId,
        weekday,
        subject_id: subjectId,
      });
      toast.success("Slot saved");
      gridQ.refetch();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not save slot");
    }
  };

  const clear = async (entryId: number) => {
    try {
      await api.delete("/academics/timetable/grid/", { params: { id: entryId } });
      gridQ.refetch();
    } catch {
      toast.error("Could not clear slot");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Timetable</CardTitle>
          <p className="text-sm text-muted-foreground">
            Build a weekly grid per class section: pick a subject, then click a cell (Mon–Fri × period).
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div>
            <Label>Section / class</Label>
            <select
              className="mt-1 block w-56 rounded-md border px-2 py-2 text-sm"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              <option value="">Select section…</option>
              {sections.map((s) => (
                <option key={String(s.id)} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Subject to place</Label>
            <select
              className="mt-1 block w-56 rounded-md border px-2 py-2 text-sm"
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
          <Button type="button" variant="outline" size="sm" onClick={seedPeriods}>
            Seed default periods
          </Button>
          {(periodsQ.data?.length ?? 0) === 0 && (
            <p className="text-xs text-amber-700 w-full">No periods yet — seed defaults first.</p>
          )}
        </CardContent>
      </Card>

      {sectionId && grid && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{grid.section_name || "Grid"}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="border px-2 py-1 bg-slate-50 text-left">Period</th>
                  {(grid.weekdays || []).map((d) => (
                    <th key={d.id} className="border px-2 py-1 bg-slate-50">
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(grid.periods || []).map((p) => (
                  <tr key={p.id} className={p.is_break ? "bg-slate-100/80" : ""}>
                    <td className="border px-2 py-1 font-medium whitespace-nowrap">{p.name}</td>
                    {(grid.weekdays || []).map((d) => {
                      const cell = cellMap.get(`${d.id}-${p.id}`);
                      return (
                        <td key={d.id} className="border px-1 py-1 align-top min-w-[5.5rem]">
                          {p.is_break ? (
                            <span className="text-muted-foreground">—</span>
                          ) : cell ? (
                            <button
                              type="button"
                              className="w-full text-left rounded bg-teal-50 px-1 py-1 hover:bg-teal-100"
                              title="Click to clear"
                              onClick={() => clear(cell.id)}
                            >
                              {cell.subject_name}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="w-full rounded border border-dashed px-1 py-2 text-muted-foreground hover:border-teal-400 hover:text-teal-800"
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
