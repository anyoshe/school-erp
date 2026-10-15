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
  Calendar,
  ChevronRight,
  Ban,
  Phone,
  Users,
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
import AcceptOfferModal from "./AcceptOfferModal";
import EnrollmentWizardModal from "./EnrollmentWizardModal"; // ← import the wizard
import Link from "next/link";

interface Props {
  applicationId: string;
  currentStatus: string;
  applicationData: Application;
  onUpdated?: () => void;
  onEnrolled?: (student: { id: string; full_name?: string }) => void;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  TEST_SCHEDULED: "Interview Scheduled",
  INTERVIEW_COMPLETED: "Interview Done",
  OFFERED: "Offer Issued",
  ACCEPTED: "Offer Accepted",
  REJECTED: "Rejected",
  ENROLLED: "Enrolled",
};

/** Main happy-path pipeline shown to staff */
const PIPELINE = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "OFFERED",
  "ACCEPTED",
  "ENROLLED",
] as const;

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-primary-100 text-primary-900 border-primary-200",
  UNDER_REVIEW: "bg-primary-100 text-primary-800 border-primary-200",
  TEST_SCHEDULED: "bg-amber-100 text-amber-800 border-amber-200",
  OFFERED: "bg-primary-100 text-primary-800 border-primary-200",
  ACCEPTED: "bg-secondary-100 text-secondary-800 border-secondary-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  ENROLLED: "bg-secondary-100 text-secondary-800 border-secondary-200 animate-pulse",
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
  const [isAcceptOfferOpen, setIsAcceptOfferOpen] = useState(false);
  const [isEnrollmentWizardOpen, setIsEnrollmentWizardOpen] = useState(false);
  const [enrolledStudent, setEnrolledStudent] = useState<{ id: string; full_name?: string } | null>(null);

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

If you have any questions, please contact the admissions office.

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
            className="flex-1 h-12 bg-primary hover:bg-primary-700 text-white rounded-xl shadow-lg"
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

    if (status === "TEST_SCHEDULED") {
      return (
        <Button
          onClick={() => setIsInterviewDoneOpen(true)}
          className="w-full h-12 bg-secondary hover:bg-secondary-700 text-white rounded-xl shadow-lg"
        >
          <CheckCircle2 className="mr-2 h-5 w-5" />
          Mark Interview Done
        </Button>
      );
    }

    if (status === "INTERVIEW_COMPLETED" && applicationData.interview_outcome === "PASS") {
      return (
        <Button
          onClick={() => setIsOfferLetterOpen(true)}
          className="w-full h-12 bg-primary hover:bg-primary-700 text-white rounded-xl shadow-lg animate-pulse"
        >
          <FileText className="mr-2 h-5 w-5" />
          Issue Admission Offer
        </Button>
      );
    }

    if (status === "OFFERED") {
      return (
        <Button
          onClick={() => setIsAcceptOfferOpen(true)}
          className="w-full h-12 bg-primary hover:bg-primary-700 text-white rounded-xl shadow-lg animate-pulse"
        >
          <CheckCircle2 className="mr-2 h-5 w-5" />
          Mark Offer Accepted
        </Button>
      );
    }

    // This is the key part: Open the wizard instead of direct enroll
    if (status === "ACCEPTED") {
      return (
        <Button
          disabled={!!loading}
          onClick={() => setIsEnrollmentWizardOpen(true)}
          className="w-full h-12 bg-gradient-to-r from-primary-600 to-primary-800 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl shadow-xl animate-pulse"
        >
          {loading ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <UserPlus className="mr-2 h-5 w-5" />
          )}
          Finalize Enrollment
        </Button>
      );
    }

    if (status === "ENROLLED") {
      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-center gap-3 py-4 px-6 bg-secondary-50 border border-secondary-200 rounded-2xl">
            <CheckCircle2 className="h-6 w-6 text-secondary-600" />
            <span className="font-semibold text-secondary-800">Student Enrolled Successfully!</span>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {enrolledStudent && (
              <Link href={`/dashboard/modules/students/${enrolledStudent.id}`}>
                <Button variant="default" className="flex-1">
                  <UserPlus className="mr-2 h-4 w-4" />
                  View Student Profile
                </Button>
              </Link>
            )}
            
            <Link href="/dashboard/modules/students">
              <Button variant="outline" className="flex-1">
                <Users className="mr-2 h-4 w-4" />
                View All Students
              </Button>
            </Link>
          </div>
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

  const pipelineIndex = (() => {
    if (status === "DRAFT") return -1;
    if (status === "REJECTED") return -2;
    if (status === "TEST_SCHEDULED" || status === "INTERVIEW_COMPLETED") {
      return PIPELINE.indexOf("UNDER_REVIEW");
    }
    const idx = PIPELINE.indexOf(status as (typeof PIPELINE)[number]);
    return idx;
  })();

  return (
    <div className="w-full space-y-4">
      {/* Visible process — applicant moves left → right until Student is created */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Admissions pipeline
        </p>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {PIPELINE.map((step, i) => {
            const done = pipelineIndex > i || status === "ENROLLED";
            const current = pipelineIndex === i;
            return (
              <div key={step} className="flex items-center min-w-0">
                <div
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] sm:text-xs font-semibold whitespace-nowrap border",
                    done && "bg-secondary-100 text-secondary-800 border-secondary-200",
                    current && "bg-primary text-white border-primary shadow",
                    !done && !current && "bg-stone-50 text-stone-400 border-stone-200"
                  )}
                >
                  {STATUS_LABELS[step] || step}
                </div>
                {i < PIPELINE.length - 1 && (
                  <div className={cn("w-4 h-0.5 mx-0.5", done || current ? "bg-secondary-400" : "bg-stone-200")} />
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          {status === "ENROLLED"
            ? "Student record created — manage them under Students."
            : status === "ACCEPTED"
              ? "Ready to enroll: class placement + optional fee check, then Student is created."
              : "Complete the current step to unlock the next. Enroll creates the Student record."}
        </p>
      </div>

      <div className="mb-1">
        <Badge className={cn("px-4 py-1.5 text-sm font-medium rounded-full", STATUS_COLORS[status] || "bg-slate-100")}>
          {STATUS_LABELS[status] || status.replace("_", " ")}
        </Badge>
      </div>

      <div className="flex flex-col gap-4">
        {renderPrimaryAction()}
      </div>

      {/* All other modals remain unchanged */}
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

      <OfferLetterModal
        open={isOfferLetterOpen}
        onOpenChange={setIsOfferLetterOpen}
        applicationId={applicationId}
        applicationData={applicationData}
        onIssued={() => {
          setTimeout(() => {
            onUpdated?.();
            toast.success("Admission offer letter issued! Status updated to Offered.");
          }, 800);
        }}
      />

      <AcceptOfferModal
        open={isAcceptOfferOpen}
        onOpenChange={setIsAcceptOfferOpen}
        applicationId={applicationId}
        applicationData={applicationData}
        onAccepted={() => {
          onUpdated?.();
          toast.success("Offer accepted successfully!");
        }}
      />

      {/* The new wizard modal */}
      <EnrollmentWizardModal
        open={isEnrollmentWizardOpen}
        onOpenChange={setIsEnrollmentWizardOpen}
        applicationId={applicationId}
        applicationData={applicationData}
        onEnrolled={(student) => {
          setEnrolledStudent(student);
          onEnrolled?.(student);
          onUpdated?.(); // Refresh parent component
        }}
      />
    </div>
  );
}