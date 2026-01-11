// "use client";

// import { useState } from "react";
// import StudentSection from "./StudentSection";
// import GuardiansSection from "./GuardiansSection";
// import MedicalSection from "./MedicalSection";

// interface Props {
//   studentId: string;
// }

// export default function StudentTabs({ studentId }: Props) {
//   const [tab, setTab] = useState<"details" | "guardians" | "medical">("details");

//   return (
//     <div className="bg-white rounded-xl shadow">
//       {/* Tab Headers */}
//       <div className="flex border-b">
//         {["details", "guardians", "medical"].map((t) => (
//           <button
//             key={t}
//             onClick={() => setTab(t as any)}
//             className={`px-6 py-3 ${
//               tab === t ? "border-b-2 border-blue-600 font-semibold" : ""
//             }`}
//           >
//             {t.toUpperCase()}
//           </button>
//         ))}
//       </div>

//       {/* Tab Content */}
//       <div className="p-6">
//         {tab === "details" && <StudentSection studentId={studentId} />}
//         {tab === "guardians" && <GuardiansSection studentId={studentId} />}
//         {tab === "medical" && <MedicalSection studentId={studentId} />}
//       </div>
//     </div>
//   );
// }

"use client";

import { useState } from "react";
import StudentSection from "./StudentSection";
import GuardiansSection from "./GuardiansSection";
import MedicalSection from "./MedicalSection";

interface Props {
  studentId: string;
}

export default function StudentTabs({ studentId }: Props) {
  const [activeTab, setActiveTab] = useState<"details" | "guardians" | "medical">("details");

  const tabs = [
    { id: "details", label: "Student Details", icon: "👤" },
    { id: "guardians", label: "Guardians", icon: "👨‍👩‍👧‍👦" },
    { id: "medical", label: "Medical Records", icon: "🩺" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Tab Navigation */}
      <div className="mb-10">
        <div className="flex flex-wrap gap-2 border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 px-8 py-4 font-semibold text-lg transition-all duration-300 border-b-4 -mb-px ${
                activeTab === tab.id
                  ? "border-indigo-900 text-indigo-900 bg-indigo-50"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span className="text-2xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="animate-fadeIn">
        {activeTab === "details" && <StudentSection studentId={studentId} />}
        {activeTab === "guardians" && <GuardiansSection studentId={studentId} />}
        {activeTab === "medical" && <MedicalSection studentId={studentId} />}
      </div>
    </div>
  );
}
