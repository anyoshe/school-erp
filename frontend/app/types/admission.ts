// types/admission.ts
export interface Application {
  id: string;
  admission_number?: string;

  // Personal
  first_name: string;
  middle_name?: string;
  last_name: string;
  preferred_name?: string;
  gender?: string; // "MALE" | "FEMALE" | "OTHER" | ""
  date_of_birth?: string; // ISO date string
  nationality?: string;
  passport_number?: string;

  // Class
  class_applied?: { id: number | string; name: string; education_level?: string; pathway?: string };

  // Guardian
  primary_guardian_name?: string;
  primary_guardian_phone?: string;
  primary_guardian_email?: string;
  primary_guardian_relationship?: string;
  primary_guardian_id_number?: string;

  // Address (generalized)
  address?: string;
  region?: string;          // was county
  district?: string;        // was sub_county

  // Academic / Entry
  previous_school?: string;
  learner_id?: string;              // UPI / student number / national learner ID
  entry_exam_id?: string;           // national / entrance exam ID
  entry_exam_year?: number;
  placement_type?: "SELF" | "PUBLIC" | "TRANSFER" | "OTHER";

  // Interview Scheduling (already there)
  interview_date?: string | null;
  interview_time?: string | null;
  interview_venue?: string | null;
  interview_contact_person?: string | null;
  interview_instructions?: string | null;

  // NEW: Interview Completion Details
  interview_completed_at?: string | null;     // ISO datetime string
  interview_outcome?: "PASS" | "FAIL" | "WAITLIST" | "OTHER" | null;
  interview_score?: number | null;
  interview_comments?: string | null;
  interviewer_name?: string | null;

  // Health & Emergency
  blood_group?: string;
  allergies?: string;
  chronic_conditions?: string;
  disability?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_relationship?: string;

  // Primary-specific (optional)
  birth_certificate_number?: string;
  immunization_status?: string;

  // Misc
  religion?: string;
  category?: string;
  photo?: string; // URL if already uploaded
  notes?: string;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "TEST_SCHEDULED" | "OFFERED" | "ACCEPTED" | "REJECTED" | "ENROLLED";
  submitted_at?: string;
  admission_date?: string;

  // Relations
  documents?: Array<{ id: string; file: string; description?: string; uploaded_at: string }>;
  fee_payments?: Array<{ id: string; amount: number; payment_date: string; payment_method?: string; receipt_number?: string }>;
  student?: { id: string; full_name: string };
  school: string | {
    id: string;
    name: string;
    contact_email?: string;
    contact_phone?: string;
    short_name?: string;
    email?: string;
    phone?: string;
    alternative_phone?: string;
    emergency_phone?: string;
    postal_address?: string;
    address?: string;
    city?: string;
    country?: string;
    website?: string;
    logo?: string;
  };// can be ID or object
}

export type ApplicationStatus = Application['status'];