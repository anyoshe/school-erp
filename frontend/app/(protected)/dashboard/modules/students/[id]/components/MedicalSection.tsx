// "use client";

// import { useMedicalRecords } from "../medical/useMedicalRecords";
// import MedicalTable from "../medical/MedicalTable";
// import MedicalForm from "../medical/MedicalForm";
// import { useState } from "react";
// import { MedicalRecord } from "../medical/medical.types";
// import { medicalService } from "../medical/medicalService";
// interface Props {
//   studentId: string;
// }

// export default function MedicalSection({ studentId }: Props) {
//   const { records, loading, refresh } = useMedicalRecords(studentId);
//   const [editing, setEditing] = useState<MedicalRecord | null>(null);
//   const [showForm, setShowForm] = useState(false);

//   const handleDelete = async (id: string) => {
//     // await fetch(`/api/medical-records/${id}/`, { method: "DELETE" });
//     await medicalService.deleteRecord(id);

//     refresh();
//   };

//   const handleAdd = () => {
//     setEditing(null);
//     setShowForm(true);
//   };

//   const handleEdit = (record: MedicalRecord) => {
//     setEditing(record);
//     setShowForm(true);
//   };

//   return (
//     <div className="space-y-4">
//       {/* HEADER ACTION — ALWAYS VISIBLE */}
//       <div className="flex justify-between items-center">
//         {/* <h3 className="text-lg font-semibold">Medical Records</h3> */}

//         <button onClick={handleAdd} className="btn-primary">
//           Add Medical Record
//         </button>
//       </div>

//       {/* LOADING INDICATOR — NON-BLOCKING */}
//       {loading && (
//         <p className="text-sm text-gray-500">
//           Loading medical records…
//         </p>
//       )}

//       {/* EMPTY STATE */}
//       {!loading && records.length === 0 && !showForm && (
//         <p className="text-gray-500 italic">
//           No medical records available for this student.
//         </p>
//       )}

//       {/* FORM */}
//       {showForm && (
//         <MedicalForm
//           studentId={studentId}
//           record={editing ?? undefined}
//           onSaved={() => {
//             refresh();
//             setShowForm(false);
//           }}
//           onClose={() => setShowForm(false)}
//         />
//       )}

//       {/* TABLE */}
//       {records.length > 0 && (
//         <MedicalTable
//           records={records}
//           onEdit={handleEdit}
//           onDelete={handleDelete}
//         />
//       )}
//     </div>
//   );
// }

"use client";

import { useState } from "react";
import { useMedicalRecords } from "../medical/useMedicalRecords";
import MedicalTable from "../medical/MedicalTable";
import MedicalForm from "../medical/MedicalForm";
import { MedicalRecord } from "../medical/medical.types";
import { medicalService } from "../medical/medicalService";

interface Props {
  studentId: string;
}

export default function MedicalSection({ studentId }: Props) {
  const { records, loading, refresh } = useMedicalRecords(studentId);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this medical record?")) return;
    await medicalService.deleteRecord(id);
    refresh();
  };

  const handleEdit = (record: MedicalRecord) => {
    setEditingRecord(record);
    setIsAddingNew(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAddNew = () => {
    setEditingRecord(null);
    setIsAddingNew(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCloseForm = () => {
    setIsAddingNew(false);
    setEditingRecord(null);
  };

  const handleSaved = () => {
    refresh();
    handleCloseForm();
  };

  const showForm = isAddingNew || editingRecord !== null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-10">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Medical Records</h2>
          <p className="mt-2 text-lg text-gray-600">Health profile and medical history</p>
        </div>

        {/* Add Button - Always visible unless form is open */}
        {!showForm && (
          <button
            onClick={handleAddNew}
            className="mt-4 sm:mt-0 inline-flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg transition transform hover:scale-105"
          >
            <span className="text-xl">+</span>
            Add Medical Record
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-600"></div>
        </div>
      )}

      {/* Form (Create or Edit) */}
      {showForm && (
        <div className="mb-12 animate-fadeIn">
          <MedicalForm
            studentId={studentId}
            record={editingRecord ?? undefined}
            onSaved={handleSaved}
            onClose={handleCloseForm}
          />
        </div>
      )}

      {/* Empty State */}
      {!loading && records.length === 0 && !showForm && (
        <div className="text-center py-20 bg-gradient-to-b from-gray-50 to-white rounded-2xl border-2 border-dashed border-gray-300">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-6">🩺</div>
            <h3 className="text-2xl font-semibold text-gray-800 mb-3">
              No Medical Records Yet
            </h3>
            <p className="text-gray-600 mb-8">
              Start by adding the student's health information and medical documents.
            </p>
            <button
              onClick={handleAddNew}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition transform hover:scale-105"
            >
              + Add First Record
            </button>
          </div>
        </div>
      )}

      {/* Records Table/List */}
      {!loading && records.length > 0 && (
        <div className="animate-fadeIn">
          <MedicalTable
            records={records}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      )}
    </div>
  );
}