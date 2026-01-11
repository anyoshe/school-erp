"use client";

import { StudentGuardianLink } from "./guardian.types";

interface Props {
  links: StudentGuardianLink[];
  onRemove: (linkId: string) => void;
  onEdit?: (link: StudentGuardianLink) => void;
}

export default function GuardianTable({
  links,
  onRemove,
  onEdit,
}: Props) {
  if (links.length === 0) {
    return (
      <div className="text-center py-20 bg-gradient-to-b from-slate-50 to-white rounded-2xl border-2 border-dashed border-slate-300">
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-6">👨‍👩‍👧‍👦</div>
          <h3 className="text-2xl font-semibold text-slate-800 mb-4">
            No Guardians Added
          </h3>
          <p className="text-slate-600">
            Add family members or emergency contacts to complete the student profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white px-8 py-6 rounded-2xl shadow-lg">
        <h3 className="text-2xl font-bold">Guardians & Contacts</h3>
        <p className="text-indigo-200 mt-1">Family members, emergency contacts, and communication preferences</p>
      </div>

      {/* Mobile Cards - Emphasize Name & Contact */}
      <div className="grid gap-6 md:hidden">
        {links.map((link) => {
          const g = link.guardian;
          const contactIcon = link.preferredContactMethod === "PHONE" 
            ? "📞" 
            : link.preferredContactMethod === "EMAIL" 
            ? "✉️" 
            : "💬";

          return (
            <div
              key={link.id}
              className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-2xl transition-all duration-300"
            >
              {/* Card Header - Name & Preferred Contact Prominent */}
              <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white px-6 py-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div>
                    <p className="text-2xl font-bold">{g.fullName}</p>
                    <p className="text-lg opacity-90 capitalize mt-1">
                      {link.relationship.toLowerCase().replace("_", " ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{contactIcon}</span>
                    <span className="text-lg font-semibold">
                      {link.preferredContactMethod === "PHONE" && "Phone Call"}
                      {link.preferredContactMethod === "EMAIL" && "Email"}
                      {link.preferredContactMethod === "SMS" && "SMS/Text"}
                      {!link.preferredContactMethod && "—"}
                    </span>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex gap-3 mt-4">
                  {link.isPrimary && (
                    <span className="px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded-full">
                      Primary Guardian
                    </span>
                  )}
                  {link.isEmergencyContact && (
                    <span className="px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-full">
                      Emergency Contact
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 space-y-5">
                {/* Contact Details */}
                <div className="grid grid-cols-1 gap-4 text-base">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-700">Phone</span>
                    <span className="text-slate-900 font-medium">{g.phone}</span>
                  </div>
                  {g.email && (
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-700">Email</span>
                      <span className="text-slate-900 font-medium">{g.email}</span>
                    </div>
                  )}
                  {g.address && (
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-700">Address</span>
                      <span className="text-slate-900">{g.address}</span>
                    </div>
                  )}
                </div>

                {/* Permissions */}
                {(link.hasPickupPermission || link.hasLegalCustody) && (
                  <div className="pt-5 border-t border-slate-200">
                    <p className="font-semibold text-slate-700 mb-3">Special Permissions</p>
                    <div className="flex flex-wrap gap-3">
                      {link.hasPickupPermission && (
                        <span className="px-5 py-2 bg-emerald-100 text-emerald-800 font-medium rounded-full">
                          Pickup Allowed
                        </span>
                      )}
                      {link.hasLegalCustody && (
                        <span className="px-5 py-2 bg-purple-100 text-purple-800 font-medium rounded-full">
                          Legal Custody
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-4 pt-5 border-t border-slate-200">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(link)}
                      className="flex-1 bg-indigo-900 hover:bg-indigo-800 text-white font-bold py-4 rounded-xl shadow-lg transition transform hover:scale-105"
                    >
                      Edit Guardian
                    </button>
                  )}
                  <button
                    onClick={() => onRemove(link.id)}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl shadow-lg transition transform hover:scale-105"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table - Name & Contact Method Prominent */}
      <div className="hidden md:block overflow-x-auto rounded-2xl shadow-2xl border border-slate-200">
        <table className="w-full min-w-max">
          <thead className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white">
            <tr>
              <th className="px-8 py-6 text-left font-bold text-lg">Guardian Name</th>
              <th className="px-8 py-6 text-left font-bold text-lg">Preferred Contact</th>
              <th className="px-8 py-6 text-left font-bold text-lg">Phone</th>
              <th className="px-8 py-6 text-left font-bold text-lg">Email</th>
              <th className="px-8 py-6 text-left font-bold text-lg">Relationship</th>
              <th className="px-8 py-6 text-left font-bold text-lg">Permissions</th>
              <th className="px-8 py-6 text-right font-bold text-lg">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {links.map((link, idx) => {
              const g = link.guardian;
              const contactIcon = link.preferredContactMethod === "PHONE" 
                ? "📞" 
                : link.preferredContactMethod === "EMAIL" 
                ? "✉️" 
                : "💬";

              return (
                <tr
                  key={link.id}
                  className={`hover:bg-sky-50 transition-all ${
                    idx % 2 === 0 ? "bg-slate-50" : "bg-white"
                  }`}
                >
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <span className="text-xl font-bold text-slate-900">{g.fullName}</span>
                      <div className="flex gap-2">
                        {link.isPrimary && (
                          <span className="px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded-full">
                            Primary
                          </span>
                        )}
                        {link.isEmergencyContact && (
                          <span className="px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-full">
                            Emergency
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{contactIcon}</span>
                      <span className="font-semibold text-slate-800">
                        {link.preferredContactMethod === "PHONE" && "Phone Call"}
                        {link.preferredContactMethod === "EMAIL" && "Email"}
                        {link.preferredContactMethod === "SMS" && "SMS/Text"}
                        {!link.preferredContactMethod && "—"}
                      </span>
                    </div>
                  </td>

                  <td className="px-8 py-6 font-medium text-slate-900">{g.phone}</td>
                  <td className="px-8 py-6 text-slate-700">{g.email || "—"}</td>

                  <td className="px-8 py-6">
                    <span className="capitalize font-medium text-slate-800">
                      {link.relationship.toLowerCase().replace("_", " ")}
                    </span>
                  </td>

                  <td className="px-8 py-6">
                    <div className="flex flex-wrap gap-3">
                      {link.hasPickupPermission && (
                        <span className="px-5 py-2 bg-emerald-100 text-emerald-800 font-medium rounded-full">
                          Pickup
                        </span>
                      )}
                      {link.hasLegalCustody && (
                        <span className="px-5 py-2 bg-purple-100 text-purple-800 font-medium rounded-full">
                          Legal Custody
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-8 py-6 text-right space-x-4">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(link)}
                        className="bg-indigo-900 hover:bg-indigo-800 text-white px-7 py-3 rounded-xl font-bold shadow-lg transition transform hover:scale-105"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => onRemove(link.id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-7 py-3 rounded-xl font-bold shadow-lg transition transform hover:scale-105"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}