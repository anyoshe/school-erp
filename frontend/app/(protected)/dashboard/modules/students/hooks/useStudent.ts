"use client";

import { useEffect, useState } from "react";
import { Student } from "../types/student";
import { studentService } from "../services/studentService";

export function useStudent(studentId: string) {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStudent = async () => {
    setLoading(true);
    try {
      const s = await studentService.getById(studentId);

      setStudent({
        id: s.id,
        admissionNo: s.admission_number,
        firstName: s.first_name,
        lastName: s.last_name,
        gender: s.gender,
        dateOfBirth: s.date_of_birth,
        classId: s.current_class?.id ?? "",
        className: s.current_class?.name ?? "",
        status: s.status,
        createdAt: s.created_at,
      });
    } catch (err) {
      console.error("Failed to load student", err);
      setStudent(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) fetchStudent();
  }, [studentId]);

  return {
    student,
    loading,
    refresh: fetchStudent,
  };
}
