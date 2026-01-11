// import { MedicalRecord } from "./medical.types";

// interface Props {
//   records: MedicalRecord[];
//   onEdit: (record: MedicalRecord) => void;
//   onDelete: (id: string) => void;
//   onDownload?: (url: string, filename?: string) => void; // optional download handler
// }

// export default function MedicalTable({ records, onEdit, onDelete, onDownload }: Props) {
//   const handleDownload = (url: string, filename?: string) => {
//     if (onDownload) return onDownload(url, filename);

//     // default browser download
//     const link = document.createElement("a");
//     link.href = url;
//     link.download = filename || "document";
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };

//   return (
//     <div className="space-y-6">
//       {/* HEADER */}
//       <div className="flex items-center justify-between bg-blue-700 text-white px-5 py-3 rounded-xl shadow">
//         <h3 className="text-lg font-semibold">Medical Records</h3>
//         <span className="text-sm opacity-90">Student Health Profile</span>
//       </div>

//       {/* MOBILE VIEW */}
//       <div className="grid gap-4 md:hidden">
//         {records.map((r) => (
//           <div
//             key={r.id}
//             className="bg-white rounded-xl shadow border-l-4 border-blue-600 p-4 space-y-3"
//           >
//             <div className="flex justify-between">
//               <span className="font-semibold text-textMuted">Blood Group:</span>
//               <span className="text-textPrimary">{r.bloodGroup || "—"}</span>
//             </div>
//             <div className="flex justify-between">
//               <span className="font-semibold text-textMuted">Allergies:</span>
//               <span className="text-textPrimary">{r.allergies || "None"}</span>
//             </div>
//             <div className="flex justify-between">
//               <span className="font-semibold text-textMuted">Chronic Conditions:</span>
//               <span className="text-textPrimary">{r.chronicConditions || "None"}</span>
//             </div>
//             <div className="flex justify-between">
//               <span className="font-semibold text-textMuted">Special Needs:</span>
//               <span className="text-textPrimary">{r.specialNeeds || "—"}</span>
//             </div>
//             <div className="flex justify-between">
//               <span className="font-semibold text-textMuted">Medication:</span>
//               <span className="text-textPrimary">{r.medication || "—"}</span>
//             </div>
//             <div className="flex justify-between">
//               <span className="font-semibold text-textMuted">Immunization Status:</span>
//               <span className="text-textPrimary">{r.immunizationStatus || "Not Immunized"}</span>
//             </div>
//             <div className="flex justify-between pt-2 border-t border-gray-200">
//               <span className="text-sm text-textMuted">Last Visit: {r.reviewDate || "—"}</span>
//               <div className="flex flex-col gap-1">
//                 <div className="flex gap-2">
//                   <button
//                     onClick={() => onEdit(r)}
//                     className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-800 transition"
//                   >
//                     Edit
//                   </button>
//                   <button
//                     onClick={() => onDelete(r.id)}
//                     className="bg-red-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-red-700 transition"
//                   >
//                     Delete
//                   </button>
//                 </div>
//                 {/* Download documents */}
//                 {r.documents?.map((doc) => (
//                   <button
//                     key={doc.id}
//                     onClick={() => handleDownload(doc.url, doc.name)}
//                     className="text-blue-700 text-sm underline"
//                   >
//                     Download: {doc.name}
//                   </button>
//                 ))}
//               </div>
//             </div>
//           </div>
//         ))}
//       </div>

//       {/* DESKTOP VIEW */}
//       <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
//         <table className="w-full text-sm table-auto border-collapse">
//           <thead className="bg-blue-700 text-white">
//             <tr>
//               <th className="px-4 py-2 text-left">Blood Group</th>
//               <th className="px-4 py-2 text-left">Allergies</th>
//               <th className="px-4 py-2 text-left">Chronic Conditions</th>
//               <th className="px-4 py-2 text-left">Special Needs</th>
//               <th className="px-4 py-2 text-left">Medication</th>
//               <th className="px-4 py-2 text-left">Immunization</th>
//               <th className="px-4 py-2 text-left">Last Visit</th>
//               <th className="px-4 py-2 text-left">Documents</th>
//               <th className="px-4 py-2 text-right">Actions</th>
//             </tr>
//           </thead>

//           <tbody>
//             {records.map((r, idx) => (
//               <tr
//                 key={r.id}
//                 className={`border-t ${
//                   idx % 2 === 0 ? "bg-gray-50" : "bg-white"
//                 } hover:bg-blue-50 transition`}
//               >
//                 <td className="px-4 py-2">{r.bloodGroup || "—"}</td>
//                 <td className="px-4 py-2">{r.allergies || "None"}</td>
//                 <td className="px-4 py-2">{r.chronicConditions || "None"}</td>
//                 <td className="px-4 py-2">{r.specialNeeds || "—"}</td>
//                 <td className="px-4 py-2">{r.medication || "—"}</td>
//                 <td className="px-4 py-2">{r.immunizationStatus || "Not Immunized"}</td>
//                 <td className="px-4 py-2 text-textMuted">{r.reviewDate || "—"}</td>
//                 <td className="px-4 py-2">
//                   {r.documents?.map((doc) => (
//                     <button
//                       key={doc.id}
//                       onClick={() => handleDownload(doc.url, doc.name)}
//                       className="text-blue-700 text-sm underline block mb-1"
//                     >
//                       {doc.name}
//                     </button>
//                   ))}
//                 </td>
//                 <td className="px-4 py-2 text-right flex gap-2 justify-end">
//                   <button
//                     onClick={() => onEdit(r)}
//                     className="bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-800 transition"
//                   >
//                     Edit
//                   </button>
//                   <button
//                     onClick={() => onDelete(r.id)}
//                     className="bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 transition"
//                   >
//                     Delete
//                   </button>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// }


"use client";

import { MedicalRecord } from "./medical.types";

interface Props {
  records: MedicalRecord[];
  onEdit: (record: MedicalRecord) => void;
  onDelete: (id: string) => void;
  onDownload?: (url: string, filename?: string) => void;
}

export default function MedicalTable({ records, onEdit, onDelete, onDownload }: Props) {
  const handleDownload = (url: string, filename?: string) => {
    if (onDownload) return onDownload(url, filename);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "document";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (records.length === 0) {
    return (
      <div className="text-center py-20 bg-gradient-to-b from-gray-50 to-white rounded-2xl border-2 border-dashed border-gray-300">
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-6">🩺</div>
          <h3 className="text-2xl font-semibold text-gray-800 mb-3">
            No Medical Records
          </h3>
          <p className="text-gray-600">
            No health records have been added for this student yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header - Matching MedicalSection */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white px-8 py-6 rounded-2xl shadow-lg">
        <h3 className="text-2xl font-bold">Medical Records</h3>
        <p className="text-indigo-100 mt-1">Complete health profile and history</p>
      </div>

      {/* Mobile Cards */}
      <div className="grid gap-6 md:hidden">
        {records.map((r) => (
          <div
            key={r.id}
            className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-2xl transition-all duration-300"
          >
            {/* Card Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-6 py-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xl font-bold">{r.bloodGroup || "—"} Blood Group</p>
                  <p className="text-sm opacity-90 mt-1">
                    Last Reviewed: {r.reviewDate || "Never"}
                  </p>
                </div>
                <span
                  className={`px-4 py-2 rounded-full text-sm font-semibold ${r.immunizationStatus === "UP_TO_DATE"
                    ? "bg-green-500 text-white"
                    : r.immunizationStatus === "PARTIAL"
                      ? "bg-amber-500 text-white"
                      : "bg-red-500 text-white"
                    }`}
                >
                  {r.immunizationStatus?.replace("_", " ") || "Not Immunized"}
                </span>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-6 space-y-5">
              {/* Key Info Grid */}
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div>
                  <p className="font-semibold text-gray-600">Allergies</p>
                  <p className="text-gray-900 mt-1">{r.allergies || "None reported"}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-600">Chronic Conditions</p>
                  <p className="text-gray-900 mt-1">{r.chronicConditions || "None"}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-600">Special Needs</p>
                  <p className="text-gray-900 mt-1">{r.specialNeeds || "—"}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-600">Medication</p>
                  <p className="text-gray-900 mt-1">{r.medication || "None"}</p>
                </div>
              </div>

              {/* Documents */}
              {r.documents && r.documents.length > 0 && (
                <div className="pt-5 border-t border-gray-200">
                  <p className="font-semibold text-gray-700 mb-3">Attached Documents ({r.documents.length})</p>
                  <div className="space-y-2">
                    {r.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-xl border border-indigo-100"
                      >
                        <span className="font-medium text-gray-800 truncate max-w-xs">
                          📄 {doc.name}
                        </span>
                        <button
                          onClick={() => handleDownload(doc.url, doc.name)}
                          className="text-indigo-700 hover:text-indigo-900 font-semibold text-sm"
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4 pt-5 border-t border-gray-200">
                <button
                  onClick={() => onEdit(r)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl shadow transition transform hover:scale-105"
                >
                  Edit Record
                </button>
                <button
                  onClick={() => onDelete(r.id)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl shadow transition transform hover:scale-105"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      {/* Desktop View - Enhanced Table with Horizontal Scroll */}
      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-2xl shadow-2xl border border-gray-200">
          {/* ← Move comment here, outside the table */}
          <table className="w-full min-w-max table-auto">
            <thead className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white">
              <tr>
                <th className="px-8 py-5 text-left font-bold text-lg whitespace-nowrap">Blood Group</th>
                <th className="px-8 py-5 text-left font-bold text-lg whitespace-nowrap">Allergies</th>
                <th className="px-8 py-5 text-left font-bold text-lg whitespace-nowrap">Chronic Conditions</th>
                <th className="px-8 py-5 text-left font-bold text-lg whitespace-nowrap">Special Needs</th>
                <th className="px-8 py-5 text-left font-bold text-lg whitespace-nowrap">Medication</th>
                <th className="px-8 py-5 text-left font-bold text-lg whitespace-nowrap">Immunization</th>
                <th className="px-8 py-5 text-left font-bold text-lg whitespace-nowrap">Last Reviewed</th>
                <th className="px-8 py-5 text-left font-bold text-lg whitespace-nowrap">Documents</th>
                <th className="px-8 py-5 text-right font-bold text-lg whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {records.map((r, idx) => (
                <tr
                  key={r.id}
                  className={`transition-all hover:bg-indigo-50 hover:shadow-md ${idx % 2 === 0 ? "bg-gray-50" : "bg-white"
                    }`}
                >
                  <td className="px-8 py-5 font-semibold text-gray-900 whitespace-nowrap">
                    {r.bloodGroup || "—"}
                  </td>
                  <td className="px-8 py-5 text-gray-700 max-w-xs truncate">
                    {r.allergies || "None"}
                  </td>
                  <td className="px-8 py-5 text-gray-700 max-w-xs truncate">
                    {r.chronicConditions || "None"}
                  </td>
                  <td className="px-8 py-5 text-gray-700 max-w-xs truncate">
                    {r.specialNeeds || "—"}
                  </td>
                  <td className="px-8 py-5 text-gray-700 max-w-xs truncate">
                    {r.medication || "—"}
                  </td>
                  <td className="px-8 py-5">
                    <span
                      className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${r.immunizationStatus === "UP_TO_DATE"
                        ? "bg-green-100 text-green-800"
                        : r.immunizationStatus === "PARTIAL"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                        }`}
                    >
                      {r.immunizationStatus?.replace("_", " ") || "Not Immunized"}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-gray-600 whitespace-nowrap">
                    {r.reviewDate || "—"}
                  </td>
                  <td className="px-8 py-5">
                    {r.documents && r.documents.length > 0 ? (
                      <div className="space-y-2">
                        {r.documents.map((doc) => (
                          <button
                            key={doc.id}
                            onClick={() => handleDownload(doc.url, doc.name)}
                            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium text-sm group"
                          >
                            <span>📄</span>
                            <span className="underline group-hover:no-underline truncate max-w-48">
                              {doc.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic text-sm">No documents</span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right space-x-4 whitespace-nowrap">
                    <button
                      onClick={() => onEdit(r)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold shadow transition transform hover:scale-105"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(r.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold shadow transition transform hover:scale-105"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

  );
}