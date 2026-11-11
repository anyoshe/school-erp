"use client";

import { usePrintSchoolLogo } from "@/components/print/usePrintSchoolLogo";

export type SchoolPrintInfo = {
  name?: string | null;
  short_name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  motto?: string | null;
  logo?: string | null;
  logo_url?: string | null;
};

type Props = {
  school?: SchoolPrintInfo | null;
  fallback?: SchoolPrintInfo | null;
  documentTitle: string;
  subtitle?: string | null;
  className?: string;
  /** A4 reports use letterhead density; default is still enlarged for print. */
  variant?: "default" | "a4" | "compact";
};

/**
 * Official header for printable school documents.
 * Print: sits flush under the page margin like a letterhead.
 */
export function SchoolPrintHeader({
  school,
  fallback,
  documentTitle,
  subtitle,
  className = "",
  variant = "default",
}: Props) {
  const name = school?.name || fallback?.name || "School";
  const address = school?.address || fallback?.address || "";
  const phone = school?.phone || fallback?.phone || "";
  const email = school?.email || fallback?.email || "";
  const motto = school?.motto || fallback?.motto || "";
  const rawLogo =
    school?.logo ||
    school?.logo_url ||
    fallback?.logo ||
    fallback?.logo_url ||
    null;

  const logoSrc = usePrintSchoolLogo(rawLogo, [school?.name, fallback?.name]);

  const contact = [address, phone, email].filter(Boolean).join(" · ");
  const monogram = (school?.short_name || name || "S")
    .toString()
    .trim()
    .slice(0, 2)
    .toUpperCase();

  // Screen sizes; print sizes are forced via .school-print-header CSS
  const logoClass =
    variant === "a4"
      ? "school-print-logo h-[72px] max-h-[72px] max-w-[200px] w-auto object-contain"
      : variant === "compact"
        ? "school-print-logo h-[56px] max-h-[56px] max-w-[140px] w-auto object-contain"
        : "school-print-logo h-[68px] max-h-[68px] max-w-[180px] w-auto object-contain";

  const monoClass =
    variant === "a4"
      ? "school-print-logo h-[72px] w-[72px] text-xl"
      : variant === "compact"
        ? "school-print-logo h-[56px] w-[56px] text-base"
        : "school-print-logo h-[68px] w-[68px] text-lg";

  return (
    <header
      className={`school-print-header text-center border-b-2 border-slate-800 pb-2 mb-3 print:pb-1.5 print:mb-2 ${className}`}
    >
      <div className="flex justify-center mb-1.5 print:mb-1">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt={`${name} logo`}
            className={`${logoClass} bg-transparent`}
            style={{ background: "transparent" }}
          />
        ) : (
          <div
            className={`${monoClass} rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center font-bold text-slate-700`}
          >
            {monogram}
          </div>
        )}
      </div>
      <h1
        className={
          variant === "a4"
            ? "text-lg sm:text-xl font-bold tracking-tight text-slate-900 uppercase leading-tight print:text-[16pt]"
            : "text-base sm:text-lg font-bold tracking-tight text-slate-900 uppercase print:text-[14pt]"
        }
      >
        {name}
      </h1>
      {motto ? (
        <p className="text-[11px] italic text-slate-600 mt-0.5 print:text-[9pt] print:mt-0">
          &ldquo;{motto}&rdquo;
        </p>
      ) : null}
      {contact ? (
        <p className="text-[10px] sm:text-[11px] text-slate-600 mt-0.5 leading-snug max-w-xl mx-auto print:text-[8.5pt] print:mt-0">
          {contact}
        </p>
      ) : null}
      <p
        className={
          variant === "a4"
            ? "mt-2 text-sm font-bold uppercase tracking-[0.12em] text-slate-900 print:mt-1.5 print:text-[11pt]"
            : "mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-800 print:mt-1 print:text-[10pt]"
        }
      >
        {documentTitle}
      </p>
      {subtitle ? (
        <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 font-medium print:text-[9pt] print:mt-0">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

export default SchoolPrintHeader;
