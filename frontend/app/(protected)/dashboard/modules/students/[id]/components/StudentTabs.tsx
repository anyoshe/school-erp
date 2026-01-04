"use client";

import { useState } from "react";
import StudentDetails from "./StudentDetails";
import GuardiansSection from "./GuardiansSection";
import MedicalSection from "./MedicalSection";

interface Props {
  studentId: string;
}

export default function StudentTabs({ studentId }: Props) {
  const [tab, setTab] = useState<"details" | "guardians" | "medical">("details");

  return (
    <div className="bg-white rounded-xl shadow">
      {/* Tab Headers */}
      <div className="flex border-b">
        {["details", "guardians", "medical"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`px-6 py-3 ${
              tab === t ? "border-b-2 border-blue-600 font-semibold" : ""
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {tab === "details" && <StudentDetails studentId={studentId} />}
        {tab === "guardians" && <GuardiansSection studentId={studentId} />}
        {tab === "medical" && <MedicalSection studentId={studentId} />}
      </div>
    </div>
  );
}
