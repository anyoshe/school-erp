// types/admission.ts
export interface Application {
  id: string;
  admission_number?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  preferred_name?: string;
  gender?: string;
  date_of_birth?: string; // ISO date string
  class_applied?: { id: number; name: string }; // from GradeLevelSerializer
  primary_guardian_name?: string;
  primary_guardian_phone?: string;
  primary_guardian_email?: string;
  primary_guardian_relationship?: string;
  address?: string;
  county?: string;
  sub_county?: string;
  previous_school?: string;
  nationality?: string;
  passport_number?: string;
  religion?: string;
  category?: string;
  status: string; // DRAFT | SUBMITTED | ... | ENROLLED
  submitted_at?: string;
  admission_date?: string;
  notes?: string;
  documents: { id: string; file: string; description?: string; uploaded_at: string }[];
  fee_payments: { id: string; amount: number; payment_date: string; payment_method?: string; receipt_number?: string }[];
  student?: { id: string; full_name: string }; // minimal
  school: string;
}

export type ApplicationStatus = Application['status'];