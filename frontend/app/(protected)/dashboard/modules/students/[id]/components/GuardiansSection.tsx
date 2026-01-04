"use client";

import { useState } from "react";
import { useGuardians } from "../guardians/useGuardians";
import { guardianService } from "../guardians/guardianService";
import GuardianForm from "../guardians/GuardianForm";
import { StudentGuardianLink } from "../guardians/guardian.types";

export default function GuardiansSection({ studentId }: { studentId: string }) {
  const { links, refresh, loading } = useGuardians(studentId);
  const [editingLink, setEditingLink] = useState<StudentGuardianLink | null>(null);

  const handleRemove = async (linkId: string) => {
    await guardianService.unlink(linkId);
    refresh();
  };

  if (loading) return <p>Loading guardians...</p>;

  return (
    <div className="space-y-6">
      {/* Show Add Form only if not editing */}
      {!editingLink && <GuardianForm studentId={studentId} onSaved={refresh} />}

      {links.length === 0 && (
        <p className="text-gray-500 italic">No guardians linked to this student</p>
      )}

      <div className="space-y-4">
        {links.map(link => {
          const g = link.guardian;

          if (editingLink?.id === link.id) {
            // Show inline edit form
            return (
              <GuardianForm
                key={link.id}
                studentId={studentId}
                existingLink={link}
                onSaved={() => {
                  setEditingLink(null);
                  refresh();
                }}
                onCancel={() => setEditingLink(null)}
              />
            );
          }

          return (
            <div key={link.id} className="border rounded-xl p-4 bg-white shadow-sm flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{g.fullName}</p>
                  {link.isPrimary && <span className="text-xs bg-blue-100 text-blue-700 px-2 rounded-full">Primary</span>}
                  {link.isEmergencyContact && <span className="text-xs bg-red-100 text-red-700 px-2 rounded-full">Emergency</span>}
                </div>
                <p className="text-sm text-gray-600">{link.relationship}</p>
                <p className="text-sm text-gray-600">📞 {g.phone}</p>
                {g.email && <p className="text-sm text-gray-500">✉️ {g.email}</p>}
                {g.address && <p className="text-sm text-gray-500">🏠 {g.address}</p>}
              </div>

              <div className="flex flex-col gap-2">
                <button onClick={() => setEditingLink(link)} className="text-blue-600 text-sm hover:underline">Edit</button>
                <button onClick={() => handleRemove(link.id)} className="text-red-600 text-sm hover:underline">Remove</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
