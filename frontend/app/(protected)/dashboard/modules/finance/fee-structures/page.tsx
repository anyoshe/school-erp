"use client";

import { useState, useEffect, useMemo } from "react";
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

export default function FeeStructuresList() {
  const { currentSchool } = useCurrentSchool();
  const [structures, setStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStructureId, setSelectedStructureId] = useState<string | undefined>(undefined);
  const [cloneFromId, setCloneFromId] = useState<string | undefined>(undefined);

  const currencySymbol = currentSchool?.currency_symbol || "KES";

  useEffect(() => {
    fetchStructures();
  }, [currentSchool?.id]);

  const fetchStructures = async () => {
    setLoading(true);
    try {
      const res = await api.get("/finance/structures/", {
        headers: { "X-School-ID": currentSchool?.id }
      });
      setStructures(res.data.results || res.data);
    } catch (err) {
      toast.error("Failed to load fee structures");
    } finally {
      setLoading(false);
    }
  };

  // Grouping logic: Organize by Grade Level
  const groupedByGrade = useMemo(() => {
    const groups: Record<string, { gradeName: string; academicYear: string; items: any[]; annualTotal: number }> = {};

    structures.forEach((fs) => {
      const gradeId = fs.grade_level.id;
      if (!groups[gradeId]) {
        groups[gradeId] = {
          gradeName: fs.grade_level.name,
          academicYear: fs.academic_year,
          items: [],
          annualTotal: 0,
        };
      }

      // Calculate only mandatory items for the Annual Total
      // Using structure_items to filter out the ones flagged as optional
      const mandatoryTotal = fs.structure_items?.reduce((sum: number, si: any) => {
        const isOptional = fs.available_optional_items?.includes(si.item);
        return isOptional ? sum : sum + Number(si.amount);
      }, 0) || Number(fs.total_amount);

      groups[gradeId].items.push({
        ...fs,
        mandatoryTotal // Store this for the table display
      });

      groups[gradeId].annualTotal += mandatoryTotal;
    });

    return groups;
  }, [structures]);

  const handleCreate = () => {
    setSelectedStructureId(undefined);
    setCloneFromId(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (id: string) => {
    setSelectedStructureId(id);
    setCloneFromId(undefined);
    setIsFormOpen(true);
  };

  const handleClone = (id: string) => {
    setCloneFromId(id);
    setSelectedStructureId(undefined); // Treat as new record
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this fee structure?")) return;
    try {
      await api.delete(`/finance/structures/${id}/`);
      toast.success("Fee structure deleted");
      fetchStructures();
    } catch (err) {
      toast.error("Failed to delete structure");
    }
  };

  return (
    <div className="space-y-8 p-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fee Management</h1>
          <p className="text-muted-foreground">Define and manage grade-based fee structures.</p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Create New Structure
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Loading structures...</p>
        </div>
      ) : Object.keys(groupedByGrade).length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-lg">
          <p>No fee structures found. Start by creating your first grade structure.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(groupedByGrade).map(([gradeId, group]) => (
            <div key={gradeId} className="rounded-xl border bg-card shadow-sm overflow-hidden">
              {/* Grade Header */}
              <div className="bg-slate-50 px-6 py-4 border-b flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{group.gradeName}</h2>
                  <span className="text-sm text-slate-500 font-medium uppercase tracking-wider">
                    Academic Year {group.academicYear}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 uppercase font-semibold">Total Annual Fees</p>
                  <p className="text-2xl font-black text-primary">
                    {currencySymbol} {group.annualTotal.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Terms Table */}
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="w-[30%]">Structure Name</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.sort((a, b) => a.name.localeCompare(b.name)).map((fs) => (
                    <TableRow key={fs.id} className="hover:bg-slate-50/30 align-top">
                      <TableCell className="font-semibold py-4">
                        {fs.name}
                        {/* List Optional Items here if they exist */}
                        {fs.available_optional_items_details?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Optional Add-ons:</p>
                            {fs.available_optional_items_details.map((opt: any) => {
                              // Find the amount for this optional item from structure_items
                              const amt = fs.structure_items.find((si: any) => si.item === opt.id)?.amount;
                              return (
                                <div key={opt.id} className="text-xs text-primary-700 italic flex items-center gap-1">
                                  <Plus className="h-3 w-3" /> {opt.name}: {currencySymbol} {Number(amt).toLocaleString()}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="capitalize py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{fs.period_name || "General"}</span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-tight">
                            {fs.billing_period_type?.replace('_', ' ')}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-secondary-700 text-lg">
                            {currencySymbol} {fs.mandatoryTotal.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium italic">
                            Mandatory Base
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="font-mono font-bold text-secondary-700">
                        {currencySymbol} {fs.total_amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                          fs.is_active ? "bg-secondary-100 text-secondary-700" : "bg-red-100 text-red-700"
                        )}>
                          {fs.is_active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-primary-700 border-primary-200"
                            onClick={() => handleClone(fs.id)}
                          >
                            <Copy className="h-3.5 w-3.5" /> Clone
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(fs.id)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(fs.id)}>
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

      {/* Modal Integration */}
      <FeeStructureForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={fetchStructures}
        structureId={selectedStructureId}
        // NOTE: Ensure your FeeStructureForm is updated to handle this new prop
        // @ts-ignore (if prop not yet in interface)
        cloneFromId={cloneFromId}
      />
    </div>
  );
}