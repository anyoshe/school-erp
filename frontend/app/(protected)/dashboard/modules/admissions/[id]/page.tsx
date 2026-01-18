// app/(protected)/dashboard/modules/admissions/[id]/page.tsx
"use client";

import { use } from "react"; // For unwrapping params Promise
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/utils/api";
import ApplicationForm from "../components/ApplicationForm";
import AdmissionActions from "../components/AdmissionActions";
import { Application } from "@/types/admission";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); // Unwrap Promise safely
  const isNew = id === "new";
  const router = useRouter();

  const { currentSchool, loading: schoolLoading, error: schoolError } = useCurrentSchool();

  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !id) return;

    if (schoolLoading) return;
    if (!currentSchool) {
      setError("No school selected. Please select a school first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    api
      .get<Application>(`/admissions/applications/${id}/`)
      .then((res) => {
        // Optional: validate school match (extra safety)
        if (res.data.school !== currentSchool.id) {
          throw new Error("Application belongs to a different school.");
        }
        setApplication(res.data);
      })
      .catch((err) => {
        console.error(err);
        setError(err.response?.data?.detail || "Failed to load application.");
        toast.error("Could not load application", {
          description: err.response?.data?.detail || "Network or permission issue",
        });
      })
      .finally(() => setLoading(false));
  }, [id, isNew, currentSchool, schoolLoading]);

  const refreshApplication = async () => {
    if (!id || isNew) return;
    try {
      const res = await api.get<Application>(`/admissions/applications/${id}/`);
      setApplication(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (formData: globalThis.FormData) => {
    if (!currentSchool) {
      toast.error("No school selected");
      return;
    }

    try {
      if (isNew) {
        const res = await api.post<Application>("/admissions/applications/", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Application created!");
        router.push(`/dashboard/modules/admissions/${res.data.id}`);
      } else {
        await api.patch<Application>(`/admissions/applications/${id}/`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Application updated!");
        await refreshApplication();
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Submission failed", {
        description: err.response?.data?.detail || "Unknown error",
      });
    }
  };

  // Loading / error states
  if (schoolLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (schoolError || error || !currentSchool) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">
            {error || schoolError || "No school selected. Please go back and select a school."}
          </p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const canEnroll =
    !isNew &&
    application?.status === "ACCEPTED" &&
    (application?.fee_payments?.length ?? 0) > 0 &&
    !application?.student;

  return (
    <div className="min-h-screen bg-gray-50/50 py-6 lg:py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {isNew ? "New Application" : `Application ${application?.admission_number || id}`}
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                {isNew ? "Create a new admission application" : "View and update this application"}
              </p>
            </div>

            <div className="text-sm text-gray-500 bg-white px-4 py-2 rounded-lg border shadow-sm">
              School: <span className="font-medium">{currentSchool.name}</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 lg:p-8">
            <ApplicationForm
              initialData={application || {}}
              onSubmit={handleSubmit}
              school={currentSchool}
            />

            {!isNew && application && (
              <div className="mt-10 border-t pt-8">
                <AdmissionActions
                  applicationId={id}
                  status={application.status}
                  onUpdated={refreshApplication}
                  onEnrolled={(student) => {
                    toast.success("Student enrolled successfully!");
                    router.push(`/dashboard/modules/students/${student.id}`);
                  }}
                />
              </div>
            )}

            {application?.student && (
              <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-lg font-medium text-green-800">
                  Already enrolled as student:{" "}
                  <span className="font-bold">{application.student.id}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}