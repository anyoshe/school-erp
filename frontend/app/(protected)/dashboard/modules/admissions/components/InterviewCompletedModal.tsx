"use client";


import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/utils/api";
import { Application } from "@/types/admission";
import ApplicationChargePanel from "./ApplicationChargePanel";
import { format } from "date-fns"; // For date formatting, install if needed: npm i date-fns

interface InterviewCompletedFormData {
  completedDate: string;
  interviewerName: string;
  score: number | null;
  outcome: "PASS" | "FAIL" | "WAITLIST" | "";
  comments: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  applicationData: Application;
  onCompleted?: () => void;
}

export default function InterviewCompletedModal({
  open,
  onOpenChange,
  applicationId,
  applicationData,
  onCompleted,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [chargeOk, setChargeOk] = useState(false);
  const [form, setForm] = useState<InterviewCompletedFormData>({
    completedDate: format(new Date(), "yyyy-MM-dd"),
    interviewerName: "",
    score: null,
    outcome: "",
    comments: "",
  });

  const handleSubmit = async () => {
    if (!chargeOk) {
      toast.error("Interview fee decision is required", {
        description: "Choose Not applicable, Waived, Discounted, or Full (and mark paid if due).",
      });
      return;
    }

    if (!form.outcome) {
      toast.error("Outcome is required");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        status: "INTERVIEW_COMPLETED",
        interview_completed_at: new Date().toISOString(),
        interview_outcome: form.outcome,
        interview_comments: form.comments,
        interview_score: form.score,
        interviewer_name: form.interviewerName,
      };

      await api.patch(`/admissions/applications/${applicationId}/`, payload);

      toast.success("Interview marked as completed successfully!");
      onCompleted?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to mark interview completed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 sm:p-8 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
      >
        <DialogHeader>
          <DialogTitle>Mark Interview Completed</DialogTitle>
          <DialogDescription>
            Record the outcome and details of the admission interview.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Interview fee — required on this step (no need to go back) */}
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
            <ApplicationChargePanel
              applicationId={applicationId}
              types={["INTERVIEW"]}
              compact
              required
              title="Interview fee"
              description="Set this here — you do not need to go back to Schedule interview. Choose Not applicable, Waived, Discounted, or Full (mark paid if money is due)."
              onSatisfiedChange={(ok) => setChargeOk(ok)}
            />
          </div>

          {/* Pre-filled applicant summary */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h4 className="font-medium text-gray-800 mb-2">Applicant Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Name:</span>
                <p className="font-medium">
                  {applicationData.first_name} {applicationData.last_name}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Guardian:</span>
                <p className="font-medium">{applicationData.primary_guardian_name || "—"}</p>
              </div>
              <div>
                <span className="text-gray-500">Phone:</span>
                <p className="font-medium">{applicationData.primary_guardian_phone || "—"}</p>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>
                <p className="font-medium">{applicationData.primary_guardian_email || "—"}</p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Class Applied:</span>
                <p className="font-medium">{applicationData.class_applied?.name || "—"}</p>
              </div>
            </div>
          </div>

          {/* Form inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Completed Date *</Label>
              <Input
                type="date"
                value={form.completedDate}
                onChange={(e) => setForm({ ...form, completedDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Interviewer Name</Label>
              <Input
                value={form.interviewerName}
                onChange={(e) => setForm({ ...form, interviewerName: e.target.value })}
                placeholder="John Doe"
              />
            </div>
          </div>

          <div>
            <Label>Interview Score (0-100)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={form.score || ""}
              onChange={(e) => setForm({ ...form, score: parseInt(e.target.value) || null })}
              placeholder="e.g. 85"
            />
          </div>

          <div>
            <Label>Outcome *</Label>
            <Select value={form.outcome} onValueChange={(val) => setForm({ ...form, outcome: val as "PASS" | "FAIL" | "WAITLIST" | "" })}>
              <SelectTrigger>
                <SelectValue placeholder="Select outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PASS">Pass</SelectItem>
                <SelectItem value="FAIL">Fail</SelectItem>
                <SelectItem value="WAITLIST">Waitlist</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Comments</Label>
            <Textarea
              value={form.comments}
              onChange={(e) => setForm({ ...form, comments: e.target.value })}
              placeholder="Additional notes or feedback..."
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !chargeOk || !form.completedDate || !form.outcome}
            className="bg-secondary hover:bg-secondary-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Mark Completed
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}