"use client";
import Link from "next/link";
import { BookOpen, Users, ShieldCheck, BarChart3, ChevronRight, CheckCircle, Sparkles, ArrowRight, Menu, X, Cpu, Zap, Lock, Globe, Brain, Axe as AxeIcon } from "lucide-react";
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
              <div className="relative">
                <div 
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow"
                  style={{
                    background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryHover})`,
                  }}
                >
                  <div className="flex items-center justify-center relative">
                    {/* Axe Icon - Representing GetAxe */}
                    <AxeIcon className="text-white w-4 h-4 sm:w-5 sm:h-5 relative z-10" />
                    {/* EDU overlay */}
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-sm">
                      <BookOpen className="text-white w-2 h-2 sm:w-2.5 sm:h-2.5" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-lg sm:text-xl font-bold" style={{ color: colors.darkBg }}>
                  Axe<span style={{ color: colors.primary }}>EDU</span>
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
              <a href="#features" className="text-sm font-medium transition-colors hover:text-blue-600" 
                 style={{ color: colors.textMuted }}>
                Features
              </a>
              <a href="#" className="text-sm font-medium transition-colors hover:text-blue-600" 
                 style={{ color: colors.textMuted }}>
                Pricing
              </a>
              <a href="#" className="text-sm font-medium transition-colors hover:text-blue-600" 
                 style={{ color: colors.textMuted }}>
                About
              </a>
              <Link
                href="/login"
                className="px-4 sm:px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryHover})`,
                }}
              >
                Sign In <ArrowRight className="inline ml-1.5 w-3.5 h-3.5" />
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
              isMenuOpen ? "max-h-64 mt-3 opacity-100" : "max-h-0 opacity-0"
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
                  href="#"
                  className="px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ 
                    color: colors.textMuted,
                    backgroundColor: `${colors.lightBg}` 
                  }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Pricing
                </a>
                <a
                  href="#"
                  className="px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ 
                    color: colors.textMuted,
                    backgroundColor: `${colors.lightBg}` 
                  }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  About
                </a>
                <Link
                  href="/login"
                  className="px-3 py-2.5 rounded-lg text-center text-sm font-semibold text-white transition-colors"
                  style={{
                    background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryHover})`,
                  }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign In
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
            <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full flex items-center justify-center"
                 style={{ backgroundColor: colors.primary }}>
              <AxeIcon className="text-white w-2 h-2 sm:w-2.5 sm:h-2.5" />
            </div>
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
            AxeEDU
          </span>
          <br />
          <span style={{ color: colors.darkBg }}>Modern School Management</span>
        </h1>

        <p className="mt-4 sm:mt-6 max-w-2xl text-sm sm:text-base md:text-lg" 
           style={{ color: colors.textMuted }}>
          Streamline operations, enhance learning, and simplify administration with our all-in-one
          <span className="font-semibold" style={{ color: colors.primary }}> education platform</span>.
        </p>

        {/* Key Points */}
        <div className="mt-6 sm:mt-8 flex flex-wrap justify-center gap-2 sm:gap-4 max-w-2xl">
          {[
            "No credit card required",
            "30-day free trial",
            "24/7 Support",
            "GDPR Compliant"
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
            href="/signup"
            className="group relative px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl text-white font-semibold text-sm sm:text-base shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryHover})`,
            }}
          >
            <span className="relative z-10">Start Free Trial</span>
            <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </Link>

          <Link
            href="/demo"
            className="group px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl font-semibold text-sm sm:text-base border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg flex items-center justify-center gap-1.5 sm:gap-2"
            style={{
              color: colors.primary,
              borderColor: colors.primary,
              backgroundColor: `${colors.primary}08`
            }}
          >
            <span>Book a Demo</span>
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-10 sm:mt-14 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 max-w-3xl w-full px-4">
          {[
            { value: "500+", label: "Schools", icon: <Globe className="w-4 h-4" /> },
            { value: "50K+", label: "Students", icon: <Users className="w-4 h-4" /> },
            { value: "99.9%", label: "Uptime", icon: <Zap className="w-4 h-4" /> },
            { value: "24/7", label: "Support", icon: <Cpu className="w-4 h-4" /> },
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
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center"
                   style={{ backgroundColor: colors.primary }}>
                <AxeIcon className="text-white w-3 h-3 sm:w-4 sm:h-4" />
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold" 
                  style={{ color: colors.darkBg }}>
                AxeEDU Features
              </h2>
            </div>
            <p className="text-sm sm:text-base max-w-2xl mx-auto px-4" 
               style={{ color: colors.textMuted }}>
              Comprehensive tools designed specifically for modern educational institutions
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 lg:gap-8 grid-cols-1 md:grid-cols-2">
            {[
              {
                icon: <Users className="w-5 h-5 sm:w-6 sm:h-6" />,
                title: "Smart Student Management",
                desc: "Centralized control of admissions, staff, guardians, and roles with AI insights.",
                features: ["AI-powered Admissions", "Staff Portal", "Parent Access", "Role Management"],
                color: colors.primary,
                bgColor: `${colors.primary}10`,
              },
              {
                icon: <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />,
                title: "Academic Excellence",
                desc: "Classes, subjects, grading, attendance, and exams made simple and efficient.",
                features: ["Smart Gradebook", "Attendance Tracking", "Timetable", "Exam Management"],
                color: colors.accent,
                bgColor: `${colors.accent}10`,
              },
              {
                icon: <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />,
                title: "Enterprise Security",
                desc: "Advanced permissions ensure users only see what they should with military-grade encryption.",
                features: ["Role-Based Access", "GDPR Compliance", "Data Encryption", "Audit Logs"],
                color: colors.warning,
                bgColor: `${colors.warning}10`,
              },
              {
                icon: <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />,
                title: "Intelligent Analytics",
                desc: "Real-time reports and predictive insights to drive smarter decisions.",
                features: ["Performance Analytics", "Financial Reports", "Custom Dashboards", "Export Tools"],
                color: colors.success,
                bgColor: `${colors.success}10`,
              },
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
                    <AxeIcon className="w-2.5 h-2.5 text-white" />
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
              <div className="absolute inset-0 opacity-5 flex items-center justify-center">
                <AxeIcon className="w-32 h-32 sm:w-48 sm:h-48 lg:w-64 lg:h-64" style={{ color: colors.accent }} />
              </div>
              
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 mb-3 sm:mb-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center"
                       style={{ backgroundColor: colors.accent }}>
                    <AxeIcon className="text-gray-900 w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-sm sm:text-base font-semibold" style={{ color: colors.textSubtle }}>
                    Powered by GetAxe Technologies
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 sm:mb-4 lg:mb-6">
                  Ready to Transform Your School?
                </h2>
                <p className="text-sm sm:text-base md:text-lg mb-6 sm:mb-8 lg:mb-10 max-w-2xl mx-auto" 
                   style={{ color: colors.textSubtle }}>
                  Join thousands of schools using AxeEDU to streamline operations and enhance learning.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                  <Link
                    href="/signup"
                    className="px-5 sm:px-6 lg:px-8 py-3 sm:py-3.5 lg:py-4 rounded-xl font-semibold text-sm sm:text-base lg:text-lg shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
                    style={{
                      backgroundColor: colors.accent,
                      color: colors.darkBg,
                    }}
                  >
                    Start Free Trial
                  </Link>
                  <Link
                    href="/contact"
                    className="px-5 sm:px-6 lg:px-8 py-3 sm:py-3.5 lg:py-4 rounded-xl border-2 font-semibold text-sm sm:text-base lg:text-lg hover:bg-white/10 transition-all"
                    style={{
                      borderColor: colors.surface,
                      color: colors.surface,
                    }}
                  >
                    Contact Sales
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
                <div 
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryHover})`,
                  }}
                >
                  <div className="relative">
                    <AxeIcon className="text-white w-4 h-4 sm:w-5 sm:h-5" />
                    <BookOpen className="absolute -bottom-1 -right-1 text-white w-2 h-2 sm:w-2.5 sm:h-2.5" />
                  </div>
                </div>
                <div className="text-center sm:text-left">
                  <span className="text-lg sm:text-xl font-bold" style={{ color: colors.darkBg }}>
                    Axe<span style={{ color: colors.primary }}>EDU</span>
                  </span>
                  <p className="text-xs" style={{ color: colors.textMuted }}>
                    Powered by GetAxe Technologies
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 lg:gap-6">
              <a href="#" className="text-xs sm:text-sm transition-colors hover:text-blue-600" 
                 style={{ color: colors.textMuted }}>
                Privacy
              </a>
              <a href="#" className="text-xs sm:text-sm transition-colors hover:text-blue-600" 
                 style={{ color: colors.textMuted }}>
                Terms
              </a>
              <a href="#" className="text-xs sm:text-sm transition-colors hover:text-blue-600" 
                 style={{ color: colors.textMuted }}>
                Contact
              </a>
              <a href="#" className="text-xs sm:text-sm transition-colors hover:text-blue-600" 
                 style={{ color: colors.textMuted }}>
                Support
              </a>
            </div>
          </div>

          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t text-center text-xs sm:text-sm" 
               style={{ 
                 borderColor: colors.borderLight,
                 color: colors.textMuted 
               }}>
            © {new Date().getFullYear()} AxeEDU. Powered by GetAxe Technologies. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
