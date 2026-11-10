"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export const FINANCE_NAV_LINKS = [
  { href: "/dashboard/modules/finance", label: "Dashboard", exact: true },
  { href: "/dashboard/modules/finance/returning", label: "Returning billing" },
  { href: "/dashboard/modules/finance/clearance", label: "Clearance" },
  { href: "/dashboard/modules/finance/payments", label: "Payments" },
  { href: "/dashboard/modules/finance/receipts", label: "Receipts" },
  { href: "/dashboard/modules/finance/invoices", label: "Invoices" },
  { href: "/dashboard/modules/finance/fee-structures", label: "Structures" },
  { href: "/dashboard/modules/finance/standing", label: "P&L" },
  { href: "/dashboard/modules/finance/reconcile", label: "Reconcile" },
  { href: "/dashboard/modules/finance/expenses", label: "Expenses" },
  { href: "/dashboard/modules/finance/meals", label: "Meals" },
  { href: "/dashboard/modules/finance/bills", label: "Bills" },
  { href: "/dashboard/modules/finance/income-receipts", label: "Pre-enroll" },
] as const;

export function FinanceNavLinks() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    if (href === "/dashboard/modules/finance") return pathname === href;
    return Boolean(pathname === href || pathname?.startsWith(href + "/") || pathname?.startsWith(href));
  };

  const linkClass = (href: string, exact?: boolean) =>
    [
      "shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] font-medium transition no-underline",
      isActive(href, exact)
        ? "bg-teal-700 text-white shadow-sm"
        : "text-slate-700 hover:bg-teal-50 hover:text-teal-900",
    ].join(" ");

  return (
    <nav className="sticky top-0 z-10 mb-5 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-md shadow-sm supports-[backdrop-filter]:bg-white/90">
      {/* Single row: brand + scrollable links (desktop) / hamburger (mobile) */}
      <div className="flex h-12 items-center gap-2 px-2 sm:px-3">
        <Link
          href="/dashboard/modules/finance"
          className="shrink-0 no-underline hover:opacity-90 pr-1 border-r border-slate-100 mr-0.5"
        >
          <span className="text-xs font-bold uppercase tracking-wide text-teal-800">
            Finance
          </span>
        </Link>

        <div
          className="hidden md:flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overflow-y-hidden py-1
            [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
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
          className="md:hidden ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-800 hover:bg-teal-50 hover:text-teal-900"
          aria-label={open ? "Close finance menu" : "Open finance menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="md:hidden border-t border-slate-100 bg-slate-50/90 px-2 py-2">
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
