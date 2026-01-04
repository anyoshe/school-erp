"use client";

import { useState } from "react";
import { useStudents } from "./hooks/useStudents";
import StudentTable from "./components/StudentTable";
import StudentForm from "./components/StudentForm";
import { studentService } from "./services/studentService";
import { Student } from "./types/student";

export default function StudentsPage() {
  const { students, loading, refresh } = useStudents();
  const [editing, setEditing] = useState<Student | null>(null);
  const [open, setOpen] = useState(false);

  const handleDelete = async (id: string) => {
    if (!id) return;
    await studentService.remove(id);
    refresh();
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="space-y-6">
      <button onClick={() => setOpen(true)} className="btn-primary">Add Student</button>

      <StudentTable
        students={students}
        onEdit={(s) => { setEditing(s); setOpen(true); }}
        onDelete={handleDelete}
      />

      {open && (
        <div className="modal">
          <StudentForm
            student={editing ?? undefined}
            onClose={() => { setOpen(false); setEditing(null); }}
            onSaved={refresh}
          />
        </div>
      )}
    </div>
  );
}
