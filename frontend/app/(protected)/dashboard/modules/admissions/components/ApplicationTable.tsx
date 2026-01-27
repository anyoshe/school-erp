"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/utils/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye, UserPlus, MoreHorizontal,
  CreditCard, Fingerprint, Calendar, User
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Use the interface you provided
interface Application {
  id: string;
  admission_number?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "TEST_SCHEDULED" | "OFFERED" | "ACCEPTED" | "REJECTED" | "ENROLLED";
  class_applied?: { id: number | string; name: string; education_level?: string; pathway?: string };
  fee_payments?: Array<{ id: string; amount: number }>;
  student?: { id: string; full_name: string };
}

interface ApplicationTableProps {
  searchTerm?: string;
  applications?: Application[];
  statusFilter?: string;
}

export default function ApplicationTable({
  searchTerm = "",
  applications: providedApplications,
  statusFilter,
}: ApplicationTableProps) {
  const router = useRouter();
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const { data: fetched = [], isLoading } = useQuery<Application[]>({
    queryKey: ["applications"],
    queryFn: async () => {
      const res = await api.get("/admissions/applications/");
      return res.data;
    },
    enabled: !providedApplications,
  });

  const applications = providedApplications ?? fetched;

  const handleEnroll = async (id: string) => {
    try {
      setEnrollingId(id);
      const res = await api.post(`/admissions/applications/${id}/enroll/`);
      toast.success("Student enrolled successfully!");
      router.push(`/dashboard/modules/students/${res.data?.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Enrollment failed");
    } finally {
      setEnrollingId(null);
    }
  };

  const filtered = applications.filter((app) => {
    const matchesStatus = statusFilter && statusFilter !== "ALL" ? app.status === statusFilter : true;
    const fullName = `${app.first_name} ${app.middle_name || ''} ${app.last_name}`.toLowerCase();
    const matchesSearch = searchTerm
      ? fullName.includes(searchTerm.toLowerCase()) || app.admission_number?.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    return matchesStatus && matchesSearch;
  });

  if (isLoading) return <TableSkeleton />;

  return (
    <div className="w-full">
      {/* --- DESKTOP VIEW --- */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200">
              <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Applicant</th>
              <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">ID / Index</th>
              <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
              <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((app) => (
              <tr key={app.id} className="group hover:bg-indigo-50/30 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shadow-inner">
                      {app.first_name?.[0] || '?'}{app.last_name?.[0] || ''}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 leading-none truncate">
                        {app.first_name} {app.last_name}
                      </p>
                      {/* FIXED: Uses class_applied.name */}
                      <p className="text-[11px] text-slate-400 mt-1 uppercase font-medium tracking-tighter truncate">
                        Grade: {
                          (typeof app.class_applied === 'object' ? app.class_applied?.name : app.class_applied)
                          || 'Unassigned'
                        }
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-4 font-mono text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Fingerprint className="h-3 w-3 text-slate-300" />
                    {app.admission_number || "PENDING"}
                  </div>
                </td>
                <td className="p-4">
                  <StatusBadge status={app.status} hasPayment={(app.fee_payments?.length ?? 0) > 0} />
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/dashboard/modules/admissions/${app.id}`}>
                      <Button variant="ghost" size="sm" className="rounded-xl">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <ActionMenu app={app} onEnroll={handleEnroll} loading={enrollingId === app.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- MOBILE VIEW --- */}
      <div className="md:hidden space-y-3 px-1">
        {filtered.map((app) => (
          <div key={app.id} className="bg-white p-4 rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-base shadow-md">
                  {app.first_name?.[0] || <User className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">
                    {app.first_name} {app.last_name}
                  </h3>
                  {/* FIXED: Uses class_applied.name */}
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                    {app.class_applied?.name || 'Unassigned'} • {app.admission_number || 'No ID'}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <StatusBadge status={app.status} hasPayment={(app.fee_payments?.length ?? 0) > 0} />
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <div className="flex-1 bg-slate-50/80 p-2 rounded-xl flex items-center gap-2 overflow-hidden">
                <CreditCard className="h-3 w-3 shrink-0 text-slate-400" />
                <span className="text-[9px] font-black text-slate-600 uppercase truncate">
                  Paid: {(app.fee_payments?.length ?? 0) > 0 ? 'YES' : 'NO'}
                </span>
              </div>
              <div className="flex-1 bg-slate-50/80 p-2 rounded-xl flex items-center gap-2 overflow-hidden">
                <Calendar className="h-3 w-3 shrink-0 text-slate-400" />
                <span className="text-[9px] font-black text-slate-600 uppercase truncate">Active</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href={`/dashboard/modules/admissions/${app.id}`} className="flex-1">
                <Button variant="outline" className="w-full h-10 rounded-xl font-bold text-[10px] uppercase tracking-wider border-slate-200">
                  View Dossier
                </Button>
              </Link>
              {app.status === "ACCEPTED" && !app.student && (
                <Button
                  onClick={() => handleEnroll(app.id)}
                  disabled={enrollingId === app.id}
                  className="bg-indigo-600 h-10 px-4 rounded-xl shadow-md"
                >
                  <UserPlus className="h-4 w-4 text-white" />
                </Button>
              )}
              <div className="shrink-0">
                <ActionMenu app={app} onEnroll={handleEnroll} loading={enrollingId === app.id} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Sub-components...
function StatusBadge({ status, hasPayment }: { status: string; hasPayment: boolean }) {
  const s = status.toUpperCase();
  const styles: Record<string, string> = {
    ENROLLED: "bg-emerald-50 text-emerald-600 border-emerald-100",
    ACCEPTED: "bg-blue-50 text-blue-600 border-blue-100",
    REJECTED: "bg-red-50 text-red-600 border-red-100",
    OFFERED: "bg-purple-50 text-purple-600 border-purple-100",
    SUBMITTED: "bg-amber-50 text-amber-600 border-amber-100",
    DRAFT: "bg-slate-100 text-slate-500 border-slate-200",
  };

  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className={`rounded-full px-2 py-0.5 text-[9px] font-bold border whitespace-nowrap ${styles[s] || "bg-slate-50"}`}>
        {s}
      </Badge>
      {s === "ACCEPTED" && hasPayment && (
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      )}
    </div>
  );
}

function ActionMenu({ app, onEnroll, loading }: { app: Application; onEnroll: (id: string) => void; loading: boolean }) {
  const isReady = app.status === "ACCEPTED" && (app.fee_payments?.length ?? 0) > 0 && !app.student;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-full hover:bg-slate-100">
          <MoreHorizontal className="h-4 w-4 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2 shadow-2xl border-slate-100">
        <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 px-2 py-1.5">Options</DropdownMenuLabel>
        <DropdownMenuItem className="rounded-xl focus:bg-indigo-50 cursor-pointer text-sm">
          <CreditCard className="h-4 w-4 mr-2 text-slate-400" /> Payments
        </DropdownMenuItem>
        {isReady && (
          <>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              onClick={() => onEnroll(app.id)}
              disabled={loading}
              className="rounded-xl bg-emerald-50 text-emerald-700 focus:bg-emerald-100 focus:text-emerald-800 font-bold cursor-pointer text-sm"
            >
              <UserPlus className="h-4 w-4 mr-2" /> {loading ? "Enrolling..." : "Enroll Now"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-3xl" />
      ))}
    </div>
  );
}