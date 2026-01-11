// "use client";

// import { useState } from "react";
// import { useStudents } from "../hooks/useStudents";
// import StudentTable from "./StudentTable";
// import StudentForm from "./StudentForm";
// import { Student } from "../types/student";
// import { studentService } from "../services/studentService";

// export default function StudentsModule() {
//   const { students, loading, refresh } = useStudents();
//   const [editingStudent, setEditingStudent] = useState<Student | null>(null);
//   const [formOpen, setFormOpen] = useState(false);

//   const openForm = (student?: Student) => {
//     setEditingStudent(student ?? null);
//     setFormOpen(true);
//   };

//   const handleDelete = async (id: string) => {
//     await studentService.remove(id);
//     refresh();
//   };

//   const handleSaved = () => {
//     refresh();
//     setFormOpen(false);
//   };

//   if (loading) return <p>Loading students...</p>;

//   return (
//     <div className="space-y-6">
//       <div className="flex justify-between items-center">
//         <h2 className="text-2xl font-bold">Students</h2>
//         <button
//           onClick={() => openForm()}
//           className="btn-primary"
//         >
//           Add Student
//         </button>
//       </div>

//       <StudentTable
//         students={students}
//         onEdit={(s) => openForm(s)}
//         onDelete={handleDelete}
//       />

//       {formOpen && (
//         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
//           <div className="bg-white p-6 rounded-xl w-96">
//             <StudentForm
//               student={editingStudent ?? undefined}
//               onClose={() => setFormOpen(false)}
//               onSaved={handleSaved}
//             />
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
