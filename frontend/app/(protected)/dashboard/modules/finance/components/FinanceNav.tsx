"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export const FINANCE_NAV_LINKS = [
  { href: "/dashboard/modules/finance", label: "Dashboard", exact: true },
  { href: "/dashboard/modules/finance/clearance", label: "Clearance" },
  { href: "/dashboard/modules/finance/payments", label: "Record payment" },
  { href: "/dashboard/modules/finance/receipts", label: "Receipts" },
  { href: "/dashboard/modules/finance/invoices", label: "Invoices" },
  { href: "/dashboard/modules/finance/fee-structures", label: "Fee structures" },
  { href: "/dashboard/modules/finance/standing", label: "P&L" },
  { href: "/dashboard/modules/finance/reconcile", label: "Reconcile" },
  { href: "/dashboard/modules/finance/expenses", label: "Expenses" },
  { href: "/dashboard/modules/finance/bills", label: "Bills" },
  { href: "/dashboard/modules/finance/income-receipts", label: "Pre-enroll income" },
] as const;

export function FinanceNavLinks() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const linkClass = (href: string, exact?: boolean) => {
    const active = exact
      ? pathname === href
      : pathname === href || (pathname?.startsWith(href + "/") ?? false) || pathname === href;
    // For non-exact, avoid marking Dashboard active on every sub-route
    const isActive = exact
      ? pathname === href
      : Boolean(
          pathname === href ||
            (href !== "/dashboard/modules/finance" && pathname?.startsWith(href))
        );
    return [
      "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition no-underline",
      isActive
        ? "bg-teal-700 text-white shadow-sm"
        : "text-slate-700 hover:bg-teal-50 hover:text-teal-900",
    ].join(" ");
  };

  return (
    <nav className="sticky top-0 z-10 mb-5 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-md shadow-sm supports-[backdrop-filter]:bg-white/90">
      <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4">
        <Link
          href="/dashboard/modules/finance"
          className="min-w-0 no-underline hover:opacity-90"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
            Finance
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            Dashboard · collect · bill · report
          </p>
        </Link>

        <div className="hidden md:flex flex-wrap items-center justify-end gap-1">
          {FINANCE_NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={linkClass(l.href, "exact" in l ? Boolean((l as any).exact) : false)}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <button
          type="button"
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-800 hover:bg-teal-50 hover:text-teal-900"
          aria-label={open ? "Close finance menu" : "Open finance menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="md:hidden border-t border-slate-100 bg-slate-50/80 px-2 py-2">
          <ul className="flex flex-col gap-0.5">
            {FINANCE_NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`block ${linkClass(l.href, "exact" in l ? Boolean((l as any).exact) : false)}`}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
