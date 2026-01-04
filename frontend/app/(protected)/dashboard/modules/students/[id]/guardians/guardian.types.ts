/* ------------------- ENUMS ------------------- */
export type GuardianRelationship =
  | "MOTHER"
  | "FATHER"
  | "STEP_PARENT"
  | "GRANDPARENT"
  | "SIBLING"
  | "UNCLE"
  | "AUNT"
  | "LEGAL_GUARDIAN"
  | "OTHER";

export type PreferredContactMethod = "PHONE" | "EMAIL" | "SMS";

/* ------------------- Guardian ------------------- */
export interface Guardian {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ------------------- StudentGuardianLink ------------------- */
export interface StudentGuardianLink {
  id: string;
  student: string;
  guardian: Guardian;

  /* --- Relationship / Role --- */
  relationship: GuardianRelationship;
  isPrimary?: boolean;
  isEmergencyContact?: boolean;
  hasPickupPermission?: boolean;
  hasLegalCustody?: boolean;
  preferredContactMethod?: PreferredContactMethod;

  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
