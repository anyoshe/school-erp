// "use client";

// import { useState } from "react";
// import { useGuardians } from "../guardians/useGuardians";
// import { guardianService } from "../guardians/guardianService";
// import GuardianForm from "../guardians/GuardianForm";
// import { StudentGuardianLink } from "../guardians/guardian.types";

// export default function GuardiansSection({ studentId }: { studentId: string }) {
//   const { links, refresh, loading } = useGuardians(studentId);
//   const [editingLink, setEditingLink] = useState<StudentGuardianLink | null>(null);

//   const handleRemove = async (linkId: string) => {
//     await guardianService.unlink(linkId);
//     refresh();
//   };

//   if (loading) return <p>Loading guardians...</p>;

//   return (
//     <div className="space-y-6">
//       {/* Show Add Form only if not editing */}
//       {!editingLink && <GuardianForm studentId={studentId} onSaved={refresh} />}

//       {links.length === 0 && (
//         <p className="text-gray-500 italic">No guardians linked to this student</p>
//       )}

//       <div className="space-y-4">
//         {links.map(link => {
//           const g = link.guardian;

//           if (editingLink?.id === link.id) {
//             // Show inline edit form
//             return (
//               <GuardianForm
//                 key={link.id}
//                 studentId={studentId}
//                 existingLink={link}
//                 onSaved={() => {
//                   setEditingLink(null);
//                   refresh();
//                 }}
//                 onCancel={() => setEditingLink(null)}
//               />
//             );
//           }

//           return (
//             <div key={link.id} className="border rounded-xl p-4 bg-white shadow-sm flex justify-between items-start">
//               <div className="space-y-1">
//                 <div className="flex items-center gap-2">
//                   <p className="font-semibold">{g.fullName}</p>
//                   {link.isPrimary && <span className="text-xs bg-blue-100 text-blue-700 px-2 rounded-full">Primary</span>}
//                   {link.isEmergencyContact && <span className="text-xs bg-red-100 text-red-700 px-2 rounded-full">Emergency</span>}
//                 </div>
//                 <p className="text-sm text-gray-600">{link.relationship}</p>
//                 <p className="text-sm text-gray-600">📞 {g.phone}</p>
//                 {g.email && <p className="text-sm text-gray-500">✉️ {g.email}</p>}
//                 {g.address && <p className="text-sm text-gray-500">🏠 {g.address}</p>}
//               </div>

//               <div className="flex flex-col gap-2">
//                 <button onClick={() => setEditingLink(link)} className="text-blue-600 text-sm hover:underline">Edit</button>
//                 <button onClick={() => handleRemove(link.id)} className="text-red-600 text-sm hover:underline">Remove</button>
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }

"use client";

import { useState } from "react";
import { useGuardians } from "../guardians/useGuardians";
import { guardianService } from "../guardians/guardianService";
import GuardianForm from "../guardians/GuardianForm";
import GuardianTable from "../guardians/GuardianTable";
import { StudentGuardianLink } from "../guardians/guardian.types";

export default function GuardiansSection({ studentId }: { studentId: string }) {
  const { links, refresh, loading } = useGuardians(studentId);
  const [editingLink, setEditingLink] = useState<StudentGuardianLink | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleRemove = async (linkId: string) => {
    if (!confirm("Are you sure you want to remove this guardian from the student?")) return;
    await guardianService.unlink(linkId);
    refresh();
  };

  const handleEdit = (link: StudentGuardianLink) => {
    setEditingLink(link);
    setShowAddForm(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAddNew = () => {
    setEditingLink(null);
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingLink(null);
  };

  const handleSaved = () => {
    refresh();
    handleCloseForm();
  };

  const showForm = showAddForm || editingLink !== null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-10">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Guardians & Contacts</h2>
          <p className="mt-2 text-lg text-slate-600">
            Manage family members, emergency contacts, and permissions
          </p>
        </div>

        {/* Add Button */}
        {!showForm && (
          <button
            onClick={handleAddNew}
            className="mt-6 sm:mt-0 inline-flex items-center gap-3 bg-gradient-to-r from-indigo-900 to-indigo-800 hover:from-indigo-800 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-xl shadow-xl transition transform hover:scale-105"
          >
            <span className="text-xl">+</span>
            Add Guardian
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-indigo-900"></div>
        </div>
      )}

      {/* Form (Add or Edit) */}
      {showForm && (
        <div className="mb-12 animate-fadeIn">
          <GuardianForm
            studentId={studentId}
            existingLink={editingLink ?? undefined}
            onSaved={handleSaved}
            onCancel={handleCloseForm}
          />
        </div>
      )}

      {/* Empty State */}
      {!loading && links.length === 0 && !showForm && (
        <div className="text-center py-20 bg-gradient-to-b from-slate-50 to-white rounded-2xl border-2 border-dashed border-slate-300">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-6">👨‍👩‍👧‍👦</div>
            <h3 className="text-2xl font-semibold text-slate-800 mb-4">
              No Guardians Added Yet
            </h3>
            <p className="text-slate-600 mb-8">
              Add parents, guardians, or emergency contacts to keep student information complete and safe.
            </p>
            <button
              onClick={handleAddNew}
              className="bg-gradient-to-r from-indigo-900 to-indigo-800 hover:from-indigo-800 hover:to-indigo-700 text-white font-bold py-4 px-10 rounded-xl shadow-xl transition transform hover:scale-105"
            >
              + Add First Guardian
            </button>
          </div>
        </div>
      )}

      {/* Guardian Table */}
      {!loading && links.length > 0 && (
        <div className="animate-fadeIn">
          <GuardianTable
            links={links}
            onEdit={handleEdit}
            onRemove={handleRemove}
          />
        </div>
      )}
    </div>
  );
}