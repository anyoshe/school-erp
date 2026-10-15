// components/SchoolSwitcher.tsx
"use client";

import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";

export default function SchoolSwitcher() {
  const { currentSchool, setCurrentSchool, schools } = useCurrentSchool();
  const schoolList = Array.isArray(schools) ? schools : [];

  // Never flash "Loading schools" — hide until we know there are multiple schools
  if (schoolList.length <= 1) return null;

  return (
    <select
      value={currentSchool?.id || ""}
      onChange={(e) => {
        const school = schoolList.find((s) => s.id === e.target.value);
        if (school) setCurrentSchool(school);
      }}
      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      suppressHydrationWarning
    >
      {schoolList.map((school) => (
        <option key={school.id} value={school.id}>
          {school.name}
        </option>
      ))}
    </select>
  );
}
