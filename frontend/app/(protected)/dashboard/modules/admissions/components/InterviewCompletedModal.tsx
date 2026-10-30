"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Application } from "@/types/admission";
import ApplicationChargePanel from "./ApplicationChargePanel";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  applicationData: Application;
  onCompleted?: (data?: { status?: string; interview_outcome?: string }) => void;
}

export default function InterviewCompletedModal({
  open,
  onOpenChange,
  applicationId,
  applicationData,
  onCompleted,
}: Props) {
  const { currentSchool } = useCurrentSchool() as { currentSchool: any };
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<string>("PASS");
  const [notes, setNotes] = useState("");
  const [chargeOk, setChargeOk] = useState(false);

  const interviewFeeOn =
    !!currentSchool?.interview_fee_enabled &&
    Number(currentSchool?.interview_fee_amount || 0) > 0;
  const currency =
    currentSchool?.currency_symbol || currentSchool?.currency || "KSh";

  const handleSubmit = async () => {
    if (interviewFeeOn && !chargeOk) {
      toast.error("Record the interview fee decision", {
        description:
          "Choose Not applicable, Waived, Discounted, or Full (mark paid if due).",
      });
      return;
    }

    setLoading(true);
    try {
      await api.patch(`/admissions/applications/${applicationId}/`, {
        status: "INTERVIEW_COMPLETED",
        interview_outcome: outcome,
        interview_notes: notes,
      });
      toast.success("Interview marked complete");
      onOpenChange(false);
      onCompleted?.({ status: "INTERVIEW_COMPLETED", interview_outcome: outcome });
    } catch (err: any) {
      toast.error(
        err?.response?.data?.detail ||
          err?.response?.data?.status?.[0] ||
          "Could not complete interview"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark interview completed</DialogTitle>
          <DialogDescription>
            {applicationData.first_name} {applicationData.last_name} — record
            outcome
            {interviewFeeOn ? " and interview fee decision" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Outcome *</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PASS">Pass / proceed</SelectItem>
                <SelectItem value="FAIL">Fail</SelectItem>
                <SelectItem value="PENDING">Pending further review</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional interview notes"
            />
          </div>

          {interviewFeeOn ? (
            <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3">
              <ApplicationChargePanel
                applicationId={applicationId}
                types={["INTERVIEW"]}
                currencySymbol={currency}
                compact
                title="Interview fee decision"
                description="Required after the interview — paid, waived, discounted, or not applicable."
                required
                onSatisfiedChange={(ok) => setChargeOk(ok)}
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No interview fee configured for this school — skip payment step.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={loading} onClick={handleSubmit}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save & complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
