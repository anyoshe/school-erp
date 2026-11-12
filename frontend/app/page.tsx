"use client";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, Users, ShieldCheck, BarChart3, ChevronRight, CheckCircle, ArrowRight, Menu, X, Globe, GraduationCap, Wallet, BriefcaseBusiness, Library, Laptop, ClipboardList } from "lucide-react";
import { useState } from "react";

// GetAxe Technologies color scheme - Enhanced for education
const colors = {
  primary: "#4F46E5",         // Indigo 600
  primaryHover: "#4338CA",    // Indigo 700
  accent: "#A3E635",          // Lime 400
  accentHover: "#84CC16",     // Lime 500
  darkBg: "#111827",          // Gray-900
  textMain: "#ffffff",
  textSubtle: "#d1d5db",      // Gray-300
  textMuted: "#9ca3af",       // Gray-400
  lightBg: "#F9FAFB",         // Gray-50
  surface: "#FFFFFF",
  borderLight: "#E5E7EB",     // Gray-200
  success: "#10B981",         // Emerald 500
  warning: "#F59E0B",         // Amber 500
};

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <main className="min-h-screen flex flex-col bg-white overflow-hidden">
      {/* Background with GetAxe brand colors */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          style={{ backgroundColor: `${colors.primary}20` }}
        ></div>
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          style={{ backgroundColor: `${colors.accent}20` }}
        ></div>
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full mix-blend-multiply filter blur-3xl opacity-10"
          style={{ backgroundColor: colors.darkBg }}
        ></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 border-b" style={{ borderColor: colors.borderLight }}>
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 sm:gap-3 group">
              <Image src="/School-erp-Logo.webp" alt="GETAXE SCHOOL MANAGEMENT" width={48} height={48} className="h-10 w-10 rounded-full object-contain sm:h-12 sm:w-12" priority />
              <div className="flex flex-col">
                <span className="text-lg sm:text-xl font-bold" style={{ color: colors.darkBg }}>
                  GETAXE SCHOOL MANAGEMENT
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] sm:text-xs font-medium" style={{ color: colors.textMuted }}>
                    Powered by
                  </span>
                  <span className="text-[10px] sm:text-xs font-semibold" style={{ color: colors.primary }}>
                    GetAxe Technologies
                  </span>
                </div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6 lg:gap-8">
              <a href="#features" className="text-sm font-medium transition-colors hover:text-primary-700"
                 style={{ color: colors.textMuted }}>
                Features
              </a>
              <a href="#platform" className="text-sm font-medium transition-colors hover:text-primary-700"
                 style={{ color: colors.textMuted }}>
                Platform
              </a>
              <a href="#audiences" className="text-sm font-medium transition-colors hover:text-primary-700"
                 style={{ color: colors.textMuted }}>
                For schools
              </a>
              <Link
                href="/parent-login"
                className="text-sm font-semibold transition-colors hover:text-primary-700"
                style={{ color: colors.primary }}
              >
                Parent login
              </Link>
              <Link
                href="/login"
                className="px-4 sm:px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryHover})`,
                }}
              >
                Login <ArrowRight className="inline ml-1.5 w-3.5 h-3.5" />
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
              style={{ color: colors.textMuted }}
            >
              {isMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Mobile Navigation Menu */}
          <div
            className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
              isMenuOpen ? "max-h-80 mt-3 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="py-3 border-t" style={{ borderColor: colors.borderLight }}>
              <div className="flex flex-col space-y-3">
                <a
                  href="#features"
                  className="px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    color: colors.textMuted,
                    backgroundColor: `${colors.lightBg}`
                  }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Features
                </a>
                <a
                  href="#platform"
                  className="px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    color: colors.textMuted,
                    backgroundColor: `${colors.lightBg}`
                  }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Platform
                </a>
                <a
                  href="#audiences"
                  className="px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    color: colors.textMuted,
                    backgroundColor: `${colors.lightBg}`
                  }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  For schools
                </a>
                <Link
                  href="/parent-login"
                  className="px-3 py-2.5 rounded-lg text-center text-sm font-semibold border transition-colors"
                  style={{
                    color: colors.primary,
                    borderColor: colors.primary,
                    backgroundColor: `${colors.primary}10`,
                  }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Parent login
                </Link>
                <Link
                  href="/login"
                  className="px-3 py-2.5 rounded-lg text-center text-sm font-semibold text-white transition-colors"
                  style={{
                    background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryHover})`,
                  }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Staff sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-4 sm:px-6 text-center pt-6 sm:pt-10 pb-12 sm:pb-20">
        {/* Brand Badge */}
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full mb-5 sm:mb-8"
             style={{
               backgroundColor: `${colors.primary}10`,
               border: `1px solid ${colors.primary}20`
             }}>
          <div className="flex items-center gap-1.5">
              <Image src="/School-erp-Logo.webp" alt="" width={20} height={20} className="h-4 w-4 rounded-full object-contain sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm font-medium" style={{ color: colors.primary }}>
              Powered by GetAxe Technologies
            </span>
          </div>
        </div>

        <h1 className="max-w-4xl text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight tracking-tight px-2">
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})`
            }}
          >
            GETAXE SCHOOL MANAGEMENT
          </span>
          <br />
          <span style={{ color: colors.darkBg }}>One connected platform for school operations and learning</span>
        </h1>

        <p className="mt-4 sm:mt-6 max-w-2xl text-sm sm:text-base md:text-lg"
           style={{ color: colors.textMuted }}>
          Bring your school community and essential workflows together, from admissions and academics to finance, reporting and digital learning.
        </p>

        {/* Key Points */}
        <div className="mt-6 sm:mt-8 flex flex-wrap justify-center gap-2 sm:gap-4 max-w-2xl">
          {[
            "Primary education",
            "Junior secondary",
            "Senior secondary",
            "Built around school workflows"
          ].map((point) => (
            <div key={point} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg"
                 style={{ backgroundColor: colors.lightBg }}>
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: colors.success }} />
              <span className="text-xs sm:text-sm font-medium" style={{ color: colors.textMuted }}>
                {point}
              </span>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-md px-4">
          <Link
            href="/login"
            className="group relative px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl text-white font-semibold text-sm sm:text-base shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryHover})`,
            }}
          >
            <span className="relative z-10">Get started</span>
            <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </Link>

          <Link
            href="/login"
            className="group px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl font-semibold text-sm sm:text-base border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg flex items-center justify-center gap-1.5 sm:gap-2"
            style={{
              color: colors.primary,
              borderColor: colors.primary,
              backgroundColor: `${colors.primary}08`
            }}
          >
            <span>Login</span>
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-10 sm:mt-14 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 max-w-3xl w-full px-4">
          {[
            { value: "01", label: "Academic management", icon: <BookOpen className="w-4 h-4" /> },
            { value: "02", label: "School operations", icon: <ClipboardList className="w-4 h-4" /> },
            { value: "03", label: "Community access", icon: <Users className="w-4 h-4" /> },
            { value: "04", label: "Learning tools", icon: <Laptop className="w-4 h-4" /> },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-3 sm:p-4 rounded-xl border shadow-sm"
                 style={{
                   backgroundColor: colors.surface,
                   borderColor: colors.borderLight
                 }}>
              <div className="flex justify-center mb-1.5 sm:mb-2">
                <div className="p-1.5 sm:p-2 rounded-lg" style={{ backgroundColor: `${colors.primary}10` }}>
                  <div style={{ color: colors.primary }}>{stat.icon}</div>
                </div>
              </div>
              <div className="text-lg sm:text-xl font-bold" style={{ color: colors.darkBg }}>
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm mt-1" style={{ color: colors.textMuted }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-4 sm:px-6 py-12 sm:py-16 lg:py-20"
               style={{ backgroundColor: colors.lightBg }}>
        <div className="container mx-auto">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <div className="inline-flex items-center gap-2 mb-3 sm:mb-4">
              <Image src="/School-erp-Logo.webp" alt="" width={32} height={32} className="h-7 w-7 rounded-full object-contain sm:h-8 sm:w-8" />
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold"
                  style={{ color: colors.darkBg }}>
                A clearer view of school operations
              </h2>
            </div>
            <p className="text-sm sm:text-base max-w-2xl mx-auto px-4"
               style={{ color: colors.textMuted }}>
              Connected workflows support day-to-day administration and learning from admissions through reporting.
            </p>
          </div>

          <div id="platform" className="grid gap-4 sm:gap-6 lg:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6" />,
                title: "Admissions",
                desc: "Receive applications, track admission progress and support learner enrolment.",
                features: ["Applications", "Enrolment", "Admission records", "Student intake"],
                color: colors.primary,
                bgColor: `${colors.primary}10`,
              },
              {
                icon: <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />,
                title: "Academic management",
                desc: "Organize academic years, classes, subjects, assessments and learner progress.",
                features: ["Classes and subjects", "Exams and marks", "Report cards", "Learner progress"],
                color: colors.accent,
                bgColor: `${colors.accent}10`,
              },
              {
                icon: <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />,
                title: "Student management",
                desc: "Keep learner profiles, guardians and student records connected to school workflows.",
                features: ["Student records", "Guardian details", "Class placement", "Student services"],
                color: colors.warning,
                bgColor: `${colors.warning}10`,
              },
              {
                icon: <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />,
                title: "Attendance",
                desc: "Record and review attendance as part of everyday school administration.",
                features: ["Attendance tracking", "Learner records", "Staff workflows", "School oversight"],
                color: colors.success,
                bgColor: `${colors.success}10`,
              },
              { icon: <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />, title: "Finance", desc: "Manage school fees and finance workflows in one place.", features: ["Fee structures", "Invoices and receipts", "Payments", "Finance reports"], color: colors.success, bgColor: `${colors.success}10` },
              { icon: <BriefcaseBusiness className="w-5 h-5 sm:w-6 sm:h-6" />, title: "Human resources", desc: "Support staff and user administration across the school.", features: ["Staff records", "User accounts", "Roles", "Administration"], color: colors.primary, bgColor: `${colors.primary}10` },
              { icon: <Library className="w-5 h-5 sm:w-6 sm:h-6" />, title: "Library management", desc: "Support library operations and access library tools where enabled.", features: ["Library module", "School access", "Operational workflows", "Administration"], color: colors.warning, bgColor: `${colors.warning}10` },
              { icon: <Laptop className="w-5 h-5 sm:w-6 sm:h-6" />, title: "Digital learning", desc: "Extend school workflows with the available e-learning module.", features: ["E-learning module", "Learner access", "School workflows", "Administration"], color: colors.accent, bgColor: `${colors.accent}10` },
              { icon: <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />, title: "Reports and administration", desc: "Review school information and manage settings and access.", features: ["Reports", "School settings", "Module administration", "User access"], color: colors.success, bgColor: `${colors.success}10` },
            ].map((f, index) => (
              <div
                key={f.title}
                className="group relative rounded-xl sm:rounded-2xl border p-5 sm:p-6 lg:p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.borderLight
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
                  <div
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: f.bgColor }}
                  >
                    <div style={{ color: f.color }}>{f.icon}</div>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg lg:text-xl font-bold mb-2 sm:mb-3"
                        style={{ color: colors.darkBg }}>
                      {f.title}
                    </h3>
                    <p className="text-sm sm:text-base mb-4 sm:mb-6" style={{ color: colors.textMuted }}>
                      {f.desc}
                    </p>

                    <ul className="grid grid-cols-2 gap-2 sm:gap-3">
                      {f.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: f.color }}></div>
                          <span className="text-xs sm:text-sm" style={{ color: colors.textMuted }}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* GetAxe Badge */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-900/80 backdrop-blur-sm">
                    <BookOpen className="w-2.5 h-2.5 text-white" />
                    <span className="text-xs text-white font-medium">GetAxe</span>
                  </div>
                </div>

                <div
                  className="absolute bottom-0 left-6 sm:left-8 right-6 sm:right-8 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: `linear-gradient(90deg, ${f.color}, transparent)`
                  }}
                ></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="audiences" className="px-4 sm:px-6 py-12 sm:py-16 lg:py-20">
        <div className="container mx-auto">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: colors.darkBg }}>Designed for the whole school community</h2>
            <p className="mt-3 text-sm sm:text-base" style={{ color: colors.textMuted }}>A shared view of school life helps each role focus on the work that matters.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["School administrators", "Coordinate admissions, finance, people, settings and reporting."],
              ["Teachers", "Organize classes, academic records, assessments and attendance."],
              ["Parents", "Connect with school information through the parent access routes."],
              ["Learners", "Stay connected to academic records and digital learning tools."],
            ].map(([title, description]) => <article key={title} className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: colors.borderLight }}><h3 className="font-bold" style={{ color: colors.darkBg }}>{title}</h3><p className="mt-2 text-sm leading-6" style={{ color: colors.textMuted }}>{description}</p></article>)}
          </div>
          <p className="mt-5 text-center text-xs" style={{ color: colors.textMuted }}>Available tools depend on each school&apos;s enabled modules and access permissions.</p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 lg:py-20">
        <div className="container mx-auto">
          <div className="rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden shadow-lg sm:shadow-xl">
            <div
              className="relative p-6 sm:p-8 lg:p-12 text-center"
              style={{
                background: `linear-gradient(135deg, ${colors.darkBg}, ${colors.primary}90)`,
              }}
            >
              {/* GetAxe logo watermark */}
              <div className="absolute inset-0 opacity-[0.08] flex items-center justify-center"><Image src="/School-erp-Logo.webp" alt="" width={320} height={320} className="h-48 w-48 object-contain sm:h-64 sm:w-64" /></div>

              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 mb-3 sm:mb-4">
                  <Image src="/School-erp-Logo.webp" alt="" width={40} height={40} className="h-9 w-9 rounded-full object-contain sm:h-10 sm:w-10" />
                  <span className="text-sm sm:text-base font-semibold" style={{ color: colors.textSubtle }}>
                    Powered by GetAxe Technologies
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 sm:mb-4 lg:mb-6">
                  Ready to Transform Your School?
                </h2>
                <p className="text-sm sm:text-base md:text-lg mb-6 sm:mb-8 lg:mb-10 max-w-2xl mx-auto"
                   style={{ color: colors.textSubtle }}>
                  Bring your school&apos;s essential administration and learning workflows into one connected platform.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                  <Link
                    href="/login"
                    className="px-5 sm:px-6 lg:px-8 py-3 sm:py-3.5 lg:py-4 rounded-xl font-semibold text-sm sm:text-base lg:text-lg shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
                    style={{
                      backgroundColor: colors.accent,
                      color: colors.darkBg,
                    }}
                  >
                    Get started
                  </Link>
                  <Link
                    href="/parent-login"
                    className="px-5 sm:px-6 lg:px-8 py-3 sm:py-3.5 lg:py-4 rounded-xl border-2 font-semibold text-sm sm:text-base lg:text-lg hover:bg-white/10 transition-all"
                    style={{
                      borderColor: colors.surface,
                      color: colors.surface,
                    }}
                  >
                    Parent login
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 sm:py-10" style={{ borderColor: colors.borderLight }}>
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <Image src="/School-erp-Logo.webp" alt="" width={40} height={40} className="h-9 w-9 rounded-full object-contain sm:h-10 sm:w-10" />
                <div className="text-center sm:text-left">
                  <span className="text-lg sm:text-xl font-bold" style={{ color: colors.darkBg }}>
                    GETAXE SCHOOL MANAGEMENT
                  </span>
                  <p className="text-xs" style={{ color: colors.textMuted }}>
                    Powered by GetAxe Technologies
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 lg:gap-6">
              <a href="#features" className="text-xs sm:text-sm transition-colors hover:text-primary-700"
                 style={{ color: colors.textMuted }}>
                Features
              </a>
              <a href="#platform" className="text-xs sm:text-sm transition-colors hover:text-primary-700"
                 style={{ color: colors.textMuted }}>
                Platform
              </a>
              <a href="#audiences" className="text-xs sm:text-sm transition-colors hover:text-primary-700"
                 style={{ color: colors.textMuted }}>
                For schools
              </a>
              <Link href="/parent-login" className="text-xs sm:text-sm transition-colors hover:text-primary-700"
                 style={{ color: colors.textMuted }}>
                Parent login
              </Link>
              <Link href="/login" className="text-xs sm:text-sm transition-colors hover:text-primary-700" style={{ color: colors.textMuted }}>
                Staff login
              </Link>
            </div>
          </div>

          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t text-center text-xs sm:text-sm"
               style={{
                 borderColor: colors.borderLight,
                 color: colors.textMuted
               }}>
            © {new Date().getFullYear()} GETAXE SCHOOL MANAGEMENT. Powered by GetAxe Technologies.
          </div>
        </div>
      </footer>
    </main>
  );
}
