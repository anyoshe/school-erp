export interface MedicalRecord {
  id: string;

  // Emergency & Risk
  bloodGroup?: string;
  allergies?: string;
  chronicConditions?: string;
  specialNeeds?: string;
  medication?: string;
  medicationInstructions?: string;
  emergencyNotes?: string;
  emergencyDoctor?: string;
  preferredHospital?: string;


  // Immunization
  immunizationStatus?: "UP_TO_DATE" | "PARTIAL" | "NOT_IMMUNIZED";
  immunizationNotes?: string;
  immunizationCard?: File | null;

  // Consent
  consentToTreat?: boolean;
  medicalDisclosureAllowed?: boolean;
  consentDate?: string;
  consentBy?: string; // Guardian ID

  // Audit
  recordedBy?: string; // User ID
  reviewedBy?: string; // User ID
  reviewDate?: string;
  documents?: { id: string; name: string; url: string }[];
  // Frontend-only
  statusBadges?: string[];

  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}
