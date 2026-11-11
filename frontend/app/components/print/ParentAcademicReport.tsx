"use client";

import { SchoolPrintHeader } from "@/components/print/SchoolPrintHeader";

type Entry = {
  assessment?: string;
  kind?: string;
  percentage?: number | null;
  score?: number | null;
  max_score?: number | null;
  grade_letter?: string | null;
};

type SubjectRow = {
  subject_id?: string;
  name?: string;
  subject_name?: string;
  average?: number | null;
  grade_label?: string | null;
  grade_letter?: string | null;
  grade?: string | null;
  grade_descriptor?: string | null;
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
  overall_grade_descriptor?: string | null;
  position?: string | number | null;
  class_position?: string | number | null;
  out_of?: string | number | null;
  subjects_with_marks?: number | null;
  overall_marks_total?: number | null;
  overall_marks_max?: number | null;
  class_teacher_comment?: string | null;
  head_teacher_comment?: string | null;
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

function gradingLegend(system?: string): { code: string; meaning: string }[] {
  const s = (system || "percentage").toLowerCase();
  if (s.includes("cbc") || s.includes("competenc") || s.includes("kjsea")) {
    return [
      { code: "EE1–EE2", meaning: "Exceeding Expectations" },
      { code: "ME1–ME2", meaning: "Meeting Expectations" },
      { code: "AE1–AE2", meaning: "Approaching Expectations" },
      { code: "BE1–BE2", meaning: "Below Expectations" },
    ];
  }
  if (s.includes("mastery")) {
    return [
      { code: "Mastery", meaning: "80%+" },
      { code: "Approaching", meaning: "60–79%" },
      { code: "Beginning", meaning: "Below 60%" },
    ];
  }
  return [
    { code: "A", meaning: "80–100%" },
    { code: "B", meaning: "70–79%" },
    { code: "C", meaning: "60–69%" },
    { code: "D", meaning: "50–59%" },
    { code: "E", meaning: "Below 50%" },
  ];
}

type Props = {
  data: ParentReportData;
  learnerName?: string;
  admissionNumber?: string;
  gradeLabel?: string;
  sectionLabel?: string;
};

/** Shared A4 academic report form (staff academics + parent portal). */
export function AcademicReportForm({
  data,
  learnerName,
  admissionNumber,
  gradeLabel,
  sectionLabel,
}: Props) {
  const subjects = data.subjects || [];
  const columns = collectAssessmentColumns(subjects);
  const name =
    learnerName ||
    data.student?.full_name ||
    [data.student?.first_name, data.student?.last_name].filter(Boolean).join(" ") ||
    "Learner";
  const adm = admissionNumber || data.student?.admission_number || "—";
  const grade = data.grade?.name || gradeLabel || "—";
  const section = data.section?.name || sectionLabel || "";
  const year = data.academic_year?.name || "—";
  const term = data.term?.name || "—";
  const position = data.position ?? data.class_position;
  const outOf = data.out_of;
  const school = data.school || {};
  const gsys = school.grading_system || "percentage";
  const legend = gradingLegend(gsys);
  const withMarks = subjects.filter((s) => s.average != null);
  const totalAvgSum = withMarks.reduce((a, s) => a + Number(s.average || 0), 0);
  const totalPossible = withMarks.length * 100;
  const subtitle = `${term} · ${year}${grade !== "—" ? ` · ${grade}` : ""}${
    section ? ` · ${section}` : ""
  }`;

  return (
    <div className="parent-report-a4 mx-auto bg-white text-slate-900 shadow-sm border border-slate-200 print:shadow-none print:border-0">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          body * {
            visibility: hidden;
          }
          .parent-report-a4,
          .parent-report-a4 * {
            visibility: visible;
          }
          .parent-report-a4 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: none !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
        .parent-report-a4 {
          max-width: 210mm;
          padding: 16px 20px 24px;
          font-size: 12px;
          line-height: 1.35;
        }
        .parent-report-a4 .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px 20px;
          margin: 12px 0 14px;
          font-size: 12px;
        }
        .parent-report-a4 .meta-grid .lab {
          color: #64748b;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .parent-report-a4 .meta-grid .val {
          font-weight: 600;
          color: #0f172a;
        }
        .parent-report-a4 .summary-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin: 10px 0 14px;
        }
        .parent-report-a4 .summary-strip > div {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 10px;
          text-align: center;
          background: #f8fafc;
        }
        .parent-report-a4 .summary-strip .lab {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
        }
        .parent-report-a4 .summary-strip .val {
          font-size: 16px;
          font-weight: 700;
          margin-top: 2px;
        }
        .parent-report-a4 .summary-strip .sub {
          font-size: 10px;
          color: #475569;
          margin-top: 2px;
        }
        .parent-report-a4 table.marks {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        .parent-report-a4 table.marks th,
        .parent-report-a4 table.marks td {
          border: 1px solid #94a3b8;
          padding: 5px 6px;
          vertical-align: middle;
        }
        .parent-report-a4 table.marks th {
          background: #f1f5f9;
          font-weight: 700;
          text-align: center;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .parent-report-a4 table.marks td.subj {
          text-align: left;
          font-weight: 600;
        }
        .parent-report-a4 table.marks td.num {
          text-align: center;
          font-variant-numeric: tabular-nums;
        }
        .parent-report-a4 table.marks tfoot td {
          font-weight: 700;
          background: #f8fafc;
        }
        .parent-report-a4 .legend {
          margin-top: 12px;
          font-size: 10px;
          color: #475569;
        }
        .parent-report-a4 .legend strong {
          color: #0f172a;
        }
        .parent-report-a4 .signs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          margin-top: 28px;
          font-size: 11px;
        }
        .parent-report-a4 .signs .line {
          border-top: 1px solid #334155;
          margin-top: 28px;
          padding-top: 4px;
        }
        @media (max-width: 640px) {
          .parent-report-a4 .summary-strip {
            grid-template-columns: 1fr 1fr;
          }
          .parent-report-a4 .meta-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <SchoolPrintHeader
        school={school}
        documentTitle="Academic Report Form"
        subtitle={subtitle}
        variant="a4"
      />

      <div className="meta-grid">
        <div>
          <div className="lab">Learner</div>
          <div className="val">{name}</div>
        </div>
        <div>
          <div className="lab">Admission number</div>
          <div className="val">{adm}</div>
        </div>
        <div>
          <div className="lab">Class / grade</div>
          <div className="val">
            {grade}
            {section ? ` · ${section}` : ""}
          </div>
        </div>
        <div>
          <div className="lab">Academic period</div>
          <div className="val">
            {term} · {year}
          </div>
        </div>
        <div>
          <div className="lab">Class teacher</div>
          <div className="val">{data.class_teacher_name || "—"}</div>
        </div>
        <div>
          <div className="lab">Subjects with marks</div>
          <div className="val">
            {data.subjects_with_marks ?? withMarks.length}
            {subjects.length ? ` of ${subjects.length}` : ""}
          </div>
        </div>
      </div>

      <div className="summary-strip">
        <div>
          <div className="lab">Overall marks</div>
          <div className="val">
            {data.overall_marks_total != null && data.overall_marks_max
              ? `${data.overall_marks_total}/${data.overall_marks_max}`
              : withMarks.length > 0
                ? `${Math.round(totalAvgSum * 10) / 10}/${totalPossible}`
                : "—"}
          </div>
          <div className="sub">
            {data.overall_average != null ? `Average ${data.overall_average}%` : "—"}
          </div>
        </div>
        <div>
          <div className="lab">Overall grade</div>
          <div className="val">{data.overall_grade || "—"}</div>
          {data.overall_grade_descriptor ? (
            <div className="sub">{data.overall_grade_descriptor}</div>
          ) : null}
        </div>
        <div>
          <div className="lab">Class position</div>
          <div className="val">
            {position != null && position !== "" ? String(position) : "—"}
            {outOf != null && outOf !== "" ? (
              <span style={{ fontSize: 12, fontWeight: 500, color: "#475569" }}>
                {" "}
                / {outOf}
              </span>
            ) : null}
          </div>
        </div>
        <div>
          <div className="lab">Grading scale</div>
          <div className="val" style={{ fontSize: 13 }}>
            {String(gsys).toUpperCase().includes("CBC") ||
            String(gsys).toLowerCase().includes("competenc")
              ? "CBC"
              : String(gsys).replace(/_/g, " ")}
          </div>
        </div>
      </div>

      {subjects.length === 0 ? (
        <p className="text-sm text-slate-600 py-6 text-center">
          No marks have been published for this term yet.
        </p>
      ) : (
        <table className="marks">
          <thead>
            <tr>
              <th style={{ textAlign: "left", minWidth: 100 }}>Subject</th>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
              <th>Average %</th>
              <th>Grade</th>
              <th style={{ textAlign: "left" }}>Teacher</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => {
              const subj = s.subject_name || s.name || "—";
              const gradeCode = s.grade_label || s.grade_letter || s.grade || "—";
              return (
                <tr key={s.subject_id || subj}>
                  <td className="subj">{subj}</td>
                  {columns.map((c) => (
                    <td key={c} className="num">
                      {entryPct(s, c)}
                    </td>
                  ))}
                  <td className="num">
                    {s.average != null ? String(s.average) : "—"}
                  </td>
                  <td className="num" title={s.grade_descriptor || undefined}>
                    {gradeCode}
                  </td>
                  <td style={{ fontSize: 10 }}>{s.teacher_name || "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="subj">Overall</td>
              {columns.map((c) => (
                <td key={c} className="num">
                  —
                </td>
              ))}
              <td className="num">
                {data.overall_marks_total != null && data.overall_marks_max
                  ? `${data.overall_marks_total}/${data.overall_marks_max}`
                  : withMarks.length > 0
                    ? `${Math.round(totalAvgSum * 10) / 10}/${totalPossible}`
                    : data.overall_average != null
                      ? `${data.overall_average}%`
                      : "—"}
              </td>
              <td className="num">{data.overall_grade || "—"}</td>
              <td>
                {position != null && position !== ""
                  ? `Pos. ${position}${outOf != null ? ` / ${outOf}` : ""}`
                  : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      <div className="legend">
        <strong>Grading key: </strong>
        {legend.map((item, i) => (
          <span key={item.code}>
            {i > 0 ? " · " : ""}
            <strong>{item.code}</strong> — {item.meaning}
          </span>
        ))}
        {school.passing_mark != null ? (
          <span>
            {" "}
            · Passing mark: <strong>{school.passing_mark}%</strong>
          </span>
        ) : null}
      </div>

      <div className="comments-block" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#475569", marginBottom: 4 }}>
            Class teacher&apos;s comment
          </div>
          <div
            style={{
              minHeight: 52,
              border: "1px solid #94a3b8",
              borderRadius: 6,
              padding: "8px 10px",
              background: "#fff",
              whiteSpace: "pre-wrap",
            }}
          >
            {data.class_teacher_comment || "\u00a0"}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11 }}>
            <span>
              <strong>Name:</strong> {data.class_teacher_name || "________________"}
            </span>
            <span>
              <strong>Sign / date:</strong> ______________
            </span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#475569", marginBottom: 4 }}>
            Head teacher&apos;s comment
          </div>
          <div
            style={{
              minHeight: 52,
              border: "1px solid #94a3b8",
              borderRadius: 6,
              padding: "8px 10px",
              background: "#fff",
              whiteSpace: "pre-wrap",
            }}
          >
            {data.head_teacher_comment || "\u00a0"}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11 }}>
            <span>
              <strong>Name:</strong> ________________
            </span>
            <span>
              <strong>Sign / stamp:</strong> ______________
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}



/** @deprecated use AcademicReportForm — kept for parent portal imports */
export const ParentAcademicReport = AcademicReportForm;
export default AcademicReportForm;
