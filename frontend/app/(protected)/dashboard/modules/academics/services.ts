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
  is_current?: boolean;
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
  student_count?: number;
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

export async function activateAcademicYear(id: number, opts?: { seed_terms?: boolean }) {
  const { data } = await api.post(`/academics/academic-years/${id}/activate/`, {
    seed_terms: opts?.seed_terms !== false,
  });
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
  const { data } = await api.post("/academics/sections/", {
    ...payload,
    is_active: true,
  });
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


export type CurriculumTemplate = {
  id: number;
  name: string;
  short_code?: string;
  description?: string;
  is_active: boolean;
};

export async function fetchCurriculumTemplates() {
  const { data } = await api.get("/academics/curriculum-templates/");
  return (data.results ?? data) as CurriculumTemplate[];
}

/** Clone a global template (CBC, 8-4-4, etc.) into this school with its grade levels */
export async function adoptCurriculumTemplate(templateId: number) {
  const { data } = await api.post("/academics/copy-template/", {
    template_id: templateId,
  });
  return data;
}

export async function setCurrentTerm(termId: number) {
  const { data } = await api.post(`/academics/terms/${termId}/set-current/`);
  return data as Term;
}

export async function seedDefaultTerms(yearId: number) {
  const { data } = await api.post(`/academics/academic-years/${yearId}/seed-terms/`);
  return data;
}

export async function fetchCurrentCalendar() {
  const { data } = await api.get("/academics/current-calendar/");
  return data as {
    year_label: string;
    term_label: string;
    academic_year: AcademicYear | null;
    current_term: Term | null;
    terms: Term[];
  };
}

export type ClassRegisterStudent = {
  id: string;
  admission_number: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  full_name: string;
  gender: string;
  status: string;
  section_id?: string | null;
  section_name?: string | null;
  admission_date?: string | null;
};

export async function fetchClassRegister(params: {
  grade_level: number | string;
  section?: number | string | null;
}) {
  const { data } = await api.get("/academics/class-register/", {
    params: {
      grade_level: params.grade_level,
      ...(params.section ? { section: params.section } : {}),
    },
  });
  return data as {
    grade: { id: number; name: string };
    section: { id: number; name: string; capacity?: number } | null;
    count: number;
    students: ClassRegisterStudent[];
  };
}

export async function ensureGradeSections(
  gradeId: number,
  names: string[] = ["A"],
  capacity?: number
) {
  const { data } = await api.post(`/academics/grade-levels/${gradeId}/ensure-sections/`, {
    names,
    capacity,
  });
  return data;
}

export async function createSectionFull(payload: {
  grade_level: number;
  name: string;
  capacity?: number;
}) {
  const { data } = await api.post("/academics/sections/", payload);
  return data as Section;
}
