// frontend/(protected)/dashboard/modules/admissions/direct-enroll/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/utils/api";
import ApplicationForm from "../components/ApplicationForm";
import { toast } from "sonner";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";

interface GradeLevel {
  id: number;
  name: string;
  short_name: string;
  order: number;
}

export default function DirectEnrollPage() {
  // ────────────────────────────────────────────────────────────────
  // ALL HOOKS FIRST – no conditions, no returns before them
  // ────────────────────────────────────────────────────────────────
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentSchool, loading: schoolLoading, error: schoolError } = useCurrentSchool();

  const [submitting, setSubmitting] = useState(false);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(false);

  // Fetch grade levels when school is loaded
  useEffect(() => {
    if (!currentSchool?.id) return;

    const fetchGradeLevels = async () => {
      try {
        setLoadingGrades(true);
        const res = await api.get("/academics/grade-levels/", {
          headers: { "X-School-ID": currentSchool.id },
        });
        setGradeLevels(res.data || []);
      } catch (err) {
        console.error("Failed to load grade levels:", err);
        toast.error("Could not load grade levels for this school");
      } finally {
        setLoadingGrades(false);
      }
    };

    fetchGradeLevels();
  }, [currentSchool?.id]);

  const createStudentMutation = useMutation({
    mutationFn: async (formData: globalThis.FormData) => {
      const data: Record<string, any> = {};
      formData.forEach((value, key) => {
        data[key] = value;
      });

      // Safety: attach school ID (your interceptor probably already does X-School-ID)
      if (currentSchool?.id) {
        data.school_id = currentSchool.id;
      }

      const res = await api.post("/students/students/", data);
      return res.data;
    },
    onSuccess: (newStudent) => {
      toast.success(`Student enrolled successfully at ${currentSchool?.name || "school"}!`);
      queryClient.invalidateQueries({ queryKey: ["students"] });
      router.push(`/dashboard/modules/students/${newStudent.id}`);
    },
    onError: (err: any) => {
      toast.error("Enrollment failed", {
        description: err.response?.data?.detail || "Unknown error",
      });
    },
  });

  const handleDirectSubmit = async (formData: globalThis.FormData) => {
    if (!currentSchool) {
      toast.error("No school selected – cannot enroll");
      return;
    }

    setSubmitting(true);
    try {
      await createStudentMutation.mutateAsync(formData);
    } finally {
      setSubmitting(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Early returns ONLY AFTER all hooks
  // ────────────────────────────────────────────────────────────────
  if (schoolLoading || loadingGrades) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading school information and classes...</p>
        </div>
      </div>
    );
  }

  if (schoolError || !currentSchool) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md text-center">
          <div className="text-red-500 text-6xl mb-6">!</div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-3">Cannot proceed</h2>
          <p className="text-gray-600 mb-6">
            {schoolError || "No school is currently selected."}
            <br />
            Please select a school first.
          </p>
          <Button variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (gradeLevels.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md text-center">
          <div className="text-yellow-500 text-6xl mb-6">⚠</div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-3">No Classes Found</h2>
          <p className="text-gray-600 mb-6">
            {currentSchool.name} does not have any grade levels configured yet.
            <br />
            Please contact the school administrator to set up classes.
          </p>
          <Button variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // Normal render (school is loaded and valid)
  // ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Direct Student Enrollment
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600">
          Enrolling a student directly to <strong>{currentSchool.name}</strong> 
          (Ministry/Government placement). No application process required.
        </p>
      </div>

      {/* Form container */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 lg:p-8">
          <ApplicationForm
            initialData={{}}
            onSubmit={handleDirectSubmit}
            isDirectEnroll={true}
            school={currentSchool}
            gradeLevels={gradeLevels}
          />

          {submitting && (
            <div className="mt-6 text-center text-blue-600 animate-pulse font-medium">
              Enrolling student to {currentSchool.name}... Please wait.
            </div>
          )}
        </div>

        {/* Footer info – school context reminder */}
        <div className="bg-gray-50 border-t px-6 py-4 text-sm text-gray-600">
          <p>
            All enrollment data will be associated with{" "}
            <strong>{currentSchool.name}</strong> ({currentSchool.currency || "KES"}).
          </p>
          {currentSchool.admission_fee && (
            <p className="mt-1">
              Admission fee reference: {currentSchool.currency || "KES"}{" "}
              {Number(currentSchool.admission_fee).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}