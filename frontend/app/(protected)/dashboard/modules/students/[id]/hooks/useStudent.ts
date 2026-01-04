import { useEffect, useState } from "react";
import { Student } from "../../types/student";

export function useStudent(id: string) {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/students/${id}/`)
      .then(res => res.json())
      .then(s => {
        setStudent({
          id: s.id,
          admissionNo: s.admission_number,
          firstName: s.first_name,
          lastName: s.last_name,
          gender: s.gender,
          classId: s.current_class ?? "",
          status: s.status === "ACTIVE" ? "Active" : "Graduated",
          createdAt: s.created_at,
        });
        setLoading(false);
      });
  }, [id]);

  return { student, loading };
}
