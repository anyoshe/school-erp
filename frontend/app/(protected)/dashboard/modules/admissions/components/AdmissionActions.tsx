"use client";

import { useState } from "react";
import api from "@/utils/api";
import { Button } from "@/components/ui/button";
import {
  Mail, CheckCircle2, UserPlus, XCircle,
  Loader2, Zap, AlertCircle, Calendar,
  ChevronRight, ArrowUpRight
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  applicationId: string;
  currentStatus: string;
  onUpdated?: () => void;
  onEnrolled?: (student: { id: string; full_name?: string }) => void;
}

export default function AdmissionActions({ applicationId, currentStatus, onUpdated, onEnrolled }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  const performAction = async (actionType: 'status' | 'enroll', value?: string, metadata?: any) => {
    try {
      setLoading(value || actionType);
      if (actionType === 'status') {
        await api.patch(`/admissions/applications/${applicationId}/`, {
          status: value,
          rejection_reason: metadata?.reason,
          internal_notes: metadata?.notes
        });
        toast.success(`Pipeline updated to ${value?.replace('_', ' ')}`);
        setIsRejectOpen(false);
      } else {
        const res = await api.post(`/admissions/applications/${applicationId}/enroll/`);
        onEnrolled?.(res.data);
        toast.success("Identity digitized: Student enrolled!");
      }
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Protocol failed");
    } finally {
      setLoading(null);
    }
  };

  const status = currentStatus?.toUpperCase();

  const renderPrimaryActions = () => {
    // 1. STAGE: NEW SUBMISSION -> SCHEDULE TEST
    if (status === 'SUBMITTED' || status === 'UNDER_REVIEW') {
      return (
        <div className="grid grid-cols-1 sm:flex items-center gap-3 w-full">
          <Button
            disabled={!!loading}
            onClick={() => performAction('status', 'TEST_SCHEDULED')}
            className="group bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-200 rounded-2xl h-12 px-6 transition-all active:scale-95"
          >
            {loading === 'TEST_SCHEDULED' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
            <span className="font-bold">Schedule Interview</span>
            <ChevronRight className="ml-2 h-4 w-4 opacity-50 group-hover:translate-x-1 transition-transform" />
          </Button>

          <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="h-12 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-colors font-semibold">
                <XCircle className="h-4 w-4 mr-2" /> Reject
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] border-none sm:max-w-[425px] p-8 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-900">
                  <div className="p-2 rounded-xl bg-red-100"><AlertCircle className="h-5 w-5 text-red-600" /></div>
                  Regret Application
                </DialogTitle>
                <DialogDescription className="text-slate-500 pt-2 text-base">
                  Protocol requires a reason for rejection. This action is logged permanently.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-6">
                <Select onValueChange={setRejectReason}>
                  <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-slate-100 focus:ring-red-500">
                    <SelectValue placeholder="Select dismissal reason" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                    <SelectItem value="class_full">Class capacity reached</SelectItem>
                    <SelectItem value="failed_interview">Academic criteria not met</SelectItem>
                    <SelectItem value="incomplete_docs">Incomplete data packets</SelectItem>
                    <SelectItem value="age_criteria">Age-specific variance</SelectItem>
                    <SelectItem value="other">Unspecified / Other</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Internal audit notes..."
                  className="rounded-2xl bg-slate-50 border-slate-100 min-h-[120px] focus-visible:ring-red-500 p-4"
                  onChange={(e) => setRejectNotes(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="destructive"
                  className="w-full h-14 rounded-2xl font-black text-base shadow-lg shadow-red-100"
                  disabled={!rejectReason || !!loading}
                  onClick={() => performAction('status', 'REJECTED', { reason: rejectReason, notes: rejectNotes })}
                >
                  Terminate Application
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    // 2. STAGE: TESTED -> OFFER
    if (status === 'TEST_SCHEDULED') {
      return (
        <Button
          disabled={!!loading}
          onClick={() => performAction('status', 'OFFERED')}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-12 px-8 shadow-xl shadow-emerald-100 font-black animate-in fade-in slide-in-from-bottom-2"
        >
          {loading === 'OFFERED' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpRight className="mr-2 h-4 w-4" />}
          Issue Official Offer
        </Button>
      );
    }

    // 3. STAGE: OFFERED -> ACCEPTED -> ENROLL
    if (status === 'OFFERED' || status === 'ACCEPTED') {
      const isAccepted = status === 'ACCEPTED';
      return (
        <Button
          disabled={!!loading}
          onClick={() => isAccepted ? performAction('enroll') : performAction('status', 'ACCEPTED')}
          className={cn(
            "w-full sm:w-auto h-12 px-10 rounded-2xl font-black transition-all shadow-xl active:scale-95",
            isAccepted
              ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] animate-gradient text-white"
              : "bg-emerald-500 text-white shadow-emerald-100"
          )}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
          {isAccepted ? "Finalize Enrollment" : "Mark as Accepted"}
        </Button>
      );
    }

    return null;
  };

  return (
    <div className="w-full flex flex-col sm:flex-row items-center gap-4 sm:gap-6 bg-slate-50/50 p-2 sm:p-0 rounded-3xl">
      {/* Primary Context Action */}
      <div className="w-full sm:w-auto flex-1">
        {renderPrimaryActions()}
      </div>

      {/* Secondary Techy Shortcut */}
      {!['ENROLLED', 'REJECTED'].includes(status) && (
        <div className="flex items-center gap-4 w-full sm:w-auto justify-center sm:justify-end">
          <div className="hidden sm:block h-6 w-[1px] bg-slate-200" />
          <Button
            variant="outline"
            size="sm"
            disabled={!!loading}
            onClick={() => performAction('status', 'ENROLLED')}
            className="group h-10 px-4 rounded-xl border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 text-slate-500 hover:text-indigo-600 transition-all"
          >
            <Zap className="h-3.5 w-3.5 mr-2 text-indigo-500 group-hover:animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-widest">Direct Enroll</span>
          </Button>
        </div>
      )}

      {/* Finished States */}
      {status === 'ENROLLED' && (
        <div className="flex items-center gap-3 py-2 px-6 bg-emerald-50 border border-emerald-100 rounded-2xl">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Active Student</span>
        </div>
      )}
    </div>
  );
}