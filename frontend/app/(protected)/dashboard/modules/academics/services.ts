import api from "@/utils/api";

export type AcademicYear = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  terms: Term[];
  term_count: number;
  is_current?: boolean;
};

export type Term = {
  id: number;
  academic_year: number;
  name: string;
  start_date: string;
  end_date: string;
  order: number;
};

export type GradeLevel = {
  id: number;
  name: string;
  short_name?: string;
  order: number;
  code?: string;
  education_level: string;
  curriculum: number;
  curriculum_name?: string;
  sections: Section[];
  section_count: number;
  student_count: number;
};

export type Section = {
  id: number;
  grade_level: number;
  name: string;
  capacity?: number | null;
  is_active: boolean;
};

export type Subject = {
  id: number;
  name: string;
  code?: string;
  is_compulsory: boolean;
  is_active: boolean;
  department?: number | null;
};

export type Curriculum = {
  id: number;
  name: string;
  short_code?: string;
  is_active: boolean;
};

export async function fetchAcademicYears() {
  const { data } = await api.get("/academics/academic-years/");
  return (data.results ?? data) as AcademicYear[];
}

export async function createAcademicYear(payload: {
  name: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
}) {
  const { data } = await api.post("/academics/academic-years/", payload);
  return data as AcademicYear;
}

export async function activateAcademicYear(id: number) {
  const { data } = await api.post(`/academics/academic-years/${id}/activate/`);
  return data as AcademicYear;
}

export async function addTerm(yearId: number, payload: {
  name: string;
  start_date: string;
  end_date: string;
  order: number;
}) {
  const { data } = await api.post(`/academics/academic-years/${yearId}/add_term/`, payload);
  return data as Term;
}

export async function fetchGradeLevels() {
  const { data } = await api.get("/academics/grade-levels/");
  return (data.results ?? data) as GradeLevel[];
}

export async function createGradeLevel(payload: Record<string, unknown>) {
  const { data } = await api.post("/academics/grade-levels/", payload);
  return data as GradeLevel;
}

export async function createSection(payload: {
  grade_level: number;
  name: string;
  capacity?: number;
}) {
  const { data } = await api.post("/academics/sections/", payload);
  return data as Section;
}

export async function fetchSubjects() {
  const { data } = await api.get("/academics/subjects/");
  return (data.results ?? data) as Subject[];
}

export async function createSubject(payload: {
  name: string;
  code?: string;
  is_compulsory?: boolean;
}) {
  const { data } = await api.post("/academics/subjects/", payload);
  return data as Subject;
}

export async function fetchCurricula() {
  const { data } = await api.get("/academics/curricula/");
  return (data.results ?? data) as Curriculum[];
}

