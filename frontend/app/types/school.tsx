// frontend/app/types/school.ts

export interface Module {
  id: number;
  name: string;
  code: string;
}

export interface School {
  id: string;
  owner: string;
  name: string;
  short_name?: string;
  email?: string;
  phone?: string;
  alternative_phone?: string;
  emergency_phone?: string;
  address?: string;
  postal_address?: string;
  city?: string;
  country?: string;
  website?: string;
  currency?: string;
  academic_year_start_month?: number;
  academic_year_end_month?: number;
  term_system?: string;
  number_of_terms?: number;
  grading_system?: string;
  passing_mark?: number;
  official_registration_number?: string;
  registration_authority?: string;
  registration_date?: string;
  logo?: string | null;
  module_ids?: number[];
  modules: Module[];
  setup_complete?: boolean;
}

// Optional: form-specific types
export interface SchoolContactFormData {
  phone: string;
  alternativePhone: string;
  emergencyPhone: string;
  email: string;
  website: string;
  address: string;
  postalAddress: string;
  city: string;
  country: string;
}