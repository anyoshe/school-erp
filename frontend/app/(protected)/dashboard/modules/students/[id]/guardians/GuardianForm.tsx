// "use client";

// import { useState, useEffect } from "react";
// import { guardianService } from "./guardianService";
// import { GuardianRelationship, PreferredContactMethod } from "./guardian.types";
// import toast from "react-hot-toast";

// interface GuardianFormProps {
//   studentId: string;
//   onSaved: () => void;
//   existingLink?: any;
//   onCancel?: () => void;
// }

// export default function GuardianForm({
//   studentId,
//   onSaved,
//   existingLink,
//   onCancel,
// }: GuardianFormProps) {
//   const [loading, setLoading] = useState(false);
//   const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
//   const [duplicateGuardianInfo, setDuplicateGuardianInfo] = useState<any>(null);

//   const [form, setForm] = useState({
//     fullName: "",
//     phone: "",
//     email: "",
//     address: "",
//     relationship: "MOTHER" as GuardianRelationship,
//     isPrimary: false,
//     isEmergencyContact: false,
//     hasPickupPermission: true,
//     hasLegalCustody: false,
//     preferredContactMethod: "PHONE" as PreferredContactMethod,
//   });

//   useEffect(() => {
//     if (existingLink) {
//       const g = existingLink.guardian;
//       setForm({
//         fullName: g.full_name || "",
//         phone: g.phone || "",
//         email: g.email || "",
//         address: g.address || "",
//         relationship: existingLink.relationship || "MOTHER",
//         isPrimary: existingLink.isPrimary ?? false,
//         isEmergencyContact: existingLink.isEmergencyContact ?? false,
//         hasPickupPermission: existingLink.hasPickupPermission ?? true,
//         hasLegalCustody: existingLink.hasLegalCustody ?? false,
//         preferredContactMethod: existingLink.preferredContactMethod || "PHONE",
//       });
//     }
//   }, [existingLink]);

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
//     const { name, value, type } = e.target;
//     setForm(prev => ({
//       ...prev,
//       [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
//     }));
//   };

//   const handleSubmit = async () => {
//     if (!form.fullName.trim() || !form.phone.trim()) {
//       toast.error("Full Name and Phone are required.");
//       return;
//     }

//     setLoading(true);

//     try {
//       if (existingLink) {
//         // EDIT mode
//         await guardianService.updateGuardianLink(existingLink.id, {
//           full_name: form.fullName.trim(),
//           phone: form.phone.trim(),
//           email: form.email.trim() || "",
//           address: form.address.trim() || "",
//           relationship: form.relationship,
//           isPrimary: form.isPrimary,
//           isEmergencyContact: form.isEmergencyContact,
//           hasPickupPermission: form.hasPickupPermission,
//           hasLegalCustody: form.hasLegalCustody,
//           preferredContactMethod: form.preferredContactMethod,
//         });
//         toast.success("Guardian updated successfully!");
//       } else {
//         // ADD mode
//         await guardianService.addGuardianToStudent(studentId, {
//           full_name: form.fullName.trim(),
//           phone: form.phone.trim(),
//           email: form.email.trim() || undefined,
//           address: form.address.trim() || "",
//           relationship: form.relationship,
//           isPrimary: form.isPrimary,
//           isEmergencyContact: form.isEmergencyContact,
//           hasPickupPermission: form.hasPickupPermission,
//           hasLegalCustody: form.hasLegalCustody,
//           preferredContactMethod: form.preferredContactMethod,
//         });
//         toast.success("Guardian added successfully!");
//       }

//       if (!existingLink) {
//         setForm({
//           fullName: "",
//           phone: "",
//           email: "",
//           address: "",
//           relationship: "MOTHER",
//           isPrimary: false,
//           isEmergencyContact: false,
//           hasPickupPermission: true,
//           hasLegalCustody: false,
//           preferredContactMethod: "PHONE",
//         });
//       }

//       onSaved();
//     } catch (err: any) {
//       // DUPLICATE GUARDIAN DETECTION
//       if (err?.guardian_exists) {
//         // Show duplicate guardian dialog with details
//         setDuplicateGuardianInfo(err);
//         setShowDuplicateDialog(true);
//       } else if (err?.detail) {
//         // Other validation errors
//         toast.error(err.detail);
//       } else if (err?.message) {
//         // Generic error
//         toast.error(err.message);
//       } else {
//         toast.error("Failed to save guardian. Please try again.");
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleLinkExisting = async () => {
//   if (!duplicateGuardianInfo?.existing_guardian?.id) {
//     toast.error("Cannot link: Guardian ID not found");
//     return;
//   }

//   setLoading(true);
//   try {
//     // Use the new link_existing endpoint
//     await guardianService.linkToStudent(studentId, {
//       guardianId: duplicateGuardianInfo.existing_guardian.id,
//       relationship: form.relationship,
//       isPrimary: form.isPrimary,
//       isEmergencyContact: form.isEmergencyContact,
//       hasPickupPermission: form.hasPickupPermission,
//       hasLegalCustody: form.hasLegalCustody,
//       preferredContactMethod: form.preferredContactMethod,
//     });
    
//     toast.success("Guardian linked successfully!");
//     setShowDuplicateDialog(false);
//     setDuplicateGuardianInfo(null);
    
//     // Reset form
//     setForm({
//       fullName: "",
//       phone: "",
//       email: "",
//       address: "",
//       relationship: "MOTHER",
//       isPrimary: false,
//       isEmergencyContact: false,
//       hasPickupPermission: true,
//       hasLegalCustody: false,
//       preferredContactMethod: "PHONE",
//     });
    
//     onSaved();
//   } catch (error: any) {
//     if (error?.detail) {
//       toast.error(error.detail);
//     } else {
//       toast.error("Failed to link guardian. Please try again.");
//     }
//   } finally {
//     setLoading(false);
//   }
// };

//   const handleCreateNewAnyway = () => {
//     // User needs to change phone number to create new
//     toast.error("Please change the phone number to create a new guardian.");
//     setShowDuplicateDialog(false);
//     setDuplicateGuardianInfo(null);
//     // Focus on phone input
//     document.querySelector<HTMLInputElement>('input[name="phone"]')?.focus();
//   };

//   const handleCancel = () => onCancel?.();

//   return (
//     <>
//       <div className="space-y-4 bg-gray-50 p-6 rounded-xl shadow-sm">
//         <h3 className="font-semibold text-lg">{existingLink ? "Edit Guardian" : "Add New Guardian"}</h3>

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <input name="fullName" placeholder="Full Name *" value={form.fullName} onChange={handleChange} disabled={loading} className="input" />
//           <input name="phone" placeholder="Phone Number *" value={form.phone} onChange={handleChange} disabled={loading} className="input" />
//           <input name="email" type="email" placeholder="Email (optional)" value={form.email} onChange={handleChange} disabled={loading} className="input" />
//           <input name="address" placeholder="Address" value={form.address} onChange={handleChange} disabled={loading} className="input" />

//           <select name="relationship" value={form.relationship} onChange={handleChange} disabled={loading} className="input">
//             {["MOTHER","FATHER","LEGAL_GUARDIAN","GRANDPARENT","OTHER"].map(r => (
//               <option key={r} value={r}>{r.replace("_"," ").toLowerCase().replace(/\b\w/g,l => l.toUpperCase())}</option>
//             ))}
//           </select>

//           <select name="preferredContactMethod" value={form.preferredContactMethod} onChange={handleChange} disabled={loading} className="input">
//             <option value="PHONE">Phone Call</option>
//             <option value="EMAIL">Email</option>
//             <option value="SMS">SMS/Text</option>
//           </select>
//         </div>

//         <div className="flex flex-wrap gap-6 text-sm">
//           <label className="flex items-center gap-2">
//             <input type="checkbox" name="isPrimary" checked={!!form.isPrimary} onChange={handleChange} disabled={loading} />
//             <span>Primary Guardian</span>
//           </label>
//           <label className="flex items-center gap-2">
//             <input type="checkbox" name="isEmergencyContact" checked={!!form.isEmergencyContact} onChange={handleChange} disabled={loading} />
//             <span>Emergency Contact</span>
//           </label>
//           <label className="flex items-center gap-2">
//             <input type="checkbox" name="hasPickupPermission" checked={!!form.hasPickupPermission} onChange={handleChange} disabled={loading} />
//             <span>Pickup Permission</span>
//           </label>
//           <label className="flex items-center gap-2">
//             <input type="checkbox" name="hasLegalCustody" checked={!!form.hasLegalCustody} onChange={handleChange} disabled={loading} />
//             <span>Has Legal Custody</span>
//           </label>
//         </div>

//         <div className="flex gap-4">
//           <button onClick={handleSubmit} disabled={loading} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
//             {loading ? existingLink ? "Updating..." : "Adding..." : existingLink ? "Update" : "Add Guardian"}
//           </button>
//           {existingLink && <button onClick={handleCancel} disabled={loading} className="btn-secondary">Cancel</button>}
//         </div>
//       </div>

//       {/* Duplicate Guardian Dialog */}
//       {showDuplicateDialog && duplicateGuardianInfo && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//           <div className="bg-white rounded-lg p-6 max-w-md w-full">
//             <h3 className="text-lg font-semibold mb-4">Guardian Already Exists</h3>
            
//             <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
//               <p className="text-sm text-yellow-800 mb-2">
//                 {duplicateGuardianInfo.message || "A guardian with this phone number already exists."}
//               </p>
//               <div className="text-sm">
//                 <p><strong>Name:</strong> {duplicateGuardianInfo.existing_guardian.full_name}</p>
//                 <p><strong>Phone:</strong> {duplicateGuardianInfo.existing_guardian.phone}</p>
//                 {duplicateGuardianInfo.existing_guardian.email && (
//                   <p><strong>Email:</strong> {duplicateGuardianInfo.existing_guardian.email}</p>
//                 )}
//               </div>
//             </div>

//             <p className="mb-4 text-gray-600">
//               Would you like to link this existing guardian to the student?
//             </p>

//             <div className="flex flex-col gap-2">
//               <button
//                 onClick={handleLinkExisting}
//                 disabled={loading}
//                 className="btn-primary"
//               >
//                 {loading ? "Linking..." : "Link Existing Guardian"}
//               </button>
              
//               <button
//                 onClick={handleCreateNewAnyway}
//                 disabled={loading}
//                 className="btn-secondary"
//               >
//                 Create New Guardian
//               </button>
              
//               <button
//                 onClick={() => {
//                   setShowDuplicateDialog(false);
//                   setDuplicateGuardianInfo(null);
//                 }}
//                 disabled={loading}
//                 className="text-gray-600 hover:text-gray-800"
//               >
//                 Cancel
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

"use client";

import { useState, useEffect } from "react";
import { guardianService } from "./guardianService";
import { GuardianRelationship, PreferredContactMethod } from "./guardian.types";
import toast from "react-hot-toast";

interface GuardianFormProps {
  studentId: string;
  onSaved: () => void;
  existingLink?: any;
  onCancel?: () => void;
}

export default function GuardianForm({
  studentId,
  onSaved,
  existingLink,
  onCancel,
}: GuardianFormProps) {
  const [loading, setLoading] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateGuardianInfo, setDuplicateGuardianInfo] = useState<any>(null);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    relationship: "MOTHER" as GuardianRelationship,
    isPrimary: false,
    isEmergencyContact: false,
    hasPickupPermission: true,
    hasLegalCustody: false,
    preferredContactMethod: "PHONE" as PreferredContactMethod,
  });

  useEffect(() => {
    if (existingLink) {
      const g = existingLink.guardian;
      setForm({
        fullName: g.full_name || "",
        phone: g.phone || "",
        email: g.email || "",
        address: g.address || "",
        relationship: existingLink.relationship || "MOTHER",
        isPrimary: existingLink.isPrimary ?? false,
        isEmergencyContact: existingLink.isEmergencyContact ?? false,
        hasPickupPermission: existingLink.hasPickupPermission ?? true,
        hasLegalCustody: existingLink.hasLegalCustody ?? false,
        preferredContactMethod: existingLink.preferredContactMethod || "PHONE",
      });
    }
  }, [existingLink]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, type, value, checked } = e.target as HTMLInputElement;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async () => {
    if (!form.fullName.trim() || !form.phone.trim()) {
      toast.error("Full Name and Phone are required.");
      return;
    }

    setLoading(true);

    try {
      if (existingLink) {
        await guardianService.updateGuardianLink(existingLink.id, {
          full_name: form.fullName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          address: form.address.trim() || "",
          relationship: form.relationship,
          isPrimary: form.isPrimary,
          isEmergencyContact: form.isEmergencyContact,
          hasPickupPermission: form.hasPickupPermission,
          hasLegalCustody: form.hasLegalCustody,
          preferredContactMethod: form.preferredContactMethod,
        });
        toast.success("Guardian updated successfully!");
      } else {
        await guardianService.addGuardianToStudent(studentId, {
          full_name: form.fullName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          address: form.address.trim() || "",
          relationship: form.relationship,
          isPrimary: form.isPrimary,
          isEmergencyContact: form.isEmergencyContact,
          hasPickupPermission: form.hasPickupPermission,
          hasLegalCustody: form.hasLegalCustody,
          preferredContactMethod: form.preferredContactMethod,
        });
        toast.success("Guardian added successfully!");
      }

      if (!existingLink) {
        setForm({
          fullName: "",
          phone: "",
          email: "",
          address: "",
          relationship: "MOTHER",
          isPrimary: false,
          isEmergencyContact: false,
          hasPickupPermission: true,
          hasLegalCustody: false,
          preferredContactMethod: "PHONE",
        });
      }

      onSaved();
    } catch (err: any) {
      if (err?.guardian_exists) {
        setDuplicateGuardianInfo(err);
        setShowDuplicateDialog(true);
      } else if (err?.detail) {
        toast.error(err.detail);
      } else {
        toast.error("Failed to save guardian. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLinkExisting = async () => {
    if (!duplicateGuardianInfo?.existing_guardian?.id) {
      toast.error("Cannot link: Guardian ID not found");
      return;
    }

    setLoading(true);
    try {
      await guardianService.linkToStudent(studentId, {
        guardianId: duplicateGuardianInfo.existing_guardian.id,
        relationship: form.relationship,
        isPrimary: form.isPrimary,
        isEmergencyContact: form.isEmergencyContact,
        hasPickupPermission: form.hasPickupPermission,
        hasLegalCustody: form.hasLegalCustody,
        preferredContactMethod: form.preferredContactMethod,
      });

      toast.success("Guardian linked successfully!");
      setShowDuplicateDialog(false);
      setDuplicateGuardianInfo(null);
      setForm({
        fullName: "",
        phone: "",
        email: "",
        address: "",
        relationship: "MOTHER",
        isPrimary: false,
        isEmergencyContact: false,
        hasPickupPermission: true,
        hasLegalCustody: false,
        preferredContactMethod: "PHONE",
      });
      onSaved();
    } catch (error: any) {
      toast.error(error?.detail || "Failed to link guardian.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewAnyway = () => {
    toast.error("Please change the phone number to create a new guardian.");
    setShowDuplicateDialog(false);
    setDuplicateGuardianInfo(null);
    document.querySelector<HTMLInputElement>('input[name="phone"]')?.focus();
  };

  return (
    <>
      {/* Main Form Card */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold text-gray-800">
            {existingLink ? "Edit Guardian" : "Add New Guardian"}
          </h3>
          {existingLink && (
            <button
              onClick={onCancel}
              disabled={loading}
              className="text-gray-500 hover:text-gray-700 font-medium"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Personal Information */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                placeholder="e.g., Jane Doe"
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+1234567890"
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="jane@example.com"
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Home Address
              </label>
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="123 Main St, City"
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Relationship to Student
              </label>
              <select
                name="relationship"
                value={form.relationship}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              >
                {[
                  "MOTHER",
                  "FATHER",
                  "STEP_PARENT",
                  "GRANDPARENT",
                  "SIBLING",
                  "UNCLE",
                  "AUNT",
                  "LEGAL_GUARDIAN",
                  "OTHER",
                ].map((r) => (
                  <option key={r} value={r}>
                    {r.replace("_", " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Preferred Contact Method
              </label>
              <select
                name="preferredContactMethod"
                value={form.preferredContactMethod}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              >
                <option value="PHONE">Phone Call</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS/Text Message</option>
              </select>
            </div>
          </div>

          {/* Permissions & Roles */}
          <div className="pt-6 border-t border-gray-200">
            <p className="text-sm font-semibold text-gray-700 mb-4">Permissions & Roles</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <label className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition cursor-pointer">
                <input
                  type="checkbox"
                  name="isPrimary"
                  checked={form.isPrimary}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="font-medium text-gray-800">Primary Guardian</span>
              </label>

              <label className="flex items-center gap-3 p-4 bg-red-50 rounded-xl hover:bg-red-100 transition cursor-pointer">
                <input
                  type="checkbox"
                  name="isEmergencyContact"
                  checked={form.isEmergencyContact}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                />
                <span className="font-medium text-gray-800">Emergency Contact</span>
              </label>

              <label className="flex items-center gap-3 p-4 bg-green-50 rounded-xl hover:bg-green-100 transition cursor-pointer">
                <input
                  type="checkbox"
                  name="hasPickupPermission"
                  checked={form.hasPickupPermission}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                />
                <span className="font-medium text-gray-800">Pickup Permission</span>
              </label>

              <label className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl hover:bg-purple-100 transition cursor-pointer">
                <input
                  type="checkbox"
                  name="hasLegalCustody"
                  checked={form.hasLegalCustody}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                />
                <span className="font-medium text-gray-800">Legal Custody</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-8">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 text-white font-bold rounded-xl shadow-lg transition transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? "Saving..." : existingLink ? "Update Guardian" : "Add Guardian"}
            </button>
          </div>
        </div>
      </div>

      {/* Duplicate Guardian Modal */}
      {showDuplicateDialog && duplicateGuardianInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 animate-fadeIn">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Guardian Already Exists</h3>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
              <p className="text-amber-800 font-medium mb-3">
                A guardian with this phone number is already in the system:
              </p>
              <div className="space-y-2 text-sm">
                <p><strong className="text-amber-900">Name:</strong> {duplicateGuardianInfo.existing_guardian.full_name}</p>
                <p><strong className="text-amber-900">Phone:</strong> {duplicateGuardianInfo.existing_guardian.phone}</p>
                {duplicateGuardianInfo.existing_guardian.email && (
                  <p><strong className="text-amber-900">Email:</strong> {duplicateGuardianInfo.existing_guardian.email}</p>
                )}
              </div>
            </div>

            <p className="text-gray-700 mb-8">
              Do you want to <strong>link this existing guardian</strong> to the student, or create a new one?
            </p>

            <div className="flex flex-col gap-4">
              <button
                onClick={handleLinkExisting}
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white font-bold rounded-xl shadow-lg transition transform hover:scale-105"
              >
                {loading ? "Linking..." : "Link Existing Guardian"}
              </button>

              <button
                onClick={handleCreateNewAnyway}
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-lg transition transform hover:scale-105"
              >
                Create New Guardian Anyway
              </button>

              <button
                onClick={() => {
                  setShowDuplicateDialog(false);
                  setDuplicateGuardianInfo(null);
                }}
                disabled={loading}
                className="w-full py-3 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}