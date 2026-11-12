"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Users } from "lucide-react";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FinanceNavLinks } from "../components/FinanceNav";

type Row = {
  student_id: string;
  admission_number: string;
  name: string;
  grade_id: number;
  grade_name: string;
  outstanding: number;
  needs_billing: boolean;
  structure_name?: string | null;
};

type Structure = {
  id: string;
  name: string;
  grade_level?: number | { id: number; name?: string };
  period_name?: string;
  academic_year?: string;
};

function asList(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as any;
    if (Array.isArray(o.results)) return o.results;
    if (Array.isArray(o.data)) return o.data;
  }
  return [];
}

export default function ReturningStudentsBillingPage() {
  const { currentSchool } = useCurrentSchool();
  const [yearId, setYearId] = useState<string>("");
  const [years, setYears] = useState<{ id: number; name: string; is_active?: boolean }[]>([]);
  const [gradeId, setGradeId] = useState<string>("");
  const [grades, setGrades] = useState<{ id: number; name: string }[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [structureId, setStructureId] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [onlyUnbilled, setOnlyUnbilled] = useState(true);
  const [carryBalances, setCarryBalances] = useState(true);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [billing, setBilling] = useState(false);
  const [yearName, setYearName] = useState("");

  const loadMeta = useCallback(async () => {
    try {
      const [yRes, gRes, sRes] = await Promise.all([
        api.get("/academics/academic-years/"),
        api.get("/academics/grade-levels/"),
        api.get("/finance/structures/"),
      ]);
      const ys = asList(yRes.data);
      setYears(ys);
      const active = ys.find((y: any) => y.is_active) || ys[0];
      if (active && !yearId) setYearId(String(active.id));
      setGrades(asList(gRes.data));
      setStructures(asList(sRes.data));
    } catch {
      toast.error("Could not load years / structures");
    }
  }, [yearId]);

  const loadRows = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const { data } = await api.get("/finance/returning-students/", {
        params: {
          academic_year: yearId,
          grade_level: gradeId || undefined,
          only_unbilled: onlyUnbilled ? 1 : 0,
        },
        headers: currentSchool?.id ? { "X-School-ID": String(currentSchool.id) } : undefined,
      });
      setRows(data.results || []);
      setYearName(data.academic_year?.name || "");
      setSelected({});
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not load returning students");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [yearId, gradeId, onlyUnbilled, currentSchool?.id]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      `${r.name} ${r.admission_number} ${r.grade_name}`.toLowerCase().includes(term)
    );
  }, [rows, q]);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  const structuresForFilter = useMemo(() => {
    if (!gradeId) return structures;
    return structures.filter((s) => {
      const g = s.grade_level;
      const id = typeof g === "object" ? g?.id : g;
      return String(id) === String(gradeId);
    });
  }, [structures, gradeId]);

  const billSelected = async () => {
    if (!selectedIds.length) {
      toast.message("Select learners who have reported to school");
      return;
    }
    if (!structureId) {
      toast.message("Choose the fee structure for the new grade / term");
      return;
    }
    setBilling(true);
    try {
      const { data } = await api.post(
        "/finance/returning-students/bill/",
        {
          student_ids: selectedIds,
          fee_structure_id: structureId,
          carry_balances: carryBalances,
        },
        {
          headers: currentSchool?.id ? { "X-School-ID": String(currentSchool.id) } : undefined,
        }
      );
      toast.success(
        `Billed ${data.billed} learner(s)` +
          (data.structure?.name ? ` · ${data.structure.name}` : "")
      );
      await loadRows();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Billing failed");
    } finally {
      setBilling(false);
    }
  };

  const toggleAll = (on: boolean) => {
    const next: Record<string, boolean> = {};
    if (on) filtered.forEach((r) => (next[r.student_id] = true));
    setSelected(next);
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <FinanceNavLinks />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Returning students billing
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl mt-1">
            After promotion, do <strong>not</strong> bill everyone at once. When a learner reports
            back, select them here, assign the new grade fee structure, and invoice — prior balances
            can be carried onto the new bill.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadRows()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1">Refresh</span>
        </Button>
      </div>

      <Card className="rounded-2xl border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Academic year</Label>
            <select
              className="mt-1 w-full h-9 rounded-md border px-2 text-sm bg-background"
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}{y.is_active ? " (active)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Grade (optional)</Label>
            <select
              className="mt-1 w-full h-9 rounded-md border px-2 text-sm bg-background"
              value={gradeId}
              onChange={(e) => setGradeId(e.target.value)}
            >
              <option value="">All grades</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Search</Label>
            <Input
              className="mt-1"
              placeholder="Name or admission #"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyUnbilled}
                onChange={(e) => setOnlyUnbilled(e.target.checked)}
              />
              Only need new-grade structure
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {yearName || "Year"} · {filtered.length} learner(s)
            {selectedIds.length ? ` · ${selectedIds.length} selected` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="min-w-[16rem] flex-1">
              <Label className="text-xs">Fee structure for those who reported</Label>
              <select
                className="mt-1 w-full h-9 rounded-md border px-2 text-sm bg-background"
                value={structureId}
                onChange={(e) => setStructureId(e.target.value)}
              >
                <option value="">Select structure…</option>
                {structuresForFilter.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.period_name ? ` · ${s.period_name}` : ""}
                    {s.academic_year ? ` · ${s.academic_year}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm h-9">
              <input
                type="checkbox"
                checked={carryBalances}
                onChange={(e) => setCarryBalances(e.target.checked)}
              />
              Carry prior unpaid balance
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => toggleAll(selectedIds.length < filtered.length)}
            >
              {selectedIds.length < filtered.length ? "Select all listed" : "Clear selection"}
            </Button>
            <Button
              className="h-9 bg-primary"
              disabled={billing || !selectedIds.length || !structureId}
              onClick={billSelected}
            >
              {billing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Bill selected ({selectedIds.length})
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 w-10" />
                  <th className="px-3 py-2">Adm #</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Grade</th>
                  <th className="px-3 py-2">Structure</th>
                  <th className="px-3 py-2 text-right">Prior balance</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                      No returning learners match. Promote first, or turn off “only need new-grade structure”.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.student_id} className="border-t">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!!selected[r.student_id]}
                          onChange={(e) =>
                            setSelected((prev) => ({
                              ...prev,
                              [r.student_id]: e.target.checked,
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 tabular-nums">{r.admission_number || "—"}</td>
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2">{r.grade_name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.needs_billing ? (
                          <span className="text-amber-700">Needs structure</span>
                        ) : (
                          r.structure_name || "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {Number(r.outstanding || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
