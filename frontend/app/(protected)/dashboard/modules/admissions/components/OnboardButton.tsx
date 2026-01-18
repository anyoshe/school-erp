// components/OnboardButton.tsx
"use client";

import api from "@/utils/api";

interface Props {
  applicationId: string;
  onSuccess: (student: { id: string; admission_number: string; full_name: string }) => void;
}

export default function OnboardButton({ applicationId, onSuccess }: Props) {
  const handleEnroll = async () => {
    try {
      const res = await api.post(`/admissions/applications/${applicationId}/enroll/`);
      onSuccess(res.data); // { student_id, admission_number, student_name }
    } catch (err: any) {
      console.error(err);
      alert("Enrollment failed: " + (err.response?.data?.detail || "Unknown error"));
    }
  };

  return (
    <button
      onClick={handleEnroll}
      className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg"
    >
      Enroll as Student
    </button>
  );
}