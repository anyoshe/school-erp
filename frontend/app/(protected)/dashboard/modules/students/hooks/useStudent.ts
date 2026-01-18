"use client";

import { useCallback, useEffect, useState } from "react";
import { Student } from "../types/student";
import { studentService } from "../services/studentService";

export function useStudent(studentId: string) {
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStudent = useCallback(async () => {
    if (!studentId) return;

    setIsLoading(true);
    try {
      const s = await studentService.getById(studentId);

      setStudent({
        id: s.id,
        admission_number: s.admission_number,
        upi_number: s.upi_number,
        nemis_id: s.nemis_id,
        first_name: s.first_name,
        middle_name: s.middle_name,
        last_name: s.last_name,
        full_name: s.full_name,
        gender: s.gender,
        date_of_birth: s.date_of_birth,
        nationality: s.nationality,
        county: s.county,
        sub_county: s.sub_county,
        religion: s.religion,
        photo: s.photo,
        current_class: s.current_class,
        stream: s.stream,
        boarding_status: s.boarding_status,
        special_needs: s.special_needs,
        admission_date: s.admission_date,
        graduation_date: s.graduation_date,
        fee_balance: s.fee_balance,
        scholarship: s.scholarship,
        bursary_amount: s.bursary_amount,
        status: s.status,
        notes: s.notes,
        created_at: s.created_at,
        updated_at: s.updated_at,
      });
    } catch (err) {
      console.error("Failed to load student", err);
      setStudent(null);
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) {
      fetchStudent();
    }
  }, [studentId, fetchStudent]);

  return {
    student,
    isLoading,
    refetch: fetchStudent,
  };
}
