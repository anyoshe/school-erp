"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, GraduationCap, Loader2, RefreshCw } from "lucide-react";

import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

function asList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export default function PromoteStudentsPage() {
  const router = useRouter();
  const { currentSchool } = useCurrentSchool();
  const qc = useQueryClient();
  const schoolId = currentSchool?.id;

  const [action, setAction] = useState("PROMOTE");
  const [yearId, setYearId] = useState("");
  const [targetGradeId, setTargetGradeId] = useState("");
  const [fromGradeFilter, setFromGradeFilter] = useState("all");
  const [carryFees, setCarryFees] = useState(true);
  const [carryTerm, setCarryTerm] = useState("Term 1");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const [termYearLabel, setTermYearLabel] = useState("");
  const [toTerm, setToTerm] = useState("Term 2");
  const [termBusy, setTermBusy] = useState(false);

  const headers = schoolId ? { "X-School-ID": String(schoolId) } : undefined;

  const yearsQ = useQuery({
    queryKey: ["years-promote", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const res = await api.get("/academics/years/", { headers });
      return asList(res.data);
    },
  });

  const gradesQ = useQuery({
    queryKey: ["grades-promote", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const res = await api.get("/academics/grade-levels/", { headers });
      return asList(res.data);
    },
  });

  const studentsQ = useQuery({
    queryKey: ["students-promote", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const res = await api.get("/students/", { headers });
      return asList(res.data);
    },
  });

  const students = useMemo(() => {
    const list = studentsQ.data || [];
    if (fromGradeFilter === "all") return list;
    return list.filter(
      (s: any) =>
        s.current_class?.name === fromGradeFilter ||
        String(s.current_class?.id) === fromGradeFilter
    );
  }, [studentsQ.data, fromGradeFilter]);

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const toggleAll = (on: boolean) => {
    const next: Record<string, boolean> = {};
    students.forEach((s: any) => {
      next[String(s.id)] = on;
    });
    setSelected(next);
  };

  const runPromote = async () => {
    if (!yearId) {
      toast.error("Select the target academic year");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Select at least one student");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post(
        "/students/promote/",
        {
          student_ids: selectedIds,
          academic_year_id: yearId,
          action,
          target_grade_id: targetGradeId || undefined,
          carry_fees: carryFees,
          carry_term: carryTerm,
        },
        { headers }
      );
      const n = res.data?.count ?? 0;
      const errs = res.data?.errors?.length || 0;
      toast.success(`Processed ${n} student(s)` + (errs ? ` · ${errs} error(s)` : ""));
      if (errs) console.warn(res.data.errors);
      qc.invalidateQueries({ queryKey: ["students-promote"] });
      setSelected({});
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Promotion failed");
    } finally {
      setBusy(false);
    }
  };

  const runTermCarry = async () => {
    if (!termYearLabel || !toTerm) {
      toast.error("Enter academic year label and target term");
      return;
    }
    setTermBusy(true);
    try {
      const res = await api.post(
        "/students/carry-term-balances/",
        {
          academic_year: termYearLabel,
          to_term: toTerm,
          student_ids: selectedIds.length ? selectedIds : undefined,
        },
        { headers }
      );
      toast.success(`Carried balances for ${res.data?.count ?? 0} student(s)`);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Term carry failed");
    } finally {
      setTermBusy(false);
    }
  };

  const years = yearsQ.data || [];
  const grades = gradesQ.data || [];

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/modules/students")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Students
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-emerald-700" />
          Promote / carry fees
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Year-end promotion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Action</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROMOTE">Promote to next grade</SelectItem>
                  <SelectItem value="REPEAT">Repeat same grade</SelectItem>
                  <SelectItem value="GRADUATE">Graduate / leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target academic year *</Label>
              <Select value={yearId} onValueChange={setYearId}>
                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {years.map((y: any) => (
                    <SelectItem key={String(y.id)} value={String(y.id)}>
                      {y.name}{y.is_active ? " (active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target grade (optional override)</Label>
              <Select value={targetGradeId || "auto"} onValueChange={(v) => setTargetGradeId(v === "auto" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Auto next grade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (next by order)</SelectItem>
                  {grades.map((g: any) => (
                    <SelectItem key={String(g.id)} value={String(g.id)}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Filter current grade</Label>
              <Select value={fromGradeFilter} onValueChange={setFromGradeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All grades</SelectItem>
                  {grades.map((g: any) => (
                    <SelectItem key={String(g.id)} value={g.name}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Arrears term label on new year</Label>
              <Input value={carryTerm} onChange={(e) => setCarryTerm(e.target.value)} placeholder="Term 1" />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox id="carry" checked={carryFees} onCheckedChange={(v) => setCarryFees(v === true)} />
              <Label htmlFor="carry">Carry unpaid fees into new year</Label>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button type="button" variant="outline" size="sm" onClick={() => toggleAll(true)}>Select all shown</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => toggleAll(false)}>Clear</Button>
            <Button
              type="button"
              className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={busy}
              onClick={runPromote}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Run for {selectedIds.length || 0} student(s)
            </Button>
          </div>

          <div className="border rounded-xl max-h-80 overflow-y-auto divide-y">
            {studentsQ.isLoading && (
              <p className="p-4 text-sm text-muted-foreground">Loading students…</p>
            )}
            {students.map((s: any) => (
              <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                <Checkbox
                  checked={!!selected[String(s.id)]}
                  onCheckedChange={(v) =>
                    setSelected((prev) => ({ ...prev, [String(s.id)]: v === true }))
                  }
                />
                <span className="text-sm font-medium flex-1">
                  {s.full_name || `${s.first_name} ${s.last_name}`}
                </span>
                <span className="text-xs text-muted-foreground font-mono">{s.admission_number}</span>
                <span className="text-xs text-slate-600 w-28 text-right">
                  {s.current_class?.name || "—"}
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Term-to-term fee carry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Moves unpaid invoice balances into a new balance-brought-forward invoice for the target term.
            Leave selection empty to include all active students with arrears.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>Academic year label</Label>
              <Input
                value={termYearLabel}
                onChange={(e) => setTermYearLabel(e.target.value)}
                placeholder="e.g. 2026 or 2026/2027"
              />
            </div>
            <div>
              <Label>Target term</Label>
              <Input value={toTerm} onChange={(e) => setToTerm(e.target.value)} placeholder="Term 2" />
            </div>
            <div className="flex items-end">
              <Button type="button" variant="secondary" disabled={termBusy} onClick={runTermCarry} className="w-full">
                {termBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Carry balances
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
