"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { loginUser, signupUser } from "@/services/auth.service";
import { saveToken } from "@/utils/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Eye,
  EyeOff,
  Mail,
  UserPlus,
  Lock,
  BookOpen,
  ChevronRight,
  Axe as AxeIcon,
  Users,
  Zap,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const colors = {
  primary: "#4F46E5",
  primaryHover: "#4338CA",
  accent: "#A3E635",
  accentHover: "#84CC16",
  darkBg: "#111827",
  textMain: "#ffffff",
  textSubtle: "#d1d5db",
  textMuted: "#9ca3af",
  lightBg: "#F9FAFB",
  surface: "#FFFFFF",
  borderLight: "#E5E7EB",
  success: "#10B981",
  error: "#EF4444",
};

export default function Welcome() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (activeTab === "signup") {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }

        if (!firstName.trim() || !lastName.trim()) {
          throw new Error("Please provide both first and last name");
        }

        // Create user
        await signupUser({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          password,
        });

        // Success message + redirect to login (no auto-login)
        setError("Account created successfully! Please log in to continue.");
        setActiveTab("login"); // Switch to login tab automatically
        router.replace("/login"); // Or keep on same page if preferred
      } else {
        // Login flow
        const tokenData = await loginUser(email.trim(), password);

        // Save tokens
        saveToken(tokenData.access);
        queryClient.removeQueries({ queryKey: ["currentUser"] });
        if (tokenData.refresh) {
          localStorage.setItem("refreshToken", tokenData.refresh);
        }

        // Proceed to resolution
        router.replace("/resolve");
      }
    } catch (err: any) {
      console.error("Authentication error:", err);

      const errorMessage =
        err?.response?.data?.detail ||
        err?.response?.data?.email?.[0] ||
        err?.response?.data?.password?.[0] ||
        err?.message ||
        "Authentication failed. Please try again.";

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-dvh min-h-screen w-full flex flex-col"
      style={{ backgroundColor: colors.lightBg }}
    >
      {/* Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div
          className="absolute -top-20 -right-20 w-64 h-64 max-w-[50vw] max-h-[50vw] rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          style={{ backgroundColor: `${colors.primary}20` }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-64 h-64 max-w-[50vw] max-h-[50vw] rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          style={{ backgroundColor: `${colors.accent}20` }}
        />
      </div>

      <div className="relative z-0 w-full flex-1 flex flex-col">
        {/* Mobile Header */}
        <div className="lg:hidden w-full py-5 px-4 sm:px-6">
          <div className="flex items-center justify-center gap-3 mx-auto max-w-md sm:max-w-lg">
            <Image src="/School-erp-Logo.webp" alt="GETAXE SCHOOL MANAGEMENT" width={48} height={48} className="h-10 w-10 rounded-full object-contain" />
            <div className="text-center">
              <h1 className="text-xl font-bold" style={{ color: colors.darkBg }}>
                GETAXE SCHOOL MANAGEMENT
              </h1>
              <p className="text-xs" style={{ color: colors.textMuted }}>
                Powered by GetAxe Technologies
              </p>
            </div>
          </div>
        </div>

        {/* Main Content — centered on mobile, split on desktop */}
        <div className="w-full flex-1 flex flex-col justify-center px-4 sm:px-6 py-4 sm:py-8 lg:px-8 lg:py-12">
          <div className="w-full max-w-md sm:max-w-lg lg:max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 sm:gap-8 lg:gap-12">
              {/* Left Side - Marketing (Desktop Only) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="hidden lg:block lg:w-1/2"
              >
                <div className="flex items-center gap-3 mb-8">
                  <Image src="/School-erp-Logo.webp" alt="GETAXE SCHOOL MANAGEMENT" width={64} height={64} className="h-14 w-14 rounded-full object-contain shadow-md" />
                  <div>
                    <h1 className="text-3xl font-bold" style={{ color: colors.darkBg }}>
                      GETAXE SCHOOL MANAGEMENT
                    </h1>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium" style={{ color: colors.textMuted }}>
                        Powered by
                      </span>
                      <span className="text-sm font-semibold" style={{ color: colors.primary }}>
                        GetAxe Technologies
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 mb-10">
                  <h2 className="text-3xl xl:text-4xl font-bold" style={{ color: colors.darkBg }}>
                    Welcome to
                    <span
                      className="bg-clip-text text-transparent block mt-2"
                      style={{
                        backgroundImage: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})`,
                      }}
                    >
                      GETAXE SCHOOL MANAGEMENT
                    </span>
                  </h2>
                  <p className="text-lg leading-relaxed" style={{ color: colors.textMuted }}>
                    Access your comprehensive school management platform with all the tools you need in one place.
                  </p>
                </div>

                <div className="space-y-4 mb-8">
                  {[
                    { icon: <Users className="w-5 h-5" />, text: "Manage students & staff efficiently" },
                    { icon: <BookOpen className="w-5 h-5" />, text: "Track academic performance" },
                    { icon: <Zap className="w-5 h-5" />, text: "Reports and school insights" },
                    { icon: <CheckCircle className="w-5 h-5" />, text: "Tools for school administration" },
                  ].map((benefit, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: `${colors.primary}10` }}>
                        <div style={{ color: colors.primary }}>{benefit.icon}</div>
                      </div>
                      <span className="text-base" style={{ color: colors.textMuted }}>
                        {benefit.text}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 max-w-sm">
                  {[
                    { value: "All in one", label: "Connected workflows", color: colors.primary },
                    { value: "One school", label: "Shared information", color: colors.accent },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="text-center p-4 rounded-lg border shadow-sm"
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: colors.borderLight,
                      }}
                    >
                      <div className="text-xl font-bold" style={{ color: stat.color }}>
                        {stat.value}
                      </div>
                      <div className="text-sm mt-1" style={{ color: colors.textMuted }}>
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Right Side - Auth Form */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full lg:w-1/2 lg:max-w-lg lg:ml-auto"
              >
                <div className="w-full mx-auto">
                  <div
                    className="rounded-2xl shadow-xl border overflow-hidden w-full"
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.borderLight,
                    }}
                  >
                    <div
                      className="h-1.5"
                      style={{
                        background: `linear-gradient(to right, ${colors.primary}, ${colors.accent})`,
                      }}
                    />

                    <div className="p-5 sm:p-6 lg:p-8">
                      <div className="hidden lg:block mb-2">
                        <h3 className="text-xl font-bold" style={{ color: colors.darkBg }}>
                          {activeTab === "login" ? "Welcome Back" : "Create Your Account"}
                        </h3>
                        <p className="text-sm mt-1" style={{ color: colors.textMuted }}>
                          {activeTab === "login"
                            ? "Sign in to access your dashboard"
                            : "Start managing your school in minutes"}
                        </p>
                      </div>

                      {/* Tabs */}
                      <div className="flex w-full mb-6 rounded-xl p-1" style={{ backgroundColor: colors.lightBg }}>
                        <button
                          onClick={() => setActiveTab("login")}
                          className={`flex-1 text-center py-3 font-semibold rounded-lg transition-all duration-300 text-sm sm:text-base ${activeTab === "login" ? "text-white shadow-sm" : "hover:bg-white/50"
                            }`}
                          style={{
                            backgroundColor: activeTab === "login" ? colors.primary : "transparent",
                            color: activeTab === "login" ? colors.textMain : colors.textMuted,
                          }}
                        >
                          <Lock className="w-4 h-4 inline mr-2" />
                          Sign In
                        </button>
                        <button
                          onClick={() => setActiveTab("signup")}
                          className={`flex-1 text-center py-3 font-semibold rounded-lg transition-all duration-300 text-sm sm:text-base ${activeTab === "signup" ? "text-white shadow-sm" : "hover:bg-white/50"
                            }`}
                          style={{
                            backgroundColor: activeTab === "signup" ? colors.primary : "transparent",
                            color: activeTab === "signup" ? colors.textMain : colors.textMuted,
                          }}
                        >
                          <UserPlus className="w-4 h-4 inline mr-2" />
                          Sign Up
                        </button>
                      </div>

                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeTab}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          {/* Error Alert */}
                          {error && (
                            <div
                              className={`mb-4 p-3 rounded-lg flex items-start gap-2 text-sm ${error.includes("successfully") ? "bg-secondary-100 text-secondary-800 border-secondary-200" : "bg-red-100 text-red-800 border-red-200"
                                }`}
                            >
                              <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <span className="font-medium">{error}</span>
                            </div>
                          )}

                          <form onSubmit={handleAuth} className="space-y-4">
                            {/* First & Last Name - Only on Signup */}


                            {activeTab === "signup" && (
                              <div className="mb-6 p-4 bg-primary-50 rounded-xl border border-primary-100">
                                <div className="flex items-center gap-3 mb-2">
                                  <BookOpen className="h-5 w-5 text-primary-600" />
                                  <h3 className="font-semibold text-primary-800">Create Your School Account</h3>
                                </div>
                                <p className="text-sm text-primary-700">
                                  Create your school account with GETAXE SCHOOL MANAGEMENT and invite teachers, staff and parents to join your school.
                                </p>
                              </div>
                            )}
                            {activeTab === "signup" && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium mb-2" style={{ color: colors.darkBg }}>
                                    First Name
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="John"
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition text-sm sm:text-base"
                                    style={{
                                      borderColor: colors.borderLight,
                                      backgroundColor: colors.lightBg,
                                      color: colors.darkBg,
                                    }}
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-2" style={{ color: colors.darkBg }}>
                                    Last Name
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Doe"
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition text-sm sm:text-base"
                                    style={{
                                      borderColor: colors.borderLight,
                                      backgroundColor: colors.lightBg,
                                      color: colors.darkBg,
                                    }}
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    required
                                  />
                                </div>
                              </div>
                            )}

                            {/* Email */}
                            <div>
                              <label className="block text-sm font-medium mb-2" style={{ color: colors.darkBg }}>
                                Email Address
                              </label>
                              <div className="relative">
                                <Mail
                                  className="absolute left-3 top-1/2 transform -translate-y-1/2"
                                  size={18}
                                  style={{ color: colors.textMuted }}
                                />
                                <input
                                  type="email"
                                  placeholder="you@school.edu"
                                  className="w-full p-3 pl-10 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition text-sm sm:text-base"
                                  style={{
                                    borderColor: colors.borderLight,
                                    backgroundColor: colors.lightBg,
                                    color: colors.darkBg,
                                  }}
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  required
                                />
                              </div>
                            </div>

                            {/* Password */}
                            <div>
                              <label className="block text-sm font-medium mb-2" style={{ color: colors.darkBg }}>
                                Password
                              </label>
                              <div className="relative">
                                <input
                                  type={showPassword ? "text" : "password"}
                                  placeholder="Enter a strong password"
                                  className="w-full p-3 pr-10 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition text-sm sm:text-base"
                                  style={{
                                    borderColor: colors.borderLight,
                                    backgroundColor: colors.lightBg,
                                    color: colors.darkBg,
                                  }}
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  required
                                />
                                <button
                                  type="button"
                                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                                  onClick={() => setShowPassword(!showPassword)}
                                  style={{ color: colors.textMuted }}
                                >
                                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                              </div>
                            </div>

                            {/* Confirm Password - Only on Signup */}
                            {activeTab === "signup" && (
                              <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: colors.darkBg }}>
                                  Confirm Password
                                </label>
                                <input
                                  type="password"
                                  placeholder="Re-type your password"
                                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition text-sm sm:text-base"
                                  style={{
                                    borderColor: colors.borderLight,
                                    backgroundColor: colors.lightBg,
                                    color: colors.darkBg,
                                  }}
                                  value={confirmPassword}
                                  onChange={(e) => setConfirmPassword(e.target.value)}
                                  required
                                />
                              </div>
                            )}

                            {/* Submit Button */}
                            <button
                              type="submit"
                              disabled={loading}
                              className="w-full p-4 rounded-lg font-semibold text-white transition-all hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed mt-6 text-sm sm:text-base"
                              style={{
                                background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})`,
                              }}
                            >
                              {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  <span>Processing...</span>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-2">
                                  <span>{activeTab === "login" ? "Sign In" : "Create Account"}</span>
                                  <ArrowRight className="w-5 h-5" />
                                </div>
                              )}
                            </button>
                          </form>

                          <div className="mt-6 text-center space-y-2">
                            <Link
                              href="/"
                              className="inline-flex items-center gap-1.5 text-sm hover:underline transition-all"
                              style={{ color: colors.primary }}
                            >
                              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                              Back to homepage
                            </Link>
                            <div>
                              <Link
                                href="/parent-login"
                                className="text-sm font-medium hover:underline transition-all"
                                style={{ color: colors.textMuted }}
                              >
                                Parent portal login →
                              </Link>
                            </div>
                          </div>

                          <div className="mt-6 pt-6 border-t text-center" style={{ borderColor: colors.borderLight }}>
                            <div
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                              style={{ backgroundColor: `${colors.primary}08` }}
                            >
                              <div
                                className="w-3 h-3 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: colors.primary }}
                              >
                                <AxeIcon className="text-white w-2 h-2" />
                              </div>
                              <span className="text-xs font-medium" style={{ color: colors.primary }}>
                                Powered by GetAxe Technologies
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
