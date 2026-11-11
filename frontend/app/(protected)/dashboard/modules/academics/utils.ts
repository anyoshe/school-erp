export type Tab =
  | "overview"
  | "years"
  | "classes"
  | "subjects"
  | "teachers"
  | "marks"
  | "report-cards"
  | "promotion"
  | "progress";


export function getApiErrorDetail(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("response" in error)) return;
  const response = error.response;
  if (typeof response !== "object" || response === null || !("data" in response)) return;
  const data = response.data;
  if (typeof data !== "object" || data === null || !("detail" in data)) return;
  return typeof data.detail === "string" ? data.detail : undefined;
}

/** Stable tab list (module scope) — avoids SSR/client icon identity mismatches. */
export const EMPTY_LIST: never[] = [];

export function gradeLabelFor(
  average: number | null,
  gradingSystem: string,
  passingMark: number
) {
  if (average == null) return "—";
  const system = gradingSystem.toLowerCase();
  if (["cbc", "competency", "competency_based", "kjsea"].includes(system)) {
    if (average >= 90) return "EE1";
    if (average >= 75) return "EE2";
    if (average >= 58) return "ME1";
    if (average >= 41) return "ME2";
    if (average >= 31) return "AE1";
    if (average >= 21) return "AE2";
    if (average >= 11) return "BE1";
    return "BE2";
  }
  if (system === "mastery") {
    if (average >= 80) return "Mastery";
    if (average >= 60) return "Approaching";
    return "Beginning";
  }
  if (["pass_fail", "pass/fail", "passfail"].includes(system)) {
    return average >= passingMark ? "Pass" : "Fail";
  }
  if (average >= 80) return "A";
  if (average >= 70) return "B";
  if (average >= 60) return "C";
  if (average >= 50) return "D";
  return "E";
}

export const ACADEMICS_TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Structure Map" },
  { id: "years", label: "Years & Terms" },
  { id: "classes", label: "Classes" },
  { id: "subjects", label: "Subjects" },
  { id: "teachers", label: "Teachers" },
  { id: "marks", label: "Marks entry" },
  { id: "report-cards", label: "Report cards" },
  { id: "progress", label: "Learner progress" },
  { id: "promotion", label: "Promotion" },
];

