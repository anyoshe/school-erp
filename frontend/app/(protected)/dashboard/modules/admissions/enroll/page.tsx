// "use client";

// import { useState, useEffect } from "react";
// import { useRouter } from "next/navigation";
// import { useMutation, useQueryClient } from "@tanstack/react-query";
// import api from "@/utils/api";
// import ApplicationForm from "../components/ApplicationForm";
// import { toast } from "sonner";
// import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
// import { Button } from "@/components/ui/button";
// import { Alert, AlertDescription } from "@/components/ui/alert";
// import { Info, AlertCircle, Loader, ArrowLeft } from "lucide-react";
// import Link from "next/link";

// // Updated GradeLevel type to match what the form needs
// interface GradeLevel {
//   id: number | string;
//   name: string;
//   short_name?: string;
//   order?: number;
//   education_level?: string;   // PRE_PRIMARY, ELEMENTARY, MIDDLE, HIGH, OTHER
//   pathway?: string;           // GENERAL, STEM, ARTS, VOCATIONAL, OTHER
// }

// export default function DirectEnrollPage() {
//   const router = useRouter();
//   const queryClient = useQueryClient();
//   const { currentSchool, loading: schoolLoading, error: schoolError } = useCurrentSchool();

//   const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
//   const [loadingGrades, setLoadingGrades] = useState(false);

//   // Fetch grade levels on mount
//   useEffect(() => {
//     if (!currentSchool?.id) return;

//     const fetchGradeLevels = async () => {
//       try {
//         setLoadingGrades(true);
//         const res = await api.get("/academics/grade-levels/", {
//           headers: { "X-School-ID": currentSchool.id },
//         });
//         setGradeLevels(res.data || []);
//       } catch (err) {
//         console.error("Failed to load grade levels:", err);
//         toast.error("Could not load available grades/classes");
//       } finally {
//         setLoadingGrades(false);
//       }
//     };

//     fetchGradeLevels();
//   }, [currentSchool?.id]);

//   // Create application and immediately enroll
//   const enrollMutation = useMutation({
//     mutationFn: async (formData: globalThis.FormData) => {
//       // Set status to ACCEPTED for direct enrollment
//       formData.append("status", "ACCEPTED");

//       // Set admission date to today
//       formData.append("admission_date", new Date().toISOString().split("T")[0]);

//       // Add school context
//       if (currentSchool?.id) {
//         formData.append("school", currentSchool.id.toString());
//       }

//       const res = await api.post("/admissions/applications/", formData, {
//         headers: { "Content-Type": "multipart/form-data" },
//       });
//       return res.data;
//     },
//     onSuccess: async (newApplication) => {
//       try {
//         // Call the enroll endpoint to create the student record
//         const enrollRes = await api.post(`/admissions/applications/${newApplication.id}/enroll/`);
//         toast.success(`Student enrolled successfully at ${currentSchool?.name || "the school"}!`);
//         queryClient.invalidateQueries({ queryKey: ["students"] });
//         queryClient.invalidateQueries({ queryKey: ["applications"] });
//         // Redirect to the student detail page
//         router.push(`/dashboard/modules/students/${enrollRes.data.student_id}`);
//       } catch (enrollErr: any) {
//         toast.error("Application created but enrollment failed", {
//           description: enrollErr.response?.data?.detail || "Please try enrolling from the application detail page",
//         });
//         router.push(`/dashboard/modules/admissions/${newApplication.id}`);
//       }
//     },
//     onError: (err: any) => {
//       toast.error("Failed to create enrollment record", {
//         description: err.response?.data?.detail || err.message || "Unknown error",
//       });
//     },
//   });

//   const handleSubmit = async (formData: globalThis.FormData) => {
//     if (!currentSchool) {
//       toast.error("No school selected – cannot enroll");
//       return;
//     }
//     enrollMutation.mutate(formData);
//   };

//   if (schoolLoading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gray-50">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
//           <p className="text-gray-600">Loading school information...</p>
//         </div>
//       </div>
//     );
//   }

//   if (schoolError || !currentSchool) {
//     return (
//       <div className="min-h-screen bg-gray-50 p-6">
//         <div className="max-w-4xl mx-auto">
//           <Link href="/dashboard/modules/admissions">
//             <Button variant="outline" className="mb-6">
//               <ArrowLeft className="h-4 w-4 mr-2" />
//               Back to Applications
//             </Button>
//           </Link>
//           <Alert variant="destructive">
//             <AlertCircle className="h-4 w-4" />
//             <AlertDescription>
//               {schoolError || "No school selected. Please select a school and try again."}
//             </AlertDescription>
//           </Alert>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50 p-6">
//       <div className="max-w-5xl mx-auto">
//         {/* Header */}
//         <div className="mb-6">
//           <Link href="/dashboard/modules/admissions">
//             <Button variant="outline" className="mb-4">
//               <ArrowLeft className="h-4 w-4 mr-2" />
//               Back to Applications
//             </Button>
//           </Link>
//           <h1 className="text-3xl font-bold text-gray-900">Direct Student Enrollment</h1>
//           <p className="text-gray-600 mt-2">
//             Enroll a student directly into the system. Fill out all required information to complete the enrollment.
//           </p>
//         </div>

//         {/* Info Alerts */}
//         <div className="space-y-3 mb-6">
//           <Alert className="bg-green-50 border-green-200">
//             <Info className="h-4 w-4 text-green-600" />
//             <AlertDescription className="text-green-800">
//               <strong>Direct Enrollment:</strong> This will create both an application record and a student record. The student will be immediately enrolled in the system.
//             </AlertDescription>
//           </Alert>

//           {loadingGrades && (
//             <Alert className="bg-amber-50 border-amber-200">
//               <Loader className="h-4 w-4 text-amber-600 animate-spin" />
//               <AlertDescription className="text-amber-800">
//                 Loading available grades/classes...
//               </AlertDescription>
//             </Alert>
//           )}
//         </div>

//         {/* Form */}
//         {!loadingGrades && (
//           <ApplicationForm
//             initialData={{}}
//             onSubmit={handleSubmit}
//             isDirectEnroll={true}
//             school={currentSchool}
//             gradeLevels={gradeLevels}
//           />
//         )}

//         {/* Submission Note */}
//         <div className="mt-8 p-4 bg-gray-100 rounded-lg border border-gray-200">
//           <p className="text-sm text-gray-600">
//             <strong>Important:</strong> All marked fields (*) are required for direct enrollment. 
//             Ensure all student information, guardian details, and health information are accurately filled before submission.
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// }
