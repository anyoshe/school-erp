"use client";

import { useState, useEffect } from "react";

interface Props {
  studentId: string;
}

export default function StudentDetails({ studentId }: Props) {
  const [student, setStudent] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/students/${studentId}`)
      .then((res) => res.json())
      .then((data) => setStudent(data));
  }, [studentId]);

  if (!student) return <p>Loading student details...</p>;

  return (
    <div className="space-y-2">
      <p><strong>Admission No:</strong> {student.admission_number}</p>
      <p><strong>Name:</strong> {student.first_name} {student.last_name}</p>
      <p><strong>Gender:</strong> {student.gender}</p>
      <p><strong>Class:</strong> {student.current_class ?? "N/A"}</p>
      <p><strong>Status:</strong> {student.status}</p>
    </div>
  );
}
