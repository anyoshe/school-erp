"use client";

import { useState } from "react";
import api from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Mail,
  CheckCircle2,
  FileText,
  UserPlus,
  XCircle,
  Loader2,
  Zap,
  AlertCircle,
  Calendar,
  ChevronRight,
  ArrowUpRight,
  Ban,
  Phone,
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
import { Badge } from "@/components/ui/badge";
import { Application } from "@/types/admission";
import InterviewScheduleModal from "./InterviewScheduleModal";
import InterviewCompletedModal from "./InterviewCompletedModal";
import OfferLetterModal from "./OfferLetterModal";

interface Props {
  applicationId: string;
  currentStatus: string;
  applicationData: Application;
  onUpdated?: () => void;
  onEnrolled?: (student: { id: string; full_name?: string }) => void;
}

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "New Application",
  UNDER_REVIEW: "Under Review",
  TEST_SCHEDULED: "Interview Scheduled",
  OFFERED: "Offer Issued",
  ACCEPTED: "Offer Accepted",
  REJECTED: "Rejected",
  ENROLLED: "Enrolled",
};

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-800 border-blue-200",
  UNDER_REVIEW: "bg-purple-100 text-purple-800 border-purple-200",
  TEST_SCHEDULED: "bg-amber-100 text-amber-800 border-amber-200",
  OFFERED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  ACCEPTED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  ENROLLED: "bg-green-100 text-green-800 border-green-200 animate-pulse",
};

export default function AdmissionActions({
  applicationId,
  currentStatus,
  applicationData,
  onUpdated,
  onEnrolled,
}: Props) {
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isInterviewDoneOpen, setIsInterviewDoneOpen] = useState(false);
  const [isOfferLetterOpen, setIsOfferLetterOpen] = useState(false);

  const status = currentStatus?.toUpperCase() || "SUBMITTED";

  const isLoading = (key: string) => loading === key;

  const performAction = async (
    action: "status" | "enroll",
    value?: string,
    metadata?: { reason?: string; notes?: string }
  ) => {
    try {
      setLoading(value || action);

      if (action === "status") {
        await api.patch(`/admissions/applications/${applicationId}/`, {
          status: value,
          rejection_reason: metadata?.reason,
          internal_notes: metadata?.notes,
        });

        toast.success(`Status updated to ${STATUS_LABELS[value || ""] || value}`);

        if (value === "REJECTED") {
          const sentMethods: string[] = [];

          if (applicationData.primary_guardian_phone) sentMethods.push("SMS");
          if (applicationData.primary_guardian_phone) sentMethods.push("WhatsApp");
          if (applicationData.primary_guardian_email) sentMethods.push("Email");

          toast.success(
            `Rejection notification prepared for ${sentMethods.join(", ") || "no contact"}`
          );
        }

        setIsRejectOpen(false);
      } else {
        const res = await api.post(`/admissions/applications/${applicationId}/enroll/`);
        onEnrolled?.(res.data);
        toast.success("Student enrolled successfully!", {
          description: "New student record created and added to class.",
        });
      }

      onUpdated?.();
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        "Action failed. Please try again.";
      toast.error(msg);
      console.error("Admission action error:", err);
    } finally {
      setLoading(null);
    }
  };

  const generateRejectionMessage = () => {
    const reasonText =
      rejectReason === "class_full" ? "Class capacity has been reached" :
        rejectReason === "failed_criteria" ? "Application did not meet our admission criteria" :
          rejectReason === "incomplete" ? "Application was incomplete" :
            "Other reason (please contact us for details)";

    const studentName = `${applicationData.first_name} ${applicationData.last_name}`;

    const schoolName =
      typeof applicationData.school === "object" && applicationData.school?.name
        ? applicationData.school.name
        : "our school";

    return `
Dear Guardian,

Thank you for applying to ${schoolName} for ${studentName}.

After careful review, we regret to inform you that we are unable to offer admission at this time.

Reason: ${reasonText}

We appreciate your interest and wish ${studentName} success in future educational opportunities.

If you have any questions, please feel free to contact the admissions office.

Best regards,
Admissions Team
    `.trim();
  };

  const renderPrimaryAction = () => {
    if (["SUBMITTED", "UNDER_REVIEW"].includes(status)) {
      return (
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button
            onClick={() => setIsScheduleOpen(true)}
            className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg"
          >
            <Calendar className="mr-2 h-5 w-5" />
            Schedule Interview
          </Button>

          <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-12 border-red-200 text-red-600 hover:bg-red-50 rounded-xl"
              >
                <Ban className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </DialogTrigger>

            <DialogContent
              className="
                w-[95vw] max-w-[95vw] sm:max-w-md 
                max-h-[90vh] 
                overflow-y-auto 
                overflow-x-hidden 
                rounded-2xl 
                p-5 sm:p-8
                scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100
              "
            >
              <DialogHeader className="mb-4">
                <DialogTitle className="flex items-center gap-2 text-red-700 text-lg sm:text-xl">
                  <Ban className="h-5 w-5" />
                  Reject Application
                </DialogTitle>
                <DialogDescription className="text-red-600/80 text-sm">
                  This action is permanent and cannot be undone.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                <div>
                  <Label className="text-red-700">Rejection Reason *</Label>
                  <Select onValueChange={setRejectReason} value={rejectReason}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="class_full">Class already full</SelectItem>
                      <SelectItem value="failed_criteria">Did not meet admission criteria</SelectItem>
                      <SelectItem value="incomplete">Incomplete application</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Internal Notes (optional)</Label>
                  <Textarea
                    placeholder="For internal records only..."
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    className="min-h-[100px] rounded-xl"
                  />
                </div>
              </div>

              <DialogFooter className="flex flex-col gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsRejectOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>

                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!applicationData.primary_guardian_phone || !!loading}
                    onClick={() => {
                      const msg = encodeURIComponent(generateRejectionMessage());
                      window.open(`https://wa.me/${applicationData.primary_guardian_phone}?text=${msg}`, "_blank");
                      toast.success("WhatsApp rejection message opened");
                    }}
                    className="flex-1"
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    WhatsApp
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!applicationData.primary_guardian_email || !!loading}
                    onClick={() => {
                      const subject = encodeURIComponent("Admission Application Update");
                      const body = encodeURIComponent(generateRejectionMessage());
                      window.open(`mailto:${applicationData.primary_guardian_email}?subject=${subject}&body=${body}`);
                      toast.success("Email composer opened with rejection notice");
                    }}
                    className="flex-1"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                  </Button>

                  <Button
                    variant="destructive"
                    disabled={!rejectReason || !!loading}
                    onClick={() =>
                      performAction("status", "REJECTED", {
                        reason: rejectReason,
                        notes: rejectNotes,
                      })
                    }
                    className="w-full"
                  >
                    {loading ? "Rejecting..." : "Confirm Rejection"}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      );
    }
    // In renderPrimaryAction for TEST_SCHEDULED
    if (status === "TEST_SCHEDULED") {
      return (
        <Button
          onClick={() => setIsInterviewDoneOpen(true)}
          className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg"
        >
          <CheckCircle2 className="mr-2 h-5 w-5" />
          Mark Interview Done
        </Button>
      );
    }

    // In renderPrimaryAction() — add this block after the TEST_SCHEDULED one
    if (status === "INTERVIEW_COMPLETED" && applicationData.interview_outcome === "PASS") {
      return (
        <div className="flex flex-col gap-3 w-full">
          <Button
            onClick={() => setIsOfferLetterOpen(true)}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg animate-pulse"
          >
            <FileText className="mr-2 h-5 w-5" />
            Issue Admission Offer
          </Button>
        </div>
      );
    }

    // 3. Offered → Accepted
    if (status === "OFFERED") {
      return (
        <Button
          disabled={!!isLoading("ACCEPTED")}
          onClick={() => performAction("status", "ACCEPTED")}
          className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg"
        >
          {isLoading("ACCEPTED") ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-5 w-5" />
          )}
          Mark Offer Accepted
        </Button>
      );
    }

    // 4. Accepted → Enroll
    if (status === "ACCEPTED") {
      return (
        <Button
          disabled={!!isLoading("enroll")}
          onClick={() => performAction("enroll")}
          className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-xl animate-pulse"
        >
          {isLoading("enroll") ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <UserPlus className="mr-2 h-5 w-5" />
          )}
          Finalize Enrollment
        </Button>
      );
    }

    // Final states
    if (status === "ENROLLED") {
      return (
        <div className="flex items-center justify-center gap-3 py-4 px-6 bg-green-50 border border-green-200 rounded-2xl">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
          <span className="font-semibold text-green-800">Student Enrolled</span>
        </div>
      );
    }

    if (status === "REJECTED") {
      return (
        <div className="flex items-center justify-center gap-3 py-4 px-6 bg-red-50 border border-red-200 rounded-2xl">
          <Ban className="h-6 w-6 text-red-600" />
          <span className="font-semibold text-red-800">Application Rejected</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <Badge className={cn("px-4 py-1.5 text-sm font-medium rounded-full", STATUS_COLORS[status])}>
          {STATUS_LABELS[status] || status.replace("_", " ")}
        </Badge>
      </div>

      <div className="flex flex-col gap-4">
        {renderPrimaryAction()}
      </div>

      <InterviewScheduleModal
        open={isScheduleOpen}
        onOpenChange={setIsScheduleOpen}
        applicationId={applicationId}
        applicationData={applicationData}
        onScheduled={() => {
          onUpdated?.();
          toast.success("Interview scheduled and status updated");
        }}
      />

      {/* Interview Completed Modal */}
      <InterviewCompletedModal
        open={isInterviewDoneOpen}
        onOpenChange={setIsInterviewDoneOpen}
        applicationId={applicationId}
        applicationData={applicationData}
        onCompleted={() => {
          onUpdated?.();
          toast.success("Interview marked as completed!");
        }}
      />

      {/* // In return JSX — add the new modal at the bottom (after InterviewCompletedModal) */}
      <OfferLetterModal
        open={isOfferLetterOpen}
        onOpenChange={setIsOfferLetterOpen}
        applicationId={applicationId}
        applicationData={applicationData}
        onIssued={() => {
          onUpdated?.();
          toast.success("Admission offer letter issued!");
        }}
      />
    </div>
  );
}