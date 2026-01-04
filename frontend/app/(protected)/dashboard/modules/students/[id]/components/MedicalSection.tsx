// "use client";

// import { useMedicalRecords } from "../medical/useMedicalRecords";
// import MedicalTable from "../medical/MedicalTable";
// import MedicalForm from "../medical/MedicalForm";
// import { useState } from "react";

// export default function MedicalSection({ studentId }: { studentId: string }) {
//   const { records, loading, refresh } = useMedicalRecords(studentId);
//   const [editing, setEditing] = useState<any>(null);

//   const handleDelete = async (id: string) => {
//     await fetch(`/api/medical-records/${id}/`, { method: "DELETE" });
//     refresh();
//   };

//   if (loading) return <p>Loading medical records...</p>;

//   return (
//     <div className="space-y-4">
//       <MedicalForm studentId={studentId} record={editing} onSaved={refresh} onClose={() => setEditing(null)} />
//       <MedicalTable records={records} onEdit={setEditing} onDelete={handleDelete} />
//     </div>
//   );
// }

"use client";

import { useMedicalRecords } from "../medical/useMedicalRecords";
import MedicalTable from "../medical/MedicalTable";
import MedicalForm from "../medical/MedicalForm";
import { useState } from "react";

interface Props {
  studentId: string;
}

export default function MedicalSection({ studentId }: Props) {
  const { records, loading, refresh } = useMedicalRecords(studentId);
  const [editing, setEditing] = useState<any>(null);

  const handleDelete = async (id: string) => {
    await fetch(`/api/medical-records/${id}/`, { method: "DELETE" });
    refresh();
  };

  if (loading) return <p>Loading medical records...</p>;

  return (
    <div className="space-y-4">
      <MedicalForm studentId={studentId} record={editing} onSaved={refresh} onClose={() => setEditing(null)} />
      <MedicalTable records={records} onEdit={setEditing} onDelete={handleDelete} />
    </div>
  );
}
