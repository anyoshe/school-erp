// modules/admissions/components/InterviewScheduleModal.tsx
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, MessageSquare, Mail, Phone } from "lucide-react";
import { Application } from "@/types/admission";

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
  const [loading, setLoading] = useState(false);
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
      const payload = {
        status: "TEST_SCHEDULED",
        interview_date: form.date,
        interview_time: form.time,
        interview_venue: form.venue,
        interview_contact_person: form.contact_person,
        interview_instructions: form.instructions,
      };

      await api.patch(`/admissions/applications/${applicationId}/`, payload);

      const sentMethods: string[] = [];

      if (applicationData.primary_guardian_phone) sentMethods.push("SMS");
      if (applicationData.primary_guardian_phone) sentMethods.push("WhatsApp");
      if (applicationData.primary_guardian_email) sentMethods.push("Email");

      toast.success(
        `Interview scheduled successfully!${
          sentMethods.length ? ` Notification prepared for ${sentMethods.join(", ")}` : ""
        }`
      );

      onScheduled?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to schedule interview");
    } finally {
      setLoading(false);
    }
  };

  const generateMessage = () => {
    const { date, time, venue, contact_person, instructions } = form;
    const studentName = `${applicationData.first_name} ${applicationData.last_name}`;

    return `
Dear Guardian,

An admission interview for ${studentName} has been scheduled.

Date: ${date}
Time: ${time}
Venue: ${venue}
Contact Person: ${contact_person}

Instructions / What to bring:
${instructions}

We look forward to meeting you.

Best regards,
${contact_person}
Admissions Team
    `.trim();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={`
          sm:max-w-lg 
          max-h-[90vh] 
          overflow-y-auto 
          rounded-2xl 
          p-6 sm:p-8
          scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100
        `}
      >
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-semibold">Schedule Admission Interview</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Set date, time, and instructions for the interview.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          {/* Pre-filled applicant summary */}
          <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
            <h4 className="font-medium text-gray-800 mb-3">Applicant Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 block">Name</span>
                <p className="font-medium mt-0.5">
                  {applicationData.first_name} {applicationData.last_name}
                </p>
              </div>
              <div>
                <span className="text-gray-500 block">Guardian</span>
                <p className="font-medium mt-0.5">{applicationData.primary_guardian_name || "—"}</p>
              </div>
              <div>
                <span className="text-gray-500 block">Phone</span>
                <p className="font-medium mt-0.5">{applicationData.primary_guardian_phone || "—"}</p>
              </div>
              <div>
                <span className="text-gray-500 block">Email</span>
                <p className="font-medium mt-0.5 break-all">{applicationData.primary_guardian_email || "—"}</p>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <span className="text-gray-500 block">Class Applied</span>
                <p className="font-medium mt-0.5">{applicationData.class_applied?.name || "—"}</p>
              </div>
            </div>
          </div>

          {/* Form inputs */}
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="rounded-lg"
                />
              </div>
              <div>
                <Label>Time *</Label>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="rounded-lg"
                />
              </div>
            </div>

            <div>
              <Label>Venue / Platform</Label>
              <Input
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                placeholder="Administration Block - Room 3 or Zoom link"
                className="rounded-lg"
              />
            </div>

            <div>
              <Label>Contact Person</Label>
              <Input
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                placeholder="Admissions Officer / Headteacher"
                className="rounded-lg"
              />
            </div>

            <div>
              <Label>Instructions / What to Bring</Label>
              <Textarea
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                placeholder="Bring birth certificate, previous report card, passport photos..."
                className="min-h-[120px] rounded-lg resize-y"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3 pt-4 border-t">
          <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-center sm:justify-start">
            <Button
              variant="outline"
              size="sm"
              disabled={!applicationData.primary_guardian_phone || loading}
              onClick={() => {
                toast.success("SMS invitation sent! (placeholder)");
              }}
              className="flex-1 sm:flex-none"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              SMS
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!applicationData.primary_guardian_phone || loading}
              onClick={() => {
                const msg = encodeURIComponent(generateMessage());
                window.open(`https://wa.me/${applicationData.primary_guardian_phone}?text=${msg}`, "_blank");
                toast.success("WhatsApp opened with invitation");
              }}
              className="flex-1 sm:flex-none"
            >
              <Phone className="mr-2 h-4 w-4" />
              WhatsApp
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!applicationData.primary_guardian_email || loading}
              onClick={() => {
                const subject = encodeURIComponent("Admission Interview Invitation");
                const body = encodeURIComponent(generateMessage());
                window.open(`mailto:${applicationData.primary_guardian_email}?subject=${subject}&body=${body}`);
                toast.success("Email composer opened");
              }}
              className="flex-1 sm:flex-none"
            >
              <Mail className="mr-2 h-4 w-4" />
              Email
            </Button>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading || !form.date || !form.time}
            className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto min-w-[160px]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Schedule & Notify
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}