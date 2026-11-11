"use client";

import { resolveMediaUrl } from "@/utils/media";

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
};

/** Official header for printable school documents (logo + identity + title). */
export function SchoolPrintHeader({
  school,
  fallback,
  documentTitle,
  subtitle,
  className = "",
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
  const logoSrc =
    resolveMediaUrl(rawLogo) ||
    (rawLogo && String(rawLogo).startsWith("http") ? String(rawLogo) : null);
  const contact = [address, phone, email].filter(Boolean).join(" · ");
  const monogram = (school?.short_name || name || "S")
    .toString()
    .trim()
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className={`text-center border-b border-slate-300 pb-4 mb-4 ${className}`}>
      <div className="flex justify-center mb-2">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt={`${name} logo`}
            className="h-16 sm:h-20 max-w-[180px] object-contain print:h-[72px]"
          />
        ) : (
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-lg font-bold text-slate-700 print:h-[72px] print:w-[72px]">
            {monogram}
          </div>
        )}
      </div>
      <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 uppercase">
        {name}
      </h1>
      {motto ? (
        <p className="text-xs italic text-slate-600 mt-0.5">&ldquo;{motto}&rdquo;</p>
      ) : null}
      {contact ? (
        <p className="text-[11px] sm:text-xs text-slate-600 mt-1 leading-snug">{contact}</p>
      ) : null}
      <p className="mt-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate-800">
        {documentTitle}
      </p>
      {subtitle ? <p className="text-xs text-slate-600 mt-1">{subtitle}</p> : null}
    </header>
  );
}

export default SchoolPrintHeader;
