"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import api from "@/utils/api";
import StudentEnrollmentForm from "@/(protected)/dashboard/modules/admissions/components/StudentEnrollmentForm";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { toast } from "sonner";

export default function StudentEnrollPage() {
  const router = useRouter();
  const { currentSchool } = useCurrentSchool();

  const enrollStudent = useMutation({
    mutationFn: async (formData: FormData) => {
      formData.set("status", "ACCEPTED");
      formData.set("admission_date", new Date().toISOString().split("T")[0]);
      formData.set("school", String(currentSchool?.id));

      const appRes = await api.post(
        "/admissions/applications/",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const enrollRes = await api.post(
        `/admissions/applications/${appRes.data.id}/enroll/`
      );

      return enrollRes.data;
    },
    onSuccess: (data) => {
      toast.success("Student enrolled");
      router.push(`/dashboard/modules/students/${data.student_id}`);
    },
  });

  return (
    <StudentEnrollmentForm
      initialData={{}}
      isDirectEnroll={true}
      school={currentSchool}
      onSubmit={(fd) => enrollStudent.mutate(fd)}
    />
  );
}
