// components/SchoolSwitcher.tsx
"use client";

import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";

export default function SchoolSwitcher() {
  const { currentSchool, setCurrentSchool, schools, loading } = useCurrentSchool();

  if (loading) return <div className="text-sm text-gray-500">Loading schools...</div>;
  if (schools.length <= 1) return null; // Hide if only one school

  return (
    <select
      value={currentSchool?.id || ""}
      onChange={(e) => {
        const school = schools.find((s) => s.id === e.target.value);
        if (school) setCurrentSchool(school);
      }}
      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {schools.map((school) => (
        <option key={school.id} value={school.id}>
          {school.name}
        </option>
      ))}
    </select>
  );
}