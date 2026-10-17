"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Copy, Plus, Loader2 } from "lucide-react";
import api from "@/utils/api";
import { toast } from "sonner";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import FeeStructureForm from "./../components/FeeStructureForm";
import { cn } from "@/lib/utils";

function asList(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.results)) return o.results as any[];
    if (Array.isArray(o.data)) return o.data as any[];
  }
  return [];
}

export default function FeeStructuresList() {
  const { currentSchool } = useCurrentSchool();
  const [structures, setStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStructureId, setSelectedStructureId] = useState<string | undefined>(undefined);
  const [cloneFromId, setCloneFromId] = useState<string | undefined>(undefined);

  const currencySymbol = currentSchool?.currency_symbol || "KES";

  const fetchStructures = useCallback(async () => {
    if (!currentSchool?.id) {
      setStructures([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/finance/structures/", {
        headers: { "X-School-ID": currentSchool.id },
      });
      setStructures(asList(res.data));
    } catch (err: any) {
      console.error(err);
      setStructures([]);
      setError(err?.response?.data?.detail || "Failed to load fee structures");
      toast.error("Failed to load fee structures");
    } finally {
      setLoading(false);
    }
  }, [currentSchool?.id]);

  useEffect(() => {
    void fetchStructures();
  }, [fetchStructures]);

  const groupedByGrade = useMemo(() => {
    const groups: Record<
      string,
      { gradeName: string; academicYear: string; items: any[]; annualTotal: number }
    > = {};

    for (const fs of structures) {
      if (!fs || typeof fs !== "object") continue;
      const gl = fs.grade_level;
      const gradeId = String(
        (typeof gl === "object" && gl?.id) || gl || fs.grade_level_id || "unknown"
      );
      const gradeName =
        (typeof gl === "object" && (gl?.name || gl?.short_name)) ||
        fs.grade_level_name ||
        "Unassigned grade";

      if (!groups[gradeId]) {
        groups[gradeId] = {
          gradeName,
          academicYear: fs.academic_year || "—",
          items: [],
          annualTotal: 0,
        };
      }

      // List API is lite (no structure_items) — use total_amount annotation
      const mandatoryTotal = Number(fs.total_amount ?? fs.mandatoryTotal ?? 0);

      groups[gradeId].items.push({ ...fs, mandatoryTotal });
      groups[gradeId].annualTotal += Number(mandatoryTotal || 0);
    }

    return groups;
  }, [structures]);

  const handleCreate = () => {
    setSelectedStructureId(undefined);
    setCloneFromId(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (id: string) => {
    setCloneFromId(undefined);
    setSelectedStructureId(id);
    setIsFormOpen(true);
  };

  const handleClone = (id: string) => {
    setCloneFromId(id);
    setSelectedStructureId(undefined);
    setIsFormOpen(true);
  };

  const quickClone = async (
    fs: any,
    opts: { period_name: string; academic_year?: string; name?: string }
  ) => {
    if (!currentSchool?.id) return;
    try {
      setLoading(true);
      const year = opts.academic_year || fs.academic_year;
      const period = opts.period_name;
      const name =
        opts.name ||
        `${typeof fs.grade_level === "object" ? fs.grade_level?.name : "Grade"} – ${period} – ${year}`;
      await api.post(
        `/finance/structures/${fs.id}/clone/`,
        {
          period_name: period,
          academic_year: year,
          name,
          is_active: true,
        },
        { headers: { "X-School-ID": currentSchool.id } }
      );
      toast.success(`Cloned to ${period} (${year})`);
      await fetchStructures();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Could not clone fee structure");
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this fee structure?")) return;
    try {
      await api.delete(`/finance/structures/${id}/`, {
        headers: { "X-School-ID": currentSchool?.id },
      });
      toast.success("Deleted");
      await fetchStructures();
    } catch {
      toast.error("Delete failed");
    }
  };

  const gradeEntries = Object.entries(groupedByGrade);

  return (
    <div className="space-y-8 p-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fee structures</h1>
          <p className="text-muted-foreground">
            Define grade-based fees per term. Offer letters pick these up by class applied.
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Create structure
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-xl border bg-stone-50 px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading structures…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm flex justify-between items-center gap-3">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void fetchStructures()}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && gradeEntries.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed rounded-xl space-y-3">
          <p className="text-muted-foreground">
            No fee structures yet. Create Term 1 for a grade, then clone to Term 2 / Term 3.
          </p>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Create first structure
          </Button>
        </div>
      )}

      {gradeEntries.length > 0 && (
        <div className="space-y-10">
          {gradeEntries.map(([gradeId, group]) => (
            <div key={gradeId} className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{group.gradeName}</h2>
                  <span className="text-sm text-slate-500 font-medium uppercase tracking-wider">
                    Academic Year {group.academicYear}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 uppercase font-semibold">Listed total</p>
                  <p className="text-2xl font-black text-primary">
                    {currencySymbol} {Number(group.annualTotal || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Structure</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Mandatory</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.map((fs: any) => (
                    <TableRow key={fs.id}>
                      <TableCell className="font-medium">{fs.name}</TableCell>
                      <TableCell>
                        <span className="text-sm">{fs.period_name || "—"}</span>
                        <span className="text-[10px] text-slate-400 block">
                          {fs.billing_period_type || "term"}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {currencySymbol} {Number(fs.mandatoryTotal || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-secondary-700">
                        {currencySymbol} {Number(fs.total_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                            fs.is_active
                              ? "bg-secondary-100 text-secondary-700"
                              : "bg-red-100 text-red-700"
                          )}
                        >
                          {fs.is_active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-primary-700 border-primary-200"
                            onClick={() => handleClone(fs.id)}
                          >
                            <Copy className="h-3.5 w-3.5" /> Clone & edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={loading}
                            onClick={() =>
                              quickClone(fs, {
                                period_name: "Term 2",
                                name: `${group.gradeName} – Term 2 – ${fs.academic_year}`,
                              })
                            }
                          >
                            → T2
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={loading}
                            onClick={() =>
                              quickClone(fs, {
                                period_name: "Term 3",
                                name: `${group.gradeName} – Term 3 – ${fs.academic_year}`,
                              })
                            }
                          >
                            → T3
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(fs.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500"
                            onClick={() => handleDelete(fs.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}

      <FeeStructureForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={fetchStructures}
        structureId={selectedStructureId}
        cloneFromId={cloneFromId}
      />
    </div>
  );
}
