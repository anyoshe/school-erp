import api from "../../../../../../utils/api";
import {
  Guardian,
  StudentGuardianLink,
  GuardianRelationship,
  PreferredContactMethod,
} from "./guardian.types";
import axios from "axios";

export interface AddGuardianPayload {
  // Guardian fields
  full_name: string;
  phone: string;
  email?: string;
  address?: string;

  // Link fields
  relationship: GuardianRelationship;
  isPrimary?: boolean;
  isEmergencyContact?: boolean;
  hasPickupPermission?: boolean;
  hasLegalCustody?: boolean;
  preferredContactMethod?: PreferredContactMethod;
}

export const guardianService = {
  /* ---------- GET GUARDIANS BY STUDENT ---------- */
  async getByStudent(studentId: string): Promise<StudentGuardianLink[]> {
    const { data } = await api.get(
      `/students/student-guardians/?student=${studentId}`
    );
    return data;
  },

  /* ---------- ADD GUARDIAN + LINK IN ONE CALL ---------- */
  async addGuardianToStudent(
    studentId: string,
    payload: AddGuardianPayload
  ): Promise<StudentGuardianLink> {
    try {
      const { data } = await api.post(
        `/students/student-guardians/`,
        {
          student: studentId,
          guardian: {
            full_name: payload.full_name,
            phone: payload.phone,
            email: payload.email || "",
            address: payload.address || "",
          },
          relationship: payload.relationship,
          is_primary: payload.isPrimary ?? false,
          is_emergency_contact: payload.isEmergencyContact ?? false,
          has_pickup_permission: payload.hasPickupPermission ?? false,
          has_legal_custody: payload.hasLegalCustody ?? false,
          preferred_contact_method: payload.preferredContactMethod ?? "PHONE",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;

        // Handle existing guardian case - IMPORTANT: Check for guardian_exists key
        if (errorData?.guardian_exists) {
          // Throw the entire error data so frontend can access existing_guardian info
          throw errorData;
        }

        // Handle other validation errors
        if (error.response?.status === 400) {
          console.error("Validation errors:", errorData);
          throw errorData; // Throw the error data so frontend can access it
        }

        console.error("Failed to add guardian:", {
          status: error.response?.status,
          data: errorData,
          message: error.message,
        });
        throw error;
      }
      throw error;
    }
  },

  /* ---------- LINK EXISTING GUARDIAN TO STUDENT ---------- */
  async linkToStudent(
    studentId: string,
    payload: {
      guardianId: string;
      relationship: GuardianRelationship;
      isPrimary?: boolean;
      isEmergencyContact?: boolean;
      hasPickupPermission?: boolean;
      hasLegalCustody?: boolean;
      preferredContactMethod?: PreferredContactMethod;
    }
  ): Promise<StudentGuardianLink> {
    try {
      const { data } = await api.post(`/students/student-guardians/link_existing/`, {
        student: studentId,
        guardian: payload.guardianId,  // Just the ID string, not an object
        relationship: payload.relationship,
        is_primary: payload.isPrimary ?? false,
        is_emergency_contact: payload.isEmergencyContact ?? false,
        has_pickup_permission: payload.hasPickupPermission ?? false,
        has_legal_custody: payload.hasLegalCustody ?? false,
        preferred_contact_method: payload.preferredContactMethod ?? "PHONE",
      });
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error("Failed to link guardian:", error.response?.data);
        throw error.response?.data || error;
      }
      throw error;
    }
  },
  // ... rest of your service methods remain the same
 async updateGuardianLink(
  linkId: string,
  payload: {
    full_name?: string;
    phone?: string;
    email?: string;
    address?: string;
    relationship?: GuardianRelationship;
    isPrimary?: boolean;
    isEmergencyContact?: boolean;
    hasPickupPermission?: boolean;
    hasLegalCustody?: boolean;
    preferredContactMethod?: PreferredContactMethod;
  }
): Promise<StudentGuardianLink> {
  try {
    // Build update data dynamically - only include fields that are provided
    const updateData: any = {};
    
    // Build guardian object only if there are guardian fields to update
    const guardianUpdate: any = {};
    if (payload.full_name !== undefined) guardianUpdate.full_name = payload.full_name;
    if (payload.phone !== undefined) guardianUpdate.phone = payload.phone;
    if (payload.email !== undefined) guardianUpdate.email = payload.email;
    if (payload.address !== undefined) guardianUpdate.address = payload.address;
    
    // Only include guardian if there are actual guardian fields to update
    if (Object.keys(guardianUpdate).length > 0) {
      updateData.guardian = guardianUpdate;
    }
    
    // Only include link fields if they are provided
    if (payload.relationship !== undefined) updateData.relationship = payload.relationship;
    if (payload.isPrimary !== undefined) updateData.is_primary = payload.isPrimary;
    if (payload.isEmergencyContact !== undefined) updateData.is_emergency_contact = payload.isEmergencyContact;
    if (payload.hasPickupPermission !== undefined) updateData.has_pickup_permission = payload.hasPickupPermission;
    if (payload.hasLegalCustody !== undefined) updateData.has_legal_custody = payload.hasLegalCustody;
    if (payload.preferredContactMethod !== undefined) updateData.preferred_contact_method = payload.preferredContactMethod;
    
    console.log('Update data:', updateData);
    
    const { data } = await api.patch(`/students/student-guardians/${linkId}/`, updateData);
    return data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error("Failed to update guardian link:", error.response?.data);
      throw error.response?.data || error;
    }
    throw error;
  }
},

  async updateLink(
    linkId: string,
    payload: Partial<StudentGuardianLink>
  ): Promise<StudentGuardianLink> {
    const { data } = await api.patch(
      `/students/student-guardians/${linkId}/`,
      payload
    );
    return data;
  },

  async unlink(linkId: string): Promise<void> {
    await api.delete(`/students/student-guardians/${linkId}/`);
  },

  async deleteGuardian(guardianId: string): Promise<void> {
    await api.delete(`/students/guardians/${guardianId}/`);
  },
};