// // import { useStudent } from "../hooks/useStudent";

// // export default function StudentHeader({ studentId }: { studentId: string }) {
// //   const { student, loading } = useStudent(studentId);

// //   if (loading) return <p>Loading...</p>;
// //   if (!student) return null;

// //   return (
// //     <div className="bg-white p-6 rounded-xl shadow">
// //       <h1 className="text-2xl font-bold">
// //         {student.firstName} {student.lastName}
// //       </h1>
// //       <p className="text-gray-500">
// //         Admission: {student.admissionNo} • {student.status}
// //       </p>
// //     </div>
// //   );
// // }

// "use client";

// import { useStudent } from "../../hooks/useStudent";

// export default function StudentHeader({
//   studentId,
// }: {
//   studentId: string;
// }) {
//   const { student, loading } = useStudent(studentId);

//   if (loading) return <p>Loading student...</p>;
//   if (!student) return <p>Student not found</p>;

//   return (
//     <div className="bg-white p-6 rounded-xl shadow">
//       <h1 className="text-2xl font-bold">
//         {student.firstName} {student.lastName}
//       </h1>
//       <p className="text-gray-600">
//         Admission No: {student.admissionNo}
//       </p>
//       <p className="text-gray-600">
//         Class: {student.className || "—"}
//       </p>
//     </div>
//   );
// }
