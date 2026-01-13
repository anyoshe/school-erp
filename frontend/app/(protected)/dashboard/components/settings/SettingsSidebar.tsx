
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Info, MapPin, Book, Image, Grid, Users } from "lucide-react";

const links = [
  { label: "Basic Info", href: "/dashboard/settings/school/basic-info", icon: Info },
  { label: "Contact & Address", href: "/dashboard/settings/school/contact", icon: MapPin },
  { label: "Academic Config", href: "/dashboard/settings/school/academic", icon: Book },
  { label: "Branding", href: "/dashboard/settings/school/branding", icon: Image },
  { label: "Modules", href: "/dashboard/settings/modules", icon: Grid },
  { label: "Users & Roles", href: "/dashboard/settings/users", icon: Users },
];

export default function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r p-4 sticky top-0 h-screen flex flex-col">
      <h2 className="text-xl font-bold mb-6">Settings</h2>
      <nav className="flex-1 space-y-2">
        {links.map((link) => {
          const isActive = pathname.startsWith(link.href);
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                isActive
                  ? "bg-blue-50 border-l-4 border-blue-600 text-blue-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50 hover:text-blue-700"
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
