"use client";

import { useState } from "react";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  applicationData: Application;
  onAccepted?: () => void;
}

export default function AcceptOfferModal({
  open,
  onOpenChange,
  applicationId,
  applicationData,
  onAccepted,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [acceptanceNotes, setAcceptanceNotes] = useState("");

  const handleAccept = async () => {
    setLoading(true);

    try {
      await api.patch(`/admissions/applications/${applicationId}/`, {
        status: "ACCEPTED",
        acceptance_notes: acceptanceNotes,
        accepted_at: new Date().toISOString(),
      });

      toast.success("Offer marked as accepted!");
      onAccepted?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to accept offer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Mark Offer Accepted</DialogTitle>
          <DialogDescription>
            Confirm that the guardian has accepted the admission offer for {applicationData.first_name} {applicationData.last_name}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div>
            <Label>Acceptance Notes (optional)</Label>
            <Textarea
              value={acceptanceNotes}
              onChange={(e) => setAcceptanceNotes(e.target.value)}
              placeholder="e.g. Parent accepted in person, paid registration fee, etc."
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm Acceptance
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}