
// app/contexts/CurrentSchoolContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "@/utils/api";

interface School {
  id: string;
  name: string;
  short_name?: string;
  logo?: string | null;
  // modules: number[] | string[];
  modules: Array<{
    id: number;
    name: string;
    code: string;  // ← make it required (non-optional)
  }>;
  // Add more fields as needed (currency, setup_complete, etc.)
}

interface CurrentSchoolContextType {
  currentSchool: School | null;
  setCurrentSchool: (school: School | null) => void;
  schools: School[];
  loading: boolean;
  error: string | null;
  refreshSchools: () => Promise<void>; // For manual refresh
}

const CurrentSchoolContext = createContext<CurrentSchoolContextType | undefined>(undefined);

export function CurrentSchoolProvider({ children }: { children: ReactNode }) {
  const [schools, setSchools] = useState<School[]>([]);
  const [currentSchool, setCurrentSchoolState] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch schools on mount
  useEffect(() => {
    const fetchSchools = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use your actual endpoint (adjust if needed)
        const res = await api.get("/schools/"); // or /schools/my-schools/ or /schools/active-user-schools/
        const fetchedSchools: School[] = res.data; // assuming array response

        setSchools(fetchedSchools);

        // Auto-select logic
        if (fetchedSchools.length > 0) {
          const savedId = localStorage.getItem("currentSchoolId");
          const selected = savedId
            ? fetchedSchools.find((s) => s.id === savedId) || fetchedSchools[0]
            : fetchedSchools[0];

          setCurrentSchoolState(selected);
          localStorage.setItem("currentSchoolId", selected.id);
        } else {
          setCurrentSchoolState(null);
          localStorage.removeItem("currentSchoolId");
        }
      } catch (err: any) {
        console.error("Failed to load schools:", err);
        setError("Could not load your schools. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchSchools();

    // Optional: Listen for auth changes (if you have auth events)
    // window.addEventListener("authChange", fetchSchools); // example

    // Cleanup (optional)
    return () => {
      // window.removeEventListener("authChange", fetchSchools);
    };
  }, []);

  // Custom setter with persistence
  const setCurrentSchool = (school: School | null) => {
    setCurrentSchoolState(school);
    if (school) {
      localStorage.setItem("currentSchoolId", school.id);
    } else {
      localStorage.removeItem("currentSchoolId");
    }
  };

  // Manual refresh function (useful after creating new school, etc.)
  const refreshSchools = async () => {
    setLoading(true);
    try {
      const res = await api.get("/schools/");
      const fetched = res.data;
      setSchools(fetched);

      // Re-apply selection logic
      if (fetched.length > 0) {
        const savedId = localStorage.getItem("currentSchoolId");
        const selected = savedId
          ? fetched.find((s: School) => s.id === savedId) || fetched[0]
          : fetched[0];
        setCurrentSchool(selected);
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

export function useCurrentSchool() {
  const context = useContext(CurrentSchoolContext);
  if (!context) {
    throw new Error("useCurrentSchool must be used within CurrentSchoolProvider");
  }
  return context;
}