"use client";

import { useCallback, useEffect, useState } from "react";
import { Student } from "../types/student";
import { studentService } from "../services/studentService";

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStudents = useCallback(async (opts?: { background?: boolean }) => {
    const background = !!opts?.background;
    if (background) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setIsError(false);

    try {
      const data = await studentService.getAll();
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[useStudents] Failed to fetch students:", err);
      setIsError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // 1) Paint cached list immediately (no blank wait)
    (async () => {
      try {
        const cached = await studentService.getCached?.();
        if (!cancelled && Array.isArray(cached) && cached.length > 0) {
          setStudents(cached);
          setIsLoading(false);
          // 2) Refresh in background
          fetchStudents({ background: true });
          return;
        }
      } catch {
        /* ignore cache errors */
      }
      if (!cancelled) {
        fetchStudents({ background: false });
      }
    })();

    const handleOnline = () => fetchStudents({ background: true });
    window.addEventListener("online", handleOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
    };
  }, [fetchStudents]);

  return {
    students,
    isLoading,
    isRefreshing,
    isError,
    refetch: () => fetchStudents({ background: students.length > 0 }),
  };
}
