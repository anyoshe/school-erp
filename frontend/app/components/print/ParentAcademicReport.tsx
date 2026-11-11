"use client";

import { SchoolPrintHeader } from "@/components/print/SchoolPrintHeader";

type Entry = {
  assessment?: string;
  kind?: string;
  percentage?: number | null;
  score?: number | null;
  max_score?: number | null;
};

type SubjectRow = {
  subject_id?: string;
  name?: string;
  subject_name?: string;
  average?: number | null;
  grade_label?: string | null;
  grade_letter?: string | null;
  grade?: string | null;
  teacher_name?: string | null;
  entries?: Entry[];
};

export type ParentReportData = {
  school?: any;
  student?: {
    full_name?: string;
    admission_number?: string;
    first_name?: string;
    last_name?: string;
  };
  academic_year?: { name?: string } | null;
  term?: { name?: string } | null;
  grade?: { name?: string } | null;
  section?: { name?: string } | null;
  class_teacher_name?: string | null;
  subjects?: SubjectRow[];
  overall_average?: number | null;
  overall_grade?: string | null;
  position?: string | number | null;
  class_position?: string | number | null;
  subjects_with_marks?: number | null;
};

function collectAssessmentColumns(subjects: SubjectRow[]): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const s of subjects) {
    for (const e of s.entries || []) {
      const label = (e.assessment || e.kind || "").trim();
      if (!label || seen.has(label.toLowerCase())) continue;
      seen.add(label.toLowerCase());
      order.push(label);
    }
  }
  const rank = (n: string) => {
    const u = n.toUpperCase();
    if (u.includes("CAT 1") || u.includes("CAT1")) return 1;
    if (u.includes("CAT 2") || u.includes("CAT2")) return 2;
    if (u.includes("CAT 3") || u.includes("CAT3")) return 3;
    if (u.includes("PRACT")) return 4;
    if (u.includes("END") || u.includes("EXAM") || u.includes("FINAL")) return 5;
    return 10;
  };
  return order.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function entryPct(subject: SubjectRow, col: string): string {
  const hit = (subject.entries || []).find(
    (e) => (e.assessment || e.kind || "").trim().toLowerCase() === col.toLowerCase()
  );
  if (!hit || hit.percentage == null || Number.isNaN(Number(hit.percentage))) return "—";
  return String(Math.round(Number(hit.percentage) * 10) / 10);
}

type Props = {
  data: ParentReportData;
  learnerName?: string;
  admissionNumber?: string;
  gradeLabel?: string;
  sectionLabel?: string;
};

/** A4-oriented academic report form for the parent portal. */
export function ParentAcademicReport({
  data,
  learnerName,
  admissionNumber,
  gradeLabel,
  sectionLabel,
}: Props) {
  const subjects = data.subjects || [];
  const columns = collectAssessmentColumns(subjects);
  const showBreakdown = columns.length > 0 && columns.length <= 6;
  const period = [data.academic_year?.name, data.term?.name].filter(Boolean).join(" · ");
  const classLine = [
    data.grade?.name || gradeLabel,
    data.section?.name || sectionLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  const name =
    data.student?.full_name ||
    learnerName ||
    `${data.student?.first_name || ""} ${data.student?.last_name || ""}`.trim() ||
    "—";
  const adm = data.student?.admission_number || admissionNumber || "—";
  const position = data.position ?? data.class_position;

  return (
    <article className="parent-a4-report print-document">
      <style dangerouslySetInnerHTML={{ __html: '\n@media print {\n  @page { size: A4 portrait; margin: 12mm 14mm; }\n  .parent-a4-report {\n    width: 100% !important;\n    max-width: none !important;\n    min-height: auto !important;\n    box-shadow: none !important;\n    border: none !important;\n    border-radius: 0 !important;\n    padding: 0 !important;\n    margin: 0 !important;\n  }\n}\n.parent-a4-report {\n  width: 210mm;\n  max-width: 100%;\n  min-height: 297mm;\n  margin: 0 auto;\n  padding: 16px 18px 20px;\n  box-sizing: border-box;\n  border: 1px solid #e2e8f0;\n  border-radius: 12px;\n  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);\n  background: #fff;\n  color: #0f172a;\n}\n.parent-a4-report .meta-grid {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 6px 20px;\n  border: 1px solid #cbd5e1;\n  border-radius: 8px;\n  padding: 10px 12px;\n  margin-bottom: 14px;\n  font-size: 12px;\n}\n.parent-a4-report .meta-grid .lbl {\n  color: #64748b;\n  font-size: 10px;\n  text-transform: uppercase;\n  letter-spacing: 0.04em;\n  display: block;\n  margin-bottom: 1px;\n}\n.parent-a4-report .meta-grid .val {\n  font-weight: 600;\n  color: #0f172a;\n}\n.parent-a4-report table.marks {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 11.5px;\n}\n.parent-a4-report table.marks th {\n  background: #f1f5f9;\n  border: 1px solid #94a3b8;\n  padding: 6px 5px;\n  text-align: left;\n  font-size: 10px;\n  text-transform: uppercase;\n  letter-spacing: 0.03em;\n  color: #334155;\n}\n.parent-a4-report table.marks th.num,\n.parent-a4-report table.marks td.num {\n  text-align: center;\n  font-variant-numeric: tabular-nums;\n}\n.parent-a4-report table.marks td {\n  border: 1px solid #cbd5e1;\n  padding: 5px 5px;\n  vertical-align: middle;\n}\n.parent-a4-report table.marks tfoot td {\n  background: #f8fafc;\n  font-weight: 700;\n  border-top: 2px solid #64748b;\n}\n.parent-a4-report .summary-strip {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 8px;\n  margin: 12px 0 14px;\n}\n.parent-a4-report .summary-strip .cell {\n  border: 1px solid #cbd5e1;\n  border-radius: 8px;\n  padding: 8px 10px;\n  text-align: center;\n}\n.parent-a4-report .summary-strip .cell .lbl {\n  font-size: 10px;\n  text-transform: uppercase;\n  letter-spacing: 0.04em;\n  color: #64748b;\n}\n.parent-a4-report .summary-strip .cell .val {\n  font-size: 16px;\n  font-weight: 700;\n  margin-top: 2px;\n}\n.parent-a4-report .signs {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 24px;\n  margin-top: 28px;\n  font-size: 11px;\n  color: #475569;\n}\n.parent-a4-report .signs .line {\n  border-top: 1px solid #64748b;\n  margin-top: 28px;\n  padding-top: 4px;\n}\n.parent-a4-report .doc-foot {\n  margin-top: 18px;\n  padding-top: 8px;\n  border-top: 1px solid #e2e8f0;\n  font-size: 9.5px;\n  color: #94a3b8;\n  text-align: center;\n}\n@media (max-width: 640px) {\n  .parent-a4-report {\n    width: 100%;\n    min-height: auto;\n    padding: 14px;\n  }\n  .parent-a4-report .meta-grid,\n  .parent-a4-report .summary-strip,\n  .parent-a4-report .signs {\n    grid-template-columns: 1fr;\n  }\n}\n' }} />

      <SchoolPrintHeader
        school={data.school}
        documentTitle="Academic Report Form"
        subtitle={period || null}
        variant="a4"
      />

      <div className="meta-grid">
        <div>
          <span className="lbl">Learner</span>
          <span className="val">{name}</span>
        </div>
        <div>
          <span className="lbl">Admission number</span>
          <span className="val">{adm}</span>
        </div>
        <div>
          <span className="lbl">Class / grade</span>
          <span className="val">{classLine || "—"}</span>
        </div>
        <div>
          <span className="lbl">Class teacher</span>
          <span className="val">{data.class_teacher_name || "—"}</span>
        </div>
      </div>

      <div className="summary-strip">
        <div className="cell">
          <div className="lbl">Overall average</div>
          <div className="val">
            {data.overall_average != null ? `${data.overall_average}%` : "—"}
          </div>
        </div>
        <div className="cell">
          <div className="lbl">Overall grade</div>
          <div className="val">{data.overall_grade || "—"}</div>
        </div>
        <div className="cell">
          <div className="lbl">Position</div>
          <div className="val">
            {position != null && position !== "" ? String(position) : "—"}
          </div>
        </div>
      </div>

      <table className="marks">
        <thead>
          <tr>
            <th style={{ width: showBreakdown ? "22%" : "36%" }}>Subject</th>
            {showBreakdown
              ? columns.map((c) => (
                  <th key={c} className="num">
                    {c}
                  </th>
                ))
              : null}
            <th className="num" style={{ width: "12%" }}>
              Avg %
            </th>
            <th className="num" style={{ width: "10%" }}>
              Grade
            </th>
            <th style={{ width: "18%" }}>Teacher</th>
          </tr>
        </thead>
        <tbody>
          {subjects.length === 0 ? (
            <tr>
              <td
                colSpan={(showBreakdown ? columns.length : 0) + 4}
                style={{ textAlign: "center", padding: "20px", color: "#64748b" }}
              >
                Marks have not been entered for this term yet.
              </td>
            </tr>
          ) : (
            subjects.map((s, i) => (
              <tr key={s.subject_id || s.name || i}>
                <td style={{ fontWeight: 600 }}>{s.subject_name || s.name || "—"}</td>
                {showBreakdown
                  ? columns.map((c) => (
                      <td key={c} className="num">
                        {entryPct(s, c)}
                      </td>
                    ))
                  : null}
                <td className="num">{s.average != null ? `${s.average}` : "—"}</td>
                <td className="num" style={{ fontWeight: 700 }}>
                  {s.grade_label || s.grade_letter || s.grade || "—"}
                </td>
                <td style={{ fontSize: "10.5px", color: "#475569" }}>
                  {s.teacher_name || "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {subjects.length > 0 ? (
          <tfoot>
            <tr>
              <td>Overall</td>
              {showBreakdown
                ? columns.map((c) => (
                    <td key={c} className="num">
                      —
                    </td>
                  ))
                : null}
              <td className="num">
                {data.overall_average != null ? `${data.overall_average}` : "—"}
              </td>
              <td className="num">{data.overall_grade || "—"}</td>
              <td style={{ fontWeight: 500, fontSize: "10.5px" }}>
                {data.subjects_with_marks ? `${data.subjects_with_marks} subject(s)` : ""}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>

      <div className="signs">
        <div>
          <p style={{ fontWeight: 600, color: "#0f172a", margin: 0 }}>Class teacher</p>
          <p style={{ margin: "6px 0 0", fontSize: "11px" }}>
            {data.class_teacher_name || "Name: ____________________________"}
          </p>
          <div className="line">Signature &amp; date</div>
        </div>
        <div>
          <p style={{ fontWeight: 600, color: "#0f172a", margin: 0 }}>
            Head teacher / Principal
          </p>
          <p style={{ margin: "6px 0 0", fontSize: "11px" }}>
            Name: ____________________________
          </p>
          <div className="line">Signature &amp; date · School stamp</div>
        </div>
      </div>

      <p className="doc-foot">
        Official academic report · {data.school?.name || "School"}
        {period ? ` · ${period}` : ""} · Parent portal copy
      </p>
    </article>
  );
}

export default ParentAcademicReport;
