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
  /** A4 reports use the largest logo; default is still enlarged for print. */
  variant?: "default" | "a4" | "compact";
};

/**
 * Official header for printable school documents.
 *
 * RULE: logo is always prepared for print — SVG preferred; raster logos
 * have solid/white backgrounds removed and are shown enlarged so they
 * dominate the heading without a boxy plate behind them.
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

  const logoClass =
    variant === "a4"
      ? "h-[96px] max-h-[96px] max-w-[240px] w-auto object-contain print:h-[100px] print:max-w-[260px]"
      : variant === "compact"
        ? "h-[64px] max-h-[64px] max-w-[160px] w-auto object-contain print:h-[72px]"
        : "h-[80px] max-h-[80px] max-w-[200px] w-auto object-contain print:h-[88px] print:max-w-[220px]";

  const monoClass =
    variant === "a4"
      ? "h-[96px] w-[96px] text-2xl"
      : variant === "compact"
        ? "h-[64px] w-[64px] text-lg"
        : "h-[80px] w-[80px] text-xl";

  return (
    <header
      className={`text-center border-b-2 border-slate-800 pb-3 mb-4 ${className}`}
    >
      <div className="flex justify-center mb-3 print:mb-3">
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
            ? "text-xl sm:text-2xl font-bold tracking-tight text-slate-900 uppercase leading-tight"
            : "text-lg sm:text-xl font-bold tracking-tight text-slate-900 uppercase"
        }
      >
        {name}
      </h1>
      {motto ? (
        <p className="text-xs italic text-slate-600 mt-0.5">&ldquo;{motto}&rdquo;</p>
      ) : null}
      {contact ? (
        <p className="text-[11px] sm:text-xs text-slate-600 mt-1 leading-snug max-w-xl mx-auto">
          {contact}
        </p>
      ) : null}
      <p
        className={
          variant === "a4"
            ? "mt-3 text-base font-bold uppercase tracking-[0.14em] text-slate-900"
            : "mt-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate-800"
        }
      >
        {documentTitle}
      </p>
      {subtitle ? (
        <p className="text-xs sm:text-sm text-slate-600 mt-1 font-medium">{subtitle}</p>
      ) : null}
    </header>
  );
}

export default SchoolPrintHeader;
