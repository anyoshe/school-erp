"use client";

import Link from "next/link";
import {
  Info,
  MapPin,
  Book,
  Hash,
  Image,
  Grid,
  Users,
  DollarSign,
  ClipboardList,
} from "lucide-react";

const LINKS = [
  { label: "Basic Info", href: "/dashboard/settings/school/basic-info", icon: Info, desc: "School name and identity" },
  { label: "Contact & Address", href: "/dashboard/settings/school/contact", icon: MapPin, desc: "Phone, email, location" },
  { label: "Academic Departments", href: "/dashboard/settings/school/departments", icon: Book, desc: "Departments" },
  { label: "Academic Config", href: "/dashboard/settings/school/academic", icon: Book, desc: "Year, terms, curriculum" },
  {
    label: "Grade requirements",
    href: "/dashboard/settings/school/academic/requirements",
    icon: ClipboardList,
    desc: "Materials & items for each class (offer letter page 1)",
  },
  { label: "Admission numbers", href: "/dashboard/settings/school/admission-numbers", icon: Hash, desc: "Admission number format" },
  { label: "Branding", href: "/dashboard/settings/school/branding", icon: Image, desc: "Logo and colours" },
  { label: "Modules", href: "/dashboard/settings/modules", icon: Grid, desc: "Enabled modules" },
  { label: "Users & Roles", href: "/dashboard/settings/users", icon: Users, desc: "Staff access" },
  { label: "Billing", href: "/dashboard/settings/billing", icon: DollarSign, desc: "Subscription billing" },
];

export default function SettingsIndexPage() {
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your school. Grade admission materials are under{" "}
          <strong>Grade requirements</strong>.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LINKS.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-xl border bg-white p-4 shadow-sm hover:border-primary/40 hover:shadow transition flex gap-3"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">{l.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{l.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
