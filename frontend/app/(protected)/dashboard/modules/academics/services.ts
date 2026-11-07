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

export type GradeSubject = {
  id: number;
  grade_level: number;
  grade_level_name?: string;
  subject: number;
  subject_name?: string;
  subject_code?: string;
  is_compulsory: boolean;
  order: number;
};

export async function fetchGradeSubjects(gradeLevelId: number | string) {
  const { data } = await api.get("/academics/grade-subjects/", {
    params: { grade_level: gradeLevelId },
  });
  return (data.results ?? data) as GradeSubject[];
}

export async function assignSubjectToGrade(payload: {
  grade_level: number;
  subject: number;
  is_compulsory?: boolean;
  order?: number;
}) {
  const { data } = await api.post("/academics/grade-subjects/", payload);
  return data as GradeSubject;
}

export async function removeGradeSubject(id: number) {
  await api.delete(`/academics/grade-subjects/${id}/`);
}

export async function seedSubjectMap(replace = false) {
  const { data } = await api.post("/academics/grade-subjects/seed-defaults/", { replace });
  return data as { subjects: number; mapped: number; grades: number };
}

export async function mapDefaultSubjectsForGrade(gradeLevelId: number, replace = false) {
  const { data } = await api.post("/academics/grade-subjects/map-grade/", {
    grade_level: gradeLevelId,
    replace,
  });
  return data as { created: number; grade: string };
}

export async function rolloverAcademicYear(
  yearId: number,
  opts?: { name?: string; activate?: boolean }
) {
  const { data } = await api.post(`/academics/academic-years/${yearId}/rollover/`, {
    name: opts?.name,
    activate: opts?.activate !== false,
  });
  return data as {
    created: boolean;
    previous_year: AcademicYear;
    academic_year: AcademicYear;
  };
}

export async function promoteClass(payload: {
  grade_level_id: number;
  academic_year_id: number;
  action?: "PROMOTE" | "REPEAT" | "GRADUATE";
  target_grade_id?: number;
  carry_fees?: boolean;
  carry_term?: string;
}) {
  const { data } = await api.post("/students/promote-class/", payload);
  return data as {
    source_grade: string;
    processed: number;
    errors: { student_id: string; error: string }[];
    results: {
      student_id: string;
      action: string;
      grade?: string;
      arrears_amount?: string;
      arrears_invoice?: string;
    }[];
  };
}

export async function fetchStudentsByGrade(gradeLevelId: number) {
  const { data } = await api.get("/students/", {
    params: { current_class: gradeLevelId, page_size: 500 },
  });
  const list = data.results ?? data;
  return (Array.isArray(list) ? list : []) as {
    id: string;
    admission_number?: string;
    first_name?: string;
    last_name?: string;
    status?: string;
    current_class?: { id: number; name: string } | number;
  }[];
}


export async function assignStudentsToSection(payload: {
  grade_level_id: number;
  section_id: number;
  stream_id?: number;
  student_ids?: string[];
  only_unassigned?: boolean;
}) {
  const { data } = await api.post("/students/assign-section/", payload);
  return data as {
    grade: string;
    section: string;
    stream?: string | null;
    updated: number;
    only_unassigned: boolean;
  };
}

export type StaffMember = {
  id: string;
  full_name?: string;
  user_email?: string;
  role?: string;
};

export type SubjectTeacherAssignment = {
  id: number | string;
  subject: number | string;
  subject_name?: string;
  grade_level: number;
  grade_name?: string;
  teacher: string;
  teacher_name?: string;
  teacher_email?: string;
  academic_year: number;
  academic_year_name?: string;
  is_active?: boolean;
};

export type CoverageRow = {
  subject: number | string;
  subject_name: string;
  is_compulsory?: boolean;
  assigned: boolean;
  assignments: SubjectTeacherAssignment[];
};

export async function fetchTeachers(): Promise<StaffMember[]> {
  const { data } = await api.get("/staff/staff/", { params: { role: "TEACHER" } });
  const list = data.results ?? data;
  return (Array.isArray(list) ? list : []) as StaffMember[];
}

export async function syncTeachersFromUsers() {
  const { data } = await api.post("/staff/staff/sync-teachers/");
  return data as { created: number; existing: number; teachers: StaffMember[] };
}

export async function fetchSubjectTeachers(params: {
  academic_year?: number;
  grade_level?: number;
}) {
  const { data } = await api.get("/academics/subject-teachers/", { params });
  const list = data.results ?? data;
  return (Array.isArray(list) ? list : []) as SubjectTeacherAssignment[];
}

export async function fetchTeacherCoverage(params: {
  grade_level: number;
  academic_year?: number;
}) {
  const { data } = await api.get("/academics/subject-teachers/coverage/", { params });
  return data as {
    grade: { id: number; name: string };
    academic_year: { id: number; name: string } | null;
    total_subjects: number;
    assigned_subjects: number;
    unassigned_subjects: number;
    rows: CoverageRow[];
  };
}

export async function assignSubjectTeacher(payload: {
  subject: number | string;
  grade_level: number;
  teacher: string;
  academic_year: number;
  is_active?: boolean;
}) {
  const { data } = await api.post("/academics/subject-teachers/", payload);
  return data as SubjectTeacherAssignment;
}

export async function removeSubjectTeacher(id: number | string) {
  await api.delete(`/academics/subject-teachers/${id}/`);
}
