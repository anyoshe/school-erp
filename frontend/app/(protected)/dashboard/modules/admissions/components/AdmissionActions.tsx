"use client";

import { useState } from "react";
import api from "@/utils/api";

interface Props {
  applicationId: string;
  status?: string;
  onUpdated?: () => void; // Called after status change or enroll to refresh parent
  onEnrolled?: (student: { id: string; admission_number?: string; full_name?: string }) => void;
}

export default function AdmissionActions({ applicationId, status, onUpdated, onEnrolled }: Props) {
  const [loading, setLoading] = useState(false);

  const updateStatus = async (newStatus: string) => {
    if (!confirm(`Set application status to "${newStatus}"?`)) return;
    try {
      setLoading(true);
      await api.patch(`/admissions/applications/${applicationId}/`, { status: newStatus });
      onUpdated?.();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!confirm("Proceed to enroll this applicant as a student?")) return;
    try {
      setLoading(true);
      const res = await api.post(`/admissions/applications/${applicationId}/enroll/`);
      onEnrolled?.(res.data);
      onUpdated?.();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || "Enrollment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-3 md:items-center">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => updateStatus("INTERVIEW")}
          disabled={loading}
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded"
        >
          Mark Interviewed
        </button>

        <button
          onClick={() => updateStatus("OFFERED")}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Send Offer
        </button>

        <button
          onClick={() => updateStatus("ACCEPTED")}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
        >
          Accept Offer
        </button>

        <button
          onClick={() => updateStatus("ADMITTED")}
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded"
        >
          Mark Admitted
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleEnroll}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
        >
          Enroll as Student
        </button>

        <button
          onClick={() => updateStatus("DIRECT_ENROLLED")}
          disabled={loading}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
        >
          Direct Enroll (Govt Placement)
        </button>
      </div>
    </div>
  );
}
