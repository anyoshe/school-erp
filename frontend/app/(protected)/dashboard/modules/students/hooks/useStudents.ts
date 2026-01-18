"use client";

import { useCallback, useEffect, useState } from "react";
import { Student } from "../types/student";
import { studentService } from "../services/studentService";

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);

    try {
      const data = await studentService.getAll();

      // Normalize response - handle both array and paginated response
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.results)
          ? (data as any).results
          : [];

      // Map to Student interface (already in correct format from API)
      const mapped: Student[] = list.map((s: any) => ({
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
        _offline: s._offline ?? false,
      }));

      setStudents(mapped);
    } catch (err) {
      console.error("Failed to load students", err);
      setIsError(true);
      setStudents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();

    const handleOnline = async () => {
      if (studentService.syncPending) {
        await studentService.syncPending();
      }
      fetchStudents();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [fetchStudents]);

  return {
    students,
    isLoading,
    isError,
    refetch: fetchStudents,
  };
}
