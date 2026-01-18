/**
 * Student interface matching backend apps/students/models.py
 * Uses snake_case to match API response fields
 */
export interface Student {
  id: string;
  admission_number: string;
  upi_number?: string;
  nemis_id?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  full_name: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  date_of_birth?: string;
  nationality?: string;
  county?: string;
  sub_county?: string;
  religion?: string;
  photo?: string;
  current_class?: string; // UUID of GradeLevel
  stream?: string;
  boarding_status?: "DAY" | "BOARDING" | "MIXED";
  special_needs?: string;
  admission_date?: string;
  graduation_date?: string | null;
  fee_balance?: number;
  scholarship?: boolean;
  bursary_amount?: number;
  status?: "ACTIVE" | "GRADUATED" | "TRANSFERRED" | "SUSPENDED" | "EXPELLED";
  notes?: string;
  created_at?: string;
  updated_at?: string;
  _offline?: boolean;
}