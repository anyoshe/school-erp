// "use client";

// import { useEffect, useState } from "react";
// import { guardianService } from "./guardianService";
// import { StudentGuardianLink } from "./guardian.types";
// import axios from "axios"; // Make sure axios is imported if not already available via api

// export function useGuardians(studentId: string) {
//   const [links, setLinks] = useState<StudentGuardianLink[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null); // Optional: track real errors

//   const fetchGuardians = async () => {
//     if (!studentId) {
//       setLinks([]);
//       setLoading(false);
//       return;
//     }

//     setLoading(true);
//     setError(null);

//     try {
//       const data = await guardianService.getByStudent(studentId);

//       // Sort: primary guardians first
//       data.sort((a, b) => Number(b.isPrimary || false) - Number(a.isPrimary || false));

//       setLinks(data);
//     } catch (err) {
//       // Handle 404 specifically — it means "no guardians linked yet"
//       if (axios.isAxiosError(err) && err.response?.status === 404) {
//         console.info("No guardians linked to this student yet (404 treated as empty)");
//         setLinks([]); // Important: explicitly set empty array
//       } else {
//         // Real errors (network, 500, etc.)
//         console.error("Failed to load guardians", err);
//         setError("Failed to load guardians");
//         setLinks([]); // Optional: reset or keep previous
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchGuardians();
//   }, [studentId]);

//   return {
//     links,
//     loading,
//     error,          // Expose if you want to show error messages
//     refresh: fetchGuardians,
//     setLinks,
//   };
// }

"use client";

import { useEffect, useState } from "react";
import { guardianService } from "./guardianService";
import { StudentGuardianLink, GuardianRelationship, PreferredContactMethod } from "./guardian.types";
import axios from "axios";

export function useGuardians(studentId: string) {
  const [links, setLinks] = useState<StudentGuardianLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGuardians = async () => {
    if (!studentId) {
      setLinks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rawData = await guardianService.getByStudent(studentId);

      // Map snake_case → camelCase to match our frontend types
      const mappedLinks: StudentGuardianLink[] = rawData.map((link: any) => ({
        id: link.id,
        student: link.student,
        guardian: {
          id: link.guardian.id,
          fullName: link.guardian.full_name,
          phone: link.guardian.phone,
          email: link.guardian.email || undefined,
          address: link.guardian.address || undefined,
          isActive: link.guardian.is_active,
          createdAt: link.guardian.created_at,
          updatedAt: link.guardian.updated_at,
        },
        relationship: link.relationship as GuardianRelationship,
        isPrimary: link.is_primary ?? false,
        isEmergencyContact: link.is_emergency_contact ?? false,
        hasPickupPermission: link.has_pickup_permission ?? false,
        hasLegalCustody: link.has_legal_custody ?? false,
        preferredContactMethod: link.preferred_contact_method as PreferredContactMethod | undefined,
        isActive: link.is_active,
        createdAt: link.created_at,
        updatedAt: link.updated_at,
      }));

      // Sort: primary guardians first
      mappedLinks.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

      setLinks(mappedLinks);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        console.info("No guardians linked yet (404 → empty list)");
        setLinks([]);
      } else {
        console.error("Failed to load guardians:", err);
        setError("Failed to load guardians");
        setLinks([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuardians();
  }, [studentId]);

  return {
    links,
    loading,
    error,
    refresh: fetchGuardians,
    setLinks, // Useful if you need to update locally
  };
}