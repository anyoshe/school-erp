"use client";

import { useParams } from "next/navigation";
import { useStudent } from "../hooks/useStudent";
import GuardiansSection from "./components/GuardiansSection";

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { student, loading } = useStudent(id);

  if (loading) return <p>Loading student...</p>;
  if (!student) return <p>Student not found</p>;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold">
          {student.firstName} {student.lastName}
        </h1>
        <p className="text-gray-600">
          Admission No: {student.admissionNo}
        </p>
        <p className="text-gray-600">
          Class: {student.className ?? "—"}
        </p>
      </div>

      {/* Guardians */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold mb-4">Guardians</h2>
        <GuardiansSection studentId={student.id} />
      </div>

      {/* Medical (next) */}
      {/* <MedicalSection studentId={student.id} /> */}
    </div>
  );
}
