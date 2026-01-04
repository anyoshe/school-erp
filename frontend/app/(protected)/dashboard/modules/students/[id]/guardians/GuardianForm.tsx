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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
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
        // EDIT mode
        await guardianService.updateGuardianLink(existingLink.id, {
          full_name: form.fullName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || "",
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
        // ADD mode
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
      // DUPLICATE GUARDIAN DETECTION
      if (err?.guardian_exists) {
        // Show duplicate guardian dialog with details
        setDuplicateGuardianInfo(err);
        setShowDuplicateDialog(true);
      } else if (err?.detail) {
        // Other validation errors
        toast.error(err.detail);
      } else if (err?.message) {
        // Generic error
        toast.error(err.message);
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
    // Use the new link_existing endpoint
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
    
    // Reset form
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
    if (error?.detail) {
      toast.error(error.detail);
    } else {
      toast.error("Failed to link guardian. Please try again.");
    }
  } finally {
    setLoading(false);
  }
};

  const handleCreateNewAnyway = () => {
    // User needs to change phone number to create new
    toast.error("Please change the phone number to create a new guardian.");
    setShowDuplicateDialog(false);
    setDuplicateGuardianInfo(null);
    // Focus on phone input
    document.querySelector<HTMLInputElement>('input[name="phone"]')?.focus();
  };

  const handleCancel = () => onCancel?.();

  return (
    <>
      <div className="space-y-4 bg-gray-50 p-6 rounded-xl shadow-sm">
        <h3 className="font-semibold text-lg">{existingLink ? "Edit Guardian" : "Add New Guardian"}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input name="fullName" placeholder="Full Name *" value={form.fullName} onChange={handleChange} disabled={loading} className="input" />
          <input name="phone" placeholder="Phone Number *" value={form.phone} onChange={handleChange} disabled={loading} className="input" />
          <input name="email" type="email" placeholder="Email (optional)" value={form.email} onChange={handleChange} disabled={loading} className="input" />
          <input name="address" placeholder="Address" value={form.address} onChange={handleChange} disabled={loading} className="input" />

          <select name="relationship" value={form.relationship} onChange={handleChange} disabled={loading} className="input">
            {["MOTHER","FATHER","LEGAL_GUARDIAN","GRANDPARENT","OTHER"].map(r => (
              <option key={r} value={r}>{r.replace("_"," ").toLowerCase().replace(/\b\w/g,l => l.toUpperCase())}</option>
            ))}
          </select>

          <select name="preferredContactMethod" value={form.preferredContactMethod} onChange={handleChange} disabled={loading} className="input">
            <option value="PHONE">Phone Call</option>
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS/Text</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isPrimary" checked={!!form.isPrimary} onChange={handleChange} disabled={loading} />
            <span>Primary Guardian</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isEmergencyContact" checked={!!form.isEmergencyContact} onChange={handleChange} disabled={loading} />
            <span>Emergency Contact</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="hasPickupPermission" checked={!!form.hasPickupPermission} onChange={handleChange} disabled={loading} />
            <span>Pickup Permission</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="hasLegalCustody" checked={!!form.hasLegalCustody} onChange={handleChange} disabled={loading} />
            <span>Has Legal Custody</span>
          </label>
        </div>

        <div className="flex gap-4">
          <button onClick={handleSubmit} disabled={loading} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? existingLink ? "Updating..." : "Adding..." : existingLink ? "Update" : "Add Guardian"}
          </button>
          {existingLink && <button onClick={handleCancel} disabled={loading} className="btn-secondary">Cancel</button>}
        </div>
      </div>

      {/* Duplicate Guardian Dialog */}
      {showDuplicateDialog && duplicateGuardianInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Guardian Already Exists</h3>
            
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800 mb-2">
                {duplicateGuardianInfo.message || "A guardian with this phone number already exists."}
              </p>
              <div className="text-sm">
                <p><strong>Name:</strong> {duplicateGuardianInfo.existing_guardian.full_name}</p>
                <p><strong>Phone:</strong> {duplicateGuardianInfo.existing_guardian.phone}</p>
                {duplicateGuardianInfo.existing_guardian.email && (
                  <p><strong>Email:</strong> {duplicateGuardianInfo.existing_guardian.email}</p>
                )}
              </div>
            </div>

            <p className="mb-4 text-gray-600">
              Would you like to link this existing guardian to the student?
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleLinkExisting}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? "Linking..." : "Link Existing Guardian"}
              </button>
              
              <button
                onClick={handleCreateNewAnyway}
                disabled={loading}
                className="btn-secondary"
              >
                Create New Guardian
              </button>
              
              <button
                onClick={() => {
                  setShowDuplicateDialog(false);
                  setDuplicateGuardianInfo(null);
                }}
                disabled={loading}
                className="text-gray-600 hover:text-gray-800"
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