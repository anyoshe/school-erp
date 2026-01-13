// app/contexts/CurrentSchoolContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "@/utils/api";

export interface Module {
  id: number;
  name: string;
  code: string;
}

export interface School {
  id: string;
  owner: string;
  name: string;
  short_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
  currency?: string;
  academic_year_start_month?: number;
  academic_year_end_month?: number;
  term_system?: string;
  number_of_terms?: number;
  grading_system?: string;
  passing_mark?: number;
  official_registration_number?: string;
  registration_authority?: string;
  registration_date?: string;
  logo?: string | null;
  module_ids?: number[];
  modules: Module[];
  setup_complete?: boolean;
}

interface CurrentSchoolContextType {
  currentSchool: School | null;
  setCurrentSchool: (school: School | null) => void;
  schools: School[];
  loading: boolean;
  error: string | null;
  refreshSchools: () => Promise<void>;
}

const CurrentSchoolContext = createContext<CurrentSchoolContextType | undefined>(undefined);

export function CurrentSchoolProvider({ children }: { children: ReactNode }) {
  const [schools, setSchools] = useState<School[]>([]);
  const [currentSchool, setCurrentSchoolState] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch schools and current school on mount
  useEffect(() => {
    const fetchSchools = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1️⃣ Fetch all schools for the user
        const res = await api.get("/schools/my-schools/");
        const fetchedSchools: School[] = res.data;
        setSchools(fetchedSchools);

        if (fetchedSchools.length > 0) {
          // 2️⃣ Determine saved or first school
          const savedId = localStorage.getItem("currentSchoolId");
          const selected =
            (savedId && fetchedSchools.find((s) => s.id === savedId)) ||
            fetchedSchools[0];

          if (selected) {
            // 3️⃣ Fetch full details for selected school
            const detailRes = await api.get(`/schools/${selected.id}/`);
            setCurrentSchoolState(detailRes.data);
            localStorage.setItem("currentSchoolId", selected.id);
          }
        } else {
          setCurrentSchoolState(null);
          localStorage.removeItem("currentSchoolId");
        }
      } catch (err) {
        console.error("Failed to load schools:", err);
        setError("Could not load your schools. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchSchools();
  }, []);

  // Custom setter for current school (with persistence)
  const setCurrentSchool = (school: School | null) => {
    setCurrentSchoolState(school);
    if (school) {
      localStorage.setItem("currentSchoolId", school.id);
    } else {
      localStorage.removeItem("currentSchoolId");
    }
  };

  // Manual refresh
  const refreshSchools = async () => {
    setLoading(true);
    try {
      const res = await api.get("/schools/my-schools/");
      const fetchedSchools: School[] = res.data;
      setSchools(fetchedSchools);

      if (fetchedSchools.length > 0) {
        const savedId = localStorage.getItem("currentSchoolId");
        const selected =
          (savedId && fetchedSchools.find((s) => s.id === savedId)) || fetchedSchools[0];

        if (selected) {
          const detailRes = await api.get(`/schools/${selected.id}/`);
          setCurrentSchoolState(detailRes.data);
          localStorage.setItem("currentSchoolId", selected.id);
        }
      } else {
        setCurrentSchoolState(null);
        localStorage.removeItem("currentSchoolId");
      }
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CurrentSchoolContext.Provider
      value={{
        currentSchool,
        setCurrentSchool,
        schools,
        loading,
        error,
        refreshSchools,
      }}
    >
      {children}
    </CurrentSchoolContext.Provider>
  );
}

// Hook for consuming the context
export function useCurrentSchool() {
  const context = useContext(CurrentSchoolContext);
  if (!context) {
    throw new Error("useCurrentSchool must be used within CurrentSchoolProvider");
  }
  return context;
}
