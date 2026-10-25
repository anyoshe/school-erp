// modules/admissions/components/InterviewScheduleModal.tsx
"use client";

import { useMemo, useState } from "react";
import api from "@/utils/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { Application } from "@/types/admission";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";

interface InterviewFormData {
  date: string;
  time: string;
  venue: string;
  contact_person: string;
  instructions: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  applicationData: Application;
  onScheduled?: () => void;
}

export default function InterviewScheduleModal({
  open,
  onOpenChange,
  applicationId,
  applicationData,
  onScheduled,
}: Props) {
  const { currentSchool } = useCurrentSchool() as { currentSchool: any };
  const [loading, setLoading] = useState(false);

  const interviewFeeNote = useMemo(() => {
    const enabled = !!currentSchool?.interview_fee_enabled;
    const amount = Number(currentSchool?.interview_fee_amount || 0);
    if (!enabled || amount <= 0) return null;
    const cur =
      currentSchool?.currency_symbol || currentSchool?.currency || "KES";
    return `${cur} ${amount.toLocaleString()} interview fee (set in school settings) — collect / waive after the interview.`;
  }, [currentSchool]);

  const [form, setForm] = useState<InterviewFormData>({
    date: "",
    time: "",
    venue: "Administration Block",
    contact_person: "Admissions Officer",
    instructions:
      "Please bring:\n- Original birth certificate\n- Previous school report card\n- Two passport photos\n- Guardian national ID",
  });

  const handleSubmit = async () => {
    if (!form.date || !form.time) {
      toast.error("Interview date and time are required");
      return;
    }

    setLoading(true);
    try {
      const instructions = interviewFeeNote
        ? `${form.instructions}\n\n—\nSchool note: ${interviewFeeNote}`
        : form.instructions;

      await api.patch(`/admissions/applications/${applicationId}/`, {
        status: "TEST_SCHEDULED",
        interview_date: form.date,
        interview_time: form.time,
        interview_venue: form.venue,
        interview_contact_person: form.contact_person,
        interview_instructions: instructions,
      });

      toast.success("Interview scheduled");
      onOpenChange(false);
      onScheduled?.();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.detail ||
          err?.response?.data?.status?.[0] ||
          "Could not schedule interview"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule interview</DialogTitle>
          <DialogDescription>
            {applicationData.first_name} {applicationData.last_name} — set date,
            time, and what to bring. Fee payment is decided after the interview.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {interviewFeeNote ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
              <p className="font-medium">Materials / fees note</p>
              <p className="mt-0.5">{interviewFeeNote}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              No interview fee configured in settings — nothing extra to collect.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <Label>Time *</Label>
              <Input
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Venue</Label>
            <Input
              value={form.venue}
              onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
            />
          </div>
          <div>
            <Label>Contact person</Label>
            <Input
              value={form.contact_person}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_person: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Instructions / materials to bring</Label>
            <Textarea
              rows={5}
              value={form.instructions}
              onChange={(e) =>
                setForm((f) => ({ ...f, instructions: e.target.value }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={loading} onClick={handleSubmit}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
