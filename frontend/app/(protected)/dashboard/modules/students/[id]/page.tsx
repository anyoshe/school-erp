// "use client";

// import { useParams } from "next/navigation";
// import { useStudent } from "../hooks/useStudent";
// import StudentTabs from "./components/StudentTabs";

// export default function StudentProfilePage() {
//   const { id } = useParams<{ id: string }>();
//   const { student, loading } = useStudent(id as string);

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-indigo-900 mb-6"></div>
//           <h2 className="text-2xl font-bold text-slate-800">Loading Profile...</h2>
//         </div>
//       </div>
//     );
//   }

//   if (!student) {
//     return (
//       <div className="min-h-screen flex items-center justify-center">
//         <div className="text-center">
//           <div className="text-8xl mb-8">🎓</div>
//           <h1 className="text-4xl font-bold text-slate-800 mb-4">Student Not Found</h1>
//           <a href="/dashboard/students" className="btn-primary text-lg py-4 px-8">
//             ← Back to Students
//           </a>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
//       {/* Hero Header */}
//       <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white shadow-2xl">
//         <div className="max-w-7xl mx-auto px-6 py-12 text-center">
//           <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-4">
//             {student.firstName} {student.lastName}
//           </h1>
//           <p className="text-2xl font-bold text-indigo-100">
//             Admission No: {student.admissionNo}
//           </p>
//           <p className="text-xl text-indigo-200 mt-2">
//             {student.className ? `Class ${student.className}` : "Class not assigned"} • {student.status}
//           </p>
//         </div>
//       </div>

//       {/* Full Tabs + Content */}
//       <div className="max-w-7xl mx-auto px-4 -mt-8 pb-20">
//         <StudentTabs studentId={student.id} />
//       </div>
//     </div>
//   );
// }