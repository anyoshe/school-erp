// frontend/(protected)/dashboard/modules/admissions/components/ApplicationTable.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/utils/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

// Small enroll button that calls the backend enroll endpoint and navigates to student
function EnrollButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleEnroll = async () => {
    if (!confirm("Proceed to enroll this applicant now?")) return;
    try {
      setLoading(true);
      const res = await api.post(`/admissions/applications/${applicationId}/enroll/`);
      const studentId = res.data?.id || res.data?.student_id || res.data?.student?.id;
      if (studentId) {
        router.push(`/dashboard/modules/students/${studentId}`);
      } else {
        // fallback: reload to reflect status
        window.location.reload();
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || "Enrollment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="default"
      size="sm"
      className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm"
      onClick={handleEnroll}
      disabled={loading}
    >
      {loading ? "Enrolling..." : "Enroll Now"}
    </Button>
  );
}

interface Application {
  id: string;
  admission_number?: string;
  first_name: string;
  last_name: string;
  status: string;
  fee_payments?: Array<{ amount: number }>;
  student?: { id: string };
  // Add more fields if needed (e.g., submitted_at, class_applied)
}

interface ApplicationTableProps {
  searchTerm?: string;
  applications?: Application[];
  statusFilter?: string;
}

export default function ApplicationTable({
  searchTerm = "",
  applications: providedApplications,
  statusFilter,
}: ApplicationTableProps) {
  const { data: fetched = [], isLoading, error } = useQuery<Application[]>({
    queryKey: ["applications"],
    queryFn: async () => {
      const res = await api.get("/admissions/applications/");
      return res.data;
    },
    enabled: !providedApplications, // Only fetch if no prop data passed
  });

  const applications = providedApplications ?? fetched;

  const filtered = applications
    .filter((app) => (statusFilter ? app.status === statusFilter : true))
    .filter((app) =>
      searchTerm
        ? `${app.first_name} ${app.last_name}`
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          app.admission_number?.toLowerCase().includes(searchTerm.toLowerCase())
        : true
    );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600 bg-red-50 rounded-lg">
        Error loading applications. Please try again.
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed">
        No applications found matching your filters.
        <br />
        Try adjusting the search or status tab.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Admission #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.map((app) => {
              const isReadyToEnroll =
                app.status === "ACCEPTED" &&
                (app.fee_payments?.length ?? 0) > 0 &&
                !app.student;

              return (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {app.admission_number || "—"}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {app.first_name} {app.last_name}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap hidden sm:table-cell">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant={
                            app.status === "ENROLLED"
                              ? "default"
                              : app.status === "ACCEPTED"
                              ? "secondary"
                              : app.status === "REJECTED"
                              ? "destructive"
                              : app.status === "OFFERED" || app.status === "TEST_SCHEDULED"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {app.status}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {app.status === "ACCEPTED" && isReadyToEnroll
                          ? "Ready to enroll (payments received)"
                          : "Status: " + app.status}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Link
                        href={`/dashboard/modules/admissions/${app.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View / Edit
                      </Link>

                      {isReadyToEnroll && (
                        <EnrollButton applicationId={app.id} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}