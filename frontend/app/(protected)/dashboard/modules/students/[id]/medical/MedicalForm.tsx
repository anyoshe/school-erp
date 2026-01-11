// "use client";

// import { useState, useEffect } from "react";
// import { medicalService } from "./medicalService";
// import { MedicalRecord } from "./medical.types";
// import { useGuardians } from "../guardians/useGuardians";

// interface Props {
//   studentId: string;
//   record?: MedicalRecord;
//   onSaved: () => void;
//   onClose?: () => void;
// }

// export default function MedicalForm({ studentId, record, onSaved, onClose }: Props) {
//   const { links: guardianLinks, loading: loadingGuardians } = useGuardians(studentId);

//   const [form, setForm] = useState({
//     bloodGroup: record?.bloodGroup || "",
//     emergencyNotes: record?.emergencyNotes || "",
//     emergencyDoctor: record?.emergencyDoctor || "",
//     preferredHospital: record?.preferredHospital || "",

//     allergies: record?.allergies || "",
//     chronicConditions: record?.chronicConditions || "",
//     specialNeeds: record?.specialNeeds || "",
//     medication: record?.medication || "",
//     medicationInstructions: record?.medicationInstructions || "",

//     immunizationStatus: record?.immunizationStatus || "NOT_IMMUNIZED",
//     immunizationNotes: record?.immunizationNotes || "",

//     consentToTreat: record?.consentToTreat ?? false,
//     medicalDisclosureAllowed: record?.medicalDisclosureAllowed ?? false,
//     consentDate: record?.consentDate || "",
//     consentBy: record?.consentBy || "", // Guardian ID (string)
//   });
//   const [newDocuments, setNewDocuments] = useState<File[]>([]);


//   const handleChange = (
//     e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
//   ) => {
//     const { name, type, value, checked } = e.target as HTMLInputElement;

//     if (type === "checkbox") {
//       setForm({ ...form, [name]: checked });
//     } else {
//       setForm({ ...form, [name]: value });
//     }
//   };

// const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//   if (e.target.files) {
//     setNewDocuments(Array.from(e.target.files));
//   }
// };
// const handleSubmit = async () => {
//   const payload = {
//     blood_group: form.bloodGroup || null,
//     allergies: form.allergies || null,
//     chronic_conditions: form.chronicConditions || null,
//     special_needs: form.specialNeeds || null,
//     medication: form.medication || null,
//     medication_instructions: form.medicationInstructions || null,
//     emergency_notes: form.emergencyNotes || null,
//     emergency_doctor: form.emergencyDoctor || null,
//     preferred_hospital: form.preferredHospital || null,
//     immunization_status: form.immunizationStatus,
//     immunization_notes: form.immunizationNotes || null,
//     consent_to_treat: form.consentToTreat,
//     medical_disclosure_allowed: form.medicalDisclosureAllowed,
//     consent_date: form.consentDate || null,
//     consent_by: form.consentBy || null,
//   };

//   try {
//     if (record) {
//       await medicalService.updateRecord(record.id, payload, newDocuments);
//     } else {
//       await medicalService.createRecord(studentId, payload, newDocuments);
//     }
//     setNewDocuments([]);
//     onSaved();
//     onClose?.();
//   } catch (err) {
//     console.error("Failed to save medical record:", err);
//     alert("Failed to save. Check console for details.");
//   }
// };
//   return (
//     <div className="space-y-8 p-6 bg-white rounded-xl shadow-lg max-w-4xl mx-auto">
//       <h2 className="text-2xl font-bold text-center mb-6">
//         {record ? "Edit" : "Add"} Medical Record
//       </h2>

//       {/* Emergency Information */}
//       <section className="space-y-4">
//         <h3 className="text-xl font-semibold text-blue-700">Emergency Information</h3>
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <div>
//             <label className="block font-medium mb-1">Blood Group</label>
//             <select name="bloodGroup" value={form.bloodGroup} onChange={handleChange} className="w-full input">
//               <option value="">— Select —</option>
//               <option value="A+">A+</option>
//               <option value="A-">A-</option>
//               <option value="B+">B+</option>
//               <option value="B-">B-</option>
//               <option value="O+">O+</option>
//               <option value="O-">O-</option>
//               <option value="AB+">AB+</option>
//               <option value="AB-">AB-</option>
//             </select>
//           </div>
//           <div>
//             <label className="block font-medium mb-1">Emergency Doctor</label>
//             <input name="emergencyDoctor" value={form.emergencyDoctor} onChange={handleChange} placeholder="Dr. Name" className="w-full input" />
//           </div>
//           <div>
//             <label className="block font-medium mb-1">Preferred Hospital</label>
//             <input name="preferredHospital" value={form.preferredHospital} onChange={handleChange} placeholder="Hospital Name" className="w-full input" />
//           </div>
//           <div className="md:col-span-2">
//             <label className="block font-medium mb-1">Emergency Notes</label>
//             <textarea name="emergencyNotes" value={form.emergencyNotes} onChange={handleChange} placeholder="Critical instructions..." rows={3} className="w-full textarea" />
//           </div>
//         </div>
//       </section>

//       {/* Health Conditions */}
//       <section className="space-y-4">
//         <h3 className="text-xl font-semibold text-blue-700">Health Conditions</h3>
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <div className="md:col-span-2">
//             <label className="block font-medium mb-1">Allergies</label>
//             <textarea name="allergies" value={form.allergies} onChange={handleChange} placeholder="e.g., Peanuts, Dust" rows={2} className="w-full textarea" />
//           </div>
//           <div className="md:col-span-2">
//             <label className="block font-medium mb-1">Chronic Conditions</label>
//             <textarea name="chronicConditions" value={form.chronicConditions} onChange={handleChange} placeholder="e.g., Asthma, Diabetes" rows={2} className="w-full textarea" />
//           </div>
//           <div className="md:col-span-2">
//             <label className="block font-medium mb-1">Special Needs</label>
//             <textarea name="specialNeeds" value={form.specialNeeds} onChange={handleChange} placeholder="e.g., Dietary restrictions" rows={2} className="w-full textarea" />
//           </div>
//           <div>
//             <label className="block font-medium mb-1">Medication</label>
//             <textarea name="medication" value={form.medication} onChange={handleChange} placeholder="Current medications" rows={2} className="w-full textarea" />
//           </div>
//           <div>
//             <label className="block font-medium mb-1">Medication Instructions</label>
//             <textarea name="medicationInstructions" value={form.medicationInstructions} onChange={handleChange} placeholder="Dosage, timing..." rows={2} className="w-full textarea" />
//           </div>
//         </div>
//       </section>

//       {/* Immunization */}
//       <section className="space-y-4">
//         <h3 className="text-xl font-semibold text-blue-700">Immunization</h3>
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <div>
//             <label className="block font-medium mb-1">Status</label>
//             <select name="immunizationStatus" value={form.immunizationStatus} onChange={handleChange} className="w-full input">
//               <option value="UP_TO_DATE">Up to Date</option>
//               <option value="PARTIAL">Partial</option>
//               <option value="NOT_IMMUNIZED">Not Immunized</option>
//             </select>
//           </div>
//           <div className="md:col-span-2">
//             <label className="block font-medium mb-1">Notes</label>
//             <textarea name="immunizationNotes" value={form.immunizationNotes} onChange={handleChange} placeholder="Details about pending vaccines..." rows={2} className="w-full textarea" />
//           </div>
//         </div>
//       </section>

//       {/* Consent & Legal */}
//      <section className="space-y-4">
//         <h3 className="text-xl font-semibold text-blue-700">Consent</h3>
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <div>
//             <label className="block font-medium mb-1">Consent Given By</label>
//             {loadingGuardians ? (
//               <p className="text-sm text-gray-500">Loading guardians...</p>
//             ) : guardianLinks.length === 0 ? (
//               <p className="text-sm text-amber-600">No guardians linked to this student yet</p>
//             ) : (
//               <select
//                 name="consentBy"
//                 value={form.consentBy}
//                 onChange={handleChange}
//                 className="w-full input"
//               >
//                 <option value="">— None —</option>
//                 {guardianLinks.map((link) => (
//                   <option key={link.id} value={link.guardian.id}>
//                     {link.guardian.fullName} ({link.relationship})
//                     {link.isPrimary && " ★ Primary"}
//                   </option>
//                 ))}
//               </select>
//             )}
//           </div>

//           <div>
//             <label className="block font-medium mb-1">Consent Date</label>
//             <input
//               type="date"
//               name="consentDate"
//               value={form.consentDate}
//               onChange={handleChange}
//               className="w-full input"
//             />
//           </div>

//           <div className="md:col-span-2 space-y-3">
//             <label className="flex items-center gap-3">
//               <input
//                 type="checkbox"
//                 name="consentToTreat"
//                 checked={form.consentToTreat}
//                 onChange={handleChange}
//                 className="scale-125"
//               />
//               <span className="font-medium">Consent to Emergency Treatment</span>
//             </label>
//             <label className="flex items-center gap-3">
//               <input
//                 type="checkbox"
//                 name="medicalDisclosureAllowed"
//                 checked={form.medicalDisclosureAllowed}
//                 onChange={handleChange}
//                 className="scale-125"
//               />
//               <span className="font-medium">Allow Medical Information Disclosure</span>
//             </label>
//           </div>
//         </div>
//       </section>

//       {/* Review Date (Read-only) */}
//       {record && (
//         <section className="bg-gray-50 p-4 rounded-lg">
//           <label className="block font-medium text-gray-700">Last Reviewed</label>
//           <input
//             type="date"
//             value={record.reviewDate || ""}
//             readOnly
//             className="w-full input bg-gray-100 cursor-not-allowed"
//           />
//           <p className="text-sm text-gray-500 mt-1">Automatically set on save by staff</p>
//         </section>
//       )}
//       {/* Upload Medical Documents */}
//       <section className="space-y-4">
//   <h3 className="text-xl font-semibold text-blue-700">Medical Documents</h3>

//   {/* Show existing documents (when editing) */}
//   {record?.documents && record.documents.length > 0 && (
//     <div className="space-y-2">
//       <p className="font-medium">Current Documents:</p>
//       {record.documents.map((doc) => (
//         <div key={doc.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
//           <a
//             href={doc.url}
//             target="_blank"
//             rel="noopener noreferrer"
//             className="text-blue-600 hover:underline break-all"
//           >
//             {doc.name}
//           </a>
//           <a
//             href={doc.url}
//             download={doc.name}
//             className="text-sm text-green-600 hover:underline"
//           >
//             Download
//           </a>
//         </div>
//       ))}
//     </div>
//   )}

//   {/* Upload new documents */}
//   <div>
//     <label className="block font-medium mb-2">
//       Add New Documents (immunization card, doctor's note, lab reports, etc.)
//     </label>
//     <input
//       type="file"
//       multiple
//       accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
//       onChange={handleFileChange}
//       className="w-full input-file p-3 border rounded-lg"
//     />
//     {newDocuments.length > 0 && (
//       <div className="mt-3 space-y-1">
//         <p className="text-sm font-medium text-gray-700">Selected files:</p>
//         {newDocuments.map((file, idx) => (
//           <p key={idx} className="text-sm text-gray-600 pl-4">
//             • {file.name} ({(file.size / 1024).toFixed(1)} KB)
//           </p>
//         ))}
//       </div>
//     )}
//   </div>
// </section>

//       {/* Submit */}
//       <div className="flex gap-4 pt-6">
//         <button onClick={handleSubmit} className="flex-1 btn-primary py-3 text-lg font-semibold">
//           {record ? "Update" : "Save"} Medical Record
//         </button>
//         {onClose && (
//           <button onClick={onClose} className="px-6 btn-secondary">
//             Cancel
//           </button>
//         )}
//       </div>
//     </div>
//   );
// }

"use client";

import { useState } from "react";
import { medicalService } from "./medicalService";
import { MedicalRecord } from "./medical.types";
import { useGuardians } from "../guardians/useGuardians";

interface Props {
  studentId: string;
  record?: MedicalRecord;
  onSaved: () => void;
  onClose?: () => void;
}

export default function MedicalForm({ studentId, record, onSaved, onClose }: Props) {
  const { links: guardianLinks, loading: loadingGuardians } = useGuardians(studentId);

  const [form, setForm] = useState({
    bloodGroup: record?.bloodGroup || "",
    emergencyNotes: record?.emergencyNotes || "",
    emergencyDoctor: record?.emergencyDoctor || "",
    preferredHospital: record?.preferredHospital || "",

    allergies: record?.allergies || "",
    chronicConditions: record?.chronicConditions || "",
    specialNeeds: record?.specialNeeds || "",
    medication: record?.medication || "",
    medicationInstructions: record?.medicationInstructions || "",

    immunizationStatus: record?.immunizationStatus || "NOT_IMMUNIZED",
    immunizationNotes: record?.immunizationNotes || "",

    consentToTreat: record?.consentToTreat ?? false,
    medicalDisclosureAllowed: record?.medicalDisclosureAllowed ?? false,
    consentDate: record?.consentDate || "",
    consentBy: record?.consentBy || "",
  });

  const [newDocuments, setNewDocuments] = useState<File[]>([]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, type, value, checked } = e.target as HTMLInputElement;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setNewDocuments(Array.from(e.target.files));
    }
  };

  const handleSubmit = async () => {
    const payload = {
      blood_group: form.bloodGroup || null,
      allergies: form.allergies || null,
      chronic_conditions: form.chronicConditions || null,
      special_needs: form.specialNeeds || null,
      medication: form.medication || null,
      medication_instructions: form.medicationInstructions || null,
      emergency_notes: form.emergencyNotes || null,
      emergency_doctor: form.emergencyDoctor || null,
      preferred_hospital: form.preferredHospital || null,
      immunization_status: form.immunizationStatus,
      immunization_notes: form.immunizationNotes || null,
      consent_to_treat: form.consentToTreat,
      medical_disclosure_allowed: form.medicalDisclosureAllowed,
      consent_date: form.consentDate || null,
      consent_by: form.consentBy || null,
    };

    try {
      if (record) {
        await medicalService.updateRecord(record.id, payload, newDocuments);
      } else {
        await medicalService.createRecord(studentId, payload, newDocuments);
      }
      setNewDocuments([]);
      onSaved();
      onClose?.();
    } catch (err) {
      console.error("Failed to save medical record:", err);
      alert("Failed to save. Check console for details.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 bg-gray-50 rounded-2xl shadow-xl">
      <h2 className="text-3xl font-bold text-center text-gray-800 mb-10">
        {record ? "Edit" : "Create"} Medical Record
      </h2>

      {/* Section: Emergency Information */}
      <section className="mb-12 bg-white rounded-xl shadow-sm p-8 border border-gray-100">
        <h3 className="text-2xl font-semibold text-indigo-700 mb-6 flex items-center">
          <span className="mr-3 text-3xl">🚨</span> Emergency Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Blood Group</label>
            <select name="bloodGroup" value={form.bloodGroup} onChange={handleChange} className="w-full input">
              <option value="">— Select Blood Group —</option>
              {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Emergency Doctor</label>
            <input name="emergencyDoctor" value={form.emergencyDoctor} onChange={handleChange} placeholder="e.g., Dr. John Smith" className="w-full input" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Preferred Hospital</label>
            <input name="preferredHospital" value={form.preferredHospital} onChange={handleChange} placeholder="e.g., City General Hospital" className="w-full input" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Emergency Notes</label>
            <textarea name="emergencyNotes" value={form.emergencyNotes} onChange={handleChange} placeholder="Critical instructions for emergency response..." rows={4} className="w-full textarea" />
          </div>
        </div>
      </section>

      {/* Section: Health Conditions */}
      <section className="mb-12 bg-white rounded-xl shadow-sm p-8 border border-gray-100">
        <h3 className="text-2xl font-semibold text-amber-600 mb-6 flex items-center">
          <span className="mr-3 text-3xl">🩺</span> Health Conditions
        </h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Allergies</label>
            <textarea name="allergies" value={form.allergies} onChange={handleChange} placeholder="e.g., Peanuts, Penicillin, Dust" rows={3} className="w-full textarea" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Chronic Conditions</label>
            <textarea name="chronicConditions" value={form.chronicConditions} onChange={handleChange} placeholder="e.g., Asthma, Diabetes, Epilepsy" rows={3} className="w-full textarea" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Special Needs</label>
            <textarea name="specialNeeds" value={form.specialNeeds} onChange={handleChange} placeholder="e.g., Hearing aid, Wheelchair access, Dietary restrictions" rows={3} className="w-full textarea" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Current Medication</label>
              <textarea name="medication" value={form.medication} onChange={handleChange} placeholder="List all regular medications" rows={3} className="w-full textarea" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Medication Instructions</label>
              <textarea name="medicationInstructions" value={form.medicationInstructions} onChange={handleChange} placeholder="Dosage, timing, special instructions" rows={3} className="w-full textarea" />
            </div>
          </div>
        </div>
      </section>

      {/* Section: Immunization */}
      <section className="mb-12 bg-white rounded-xl shadow-sm p-8 border border-gray-100">
        <h3 className="text-2xl font-semibold text-green-700 mb-6 flex items-center">
          <span className="mr-3 text-3xl">💉</span> Immunization Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Current Status</label>
            <select name="immunizationStatus" value={form.immunizationStatus} onChange={handleChange} className="w-full input">
              <option value="UP_TO_DATE">Up to Date</option>
              <option value="PARTIAL">Partial / In Progress</option>
              <option value="NOT_IMMUNIZED">Not Immunized</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Notes</label>
            <textarea name="immunizationNotes" value={form.immunizationNotes} onChange={handleChange} placeholder="Next due dates, missing vaccines, etc." rows={3} className="w-full textarea" />
          </div>
        </div>
      </section>

      {/* Section: Consent */}
      <section className="mb-12 bg-white rounded-xl shadow-sm p-8 border border-gray-100">
        <h3 className="text-2xl font-semibold text-purple-700 mb-6 flex items-center">
          <span className="mr-3 text-3xl">✍️</span> Parental Consent
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Consent Given By</label>
            {loadingGuardians ? (
              <p className="text-sm text-gray-500">Loading guardians...</p>
            ) : guardianLinks.length === 0 ? (
              <p className="text-sm text-amber-600 font-medium">No guardians linked yet</p>
            ) : (
              <select name="consentBy" value={form.consentBy} onChange={handleChange} className="w-full input">
                <option value="">— Select Guardian —</option>
                {guardianLinks.map((link) => (
                  <option key={link.id} value={link.guardian.id}>
                    {link.guardian.fullName} ({link.relationship}) {link.isPrimary && "★ Primary"}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Consent Date</label>
            <input type="date" name="consentDate" value={form.consentDate} onChange={handleChange} className="w-full input" />
          </div>
          <div className="md:col-span-2 space-y-4 mt-4">
            <label className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
              <input type="checkbox" name="consentToTreat" checked={form.consentToTreat} onChange={handleChange} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
              <span className="font-medium text-gray-800">I consent to emergency medical treatment if needed</span>
            </label>
            <label className="flex items-center gap-4 p-4 bg-indigo-50 rounded-lg">
              <input type="checkbox" name="medicalDisclosureAllowed" checked={form.medicalDisclosureAllowed} onChange={handleChange} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
              <span className="font-medium text-gray-800">I allow disclosure of medical information to school staff</span>
            </label>
          </div>
        </div>
      </section>

      {/* Section: Medical Documents */}
      <section className="mb-12 bg-white rounded-xl shadow-sm p-8 border border-gray-100">
        <h3 className="text-2xl font-semibold text-teal-700 mb-6 flex items-center">
          <span className="mr-3 text-3xl">📎</span> Medical Documents
        </h3>

        {/* Existing Documents */}
        {record?.documents && record.documents.length > 0 && (
          <div className="mb-8">
            <p className="font-semibold text-gray-700 mb-4">Uploaded Documents:</p>
            <div className="space-y-3">
              {record.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                  <span className="font-medium text-gray-800 truncate max-w-md">{doc.name}</span>
                  <div className="flex gap-3">
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 font-medium">
                      View
                    </a>
                    <button
                      onClick={() => medicalService.downloadDocument(doc.url, doc.name)}
                      className="text-green-600 hover:text-green-800 font-medium"
                    >
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload New */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Upload Additional Documents
          </label>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-600 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
          />
          {newDocuments.length > 0 && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-medium text-green-800 mb-2">Ready to upload ({newDocuments.length}):</p>
              <ul className="text-sm text-green-700 space-y-1">
                {newDocuments.map((file, i) => (
                  <li key={i}>• {file.name} ({(file.size / 1024).toFixed(1)} KB)</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Last Reviewed */}
      {record && (
        <div className="mb-10 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
          <p className="text-sm font-semibold text-blue-800">Last Reviewed:</p>
          <p className="text-lg font-medium text-indigo-900">{record.reviewDate || "Not yet reviewed"}</p>
          <p className="text-xs text-blue-600 mt-1">Automatically updated when saved by staff</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 pt-6">
        <button
          onClick={handleSubmit}
          className="flex-1 btn-primary py-4 text-lg font-bold shadow-lg hover:shadow-xl transition-shadow"
        >
          {record ? "Update Medical Record" : "Save Medical Record"}
        </button>
        {onClose && (
          <button onClick={onClose} className="px-8 py-4 btn-secondary text-lg font-medium">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}