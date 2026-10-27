"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/utils/api";
import { Application } from "@/types/admission";
import ApplicationChargePanel, { Charge } from "./ApplicationChargePanel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  applicationData: Application;
  onAccepted?: (data?: any) => void;
}

function admissionAlreadyOk(app: Application) {
  const charges = ((app as any)?.charges || []) as Charge[];
  const c = charges.find(
    (x) => String(x.charge_type).toUpperCase() === "ADMISSION"
  );
  if (!c) return false;
  if (c.is_satisfied) return true;
  const p = String(c.policy || "").toUpperCase();
  if (p === "NOT_APPLICABLE" || p === "WAIVED") return true;
  if (c.decision_made && Number(c.amount_due || 0) <= 0) return true;
  if (Number(c.amount_paid || 0) > 0 && Number(c.amount_paid) >= Number(c.amount_due || 0))
    return true;
  return false;
}

export default function AcceptOfferModal({
  open,
  onOpenChange,
  applicationId,
  applicationData,
  onAccepted,
}: Props) {
  const initialOk = useMemo(
    () => admissionAlreadyOk(applicationData),
    [applicationData]
  );
  const [loading, setLoading] = useState(false);
  const [chargeOk, setChargeOk] = useState(initialOk);
  const [acceptanceNotes, setAcceptanceNotes] = useState("");

  useEffect(() => {
    if (open) setChargeOk(admissionAlreadyOk(applicationData));
  }, [open, applicationData]);

  const handleAccept = async () => {
    if (!chargeOk) {
      toast.error("Admission fee decision is required", {
        description:
          "Choose Not applicable, Waived, Discounted, or Full (and mark paid if due).",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await api.patch(`/admissions/applications/${applicationId}/`, {
        status: "ACCEPTED",
        acceptance_notes: acceptanceNotes,
        accepted_at: new Date().toISOString(),
      });
      const payload = { ...(res.data || {}), status: "ACCEPTED" };
      toast.success("Offer marked as accepted!");
      onAccepted?.(payload);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to accept offer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Mark Offer Accepted</DialogTitle>
          <DialogDescription>
            Confirm that the guardian has accepted the admission offer for{" "}
            {applicationData.first_name} {applicationData.last_name}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <ApplicationChargePanel
            applicationId={applicationId}
            types={["ADMISSION"]}
            initialCharges={(applicationData as any)?.charges || []}
            compact
            required
            title="Admission / registration fee"
            description={
              initialOk
                ? "Already decided earlier — no need to re-enter."
                : "Required before accepting the offer."
            }
            onSatisfiedChange={(ok) => setChargeOk(ok)}
          />

          <div>
            <Label>Acceptance notes (optional)</Label>
            <Textarea
              className="mt-1"
              value={acceptanceNotes}
              onChange={(e) => setAcceptanceNotes(e.target.value)}
              placeholder="e.g. Accepted by phone / in person"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={loading || !chargeOk}
            onClick={() => void handleAccept()}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm acceptance
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
