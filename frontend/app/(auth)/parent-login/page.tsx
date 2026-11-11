"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { loginUser } from "@/services/auth.service";
import { saveToken } from "@/utils/auth";
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Users,
  Loader2,
} from "lucide-react";

const colors = {
  primary: "#4F46E5",
  primaryHover: "#4338CA",
  accent: "#A3E635",
  darkBg: "#111827",
  textMuted: "#9ca3af",
  borderLight: "#E5E7EB",
  lightBg: "#F9FAFB",
};

export default function ParentLoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const tokenData = await loginUser(email.trim(), password);
      saveToken(tokenData.access);
      queryClient.removeQueries({ queryKey: ["currentUser"] });
      if (tokenData.refresh) {
        localStorage.setItem("refreshToken", tokenData.refresh);
      }
      router.replace("/resolve");
    } catch (err: any) {
      const data = err?.response?.data;
      let msg =
        (typeof data?.detail === "string" && data.detail) ||
        data?.non_field_errors?.[0] ||
        err?.message ||
        "Could not sign in. Check your email and password.";
      if (err?.response?.status === 401) {
        msg =
          "Wrong email or password. Use the temporary password the school shared when they invited you. If you never received one, ask the school to invite you again with a new password.";
      } else if (err?.code === "ERR_NETWORK") {
        msg = "Cannot reach the server. Check your internet connection or try again later.";
      }
      setError(typeof msg === "string" ? msg : "Login failed");
      toast.error(typeof msg === "string" ? msg : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh min-h-screen w-full flex flex-col bg-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-32 -right-24 w-72 h-72 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: colors.primary }}
        />
        <div
          className="absolute -bottom-32 -left-24 w-72 h-72 rounded-full blur-3xl opacity-15"
          style={{ backgroundColor: colors.accent }}
        />
      </div>

      <header className="relative z-10 border-b bg-white/90 backdrop-blur-md" style={{ borderColor: colors.borderLight }}>
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
              style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryHover})` }}
            >
              <BookOpen className="h-4 w-4" />
            </span>
            Axe<span style={{ color: colors.primary }}>EDU</span>
          </Link>
          <Link href="/login" className="text-sm font-medium text-slate-500 hover:text-indigo-600">
            School staff login
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center sm:text-left">
            <div
              className="mx-auto sm:mx-0 mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md"
              style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryHover})` }}
            >
              <Users className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Parent portal login
            </h1>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Sign in with the email and password your school shared. View fees, results and attendance for your children.
            </p>
          </div>

          <div
            className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7"
            style={{ borderColor: colors.borderLight }}
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="parent-email" className="text-sm font-medium text-slate-700">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="parent-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="parent@email.com"
                    className="w-full rounded-xl border bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none ring-indigo-500 focus:bg-white focus:ring-2"
                    style={{ borderColor: colors.borderLight }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="parent-password" className="text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="parent-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="w-full rounded-xl border bg-slate-50 py-2.5 pl-10 pr-11 text-sm outline-none ring-indigo-500 focus:bg-white focus:ring-2"
                    style={{ borderColor: colors.borderLight }}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-60"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryHover})`,
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    Enter parent portal <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 space-y-2 border-t pt-4 text-center text-xs text-slate-500" style={{ borderColor: colors.borderLight }}>
              <p>
                No account yet? Ask the school office to invite you with your child&apos;s admission number.
              </p>
              <p>
                School staff?{" "}
                <Link href="/login" className="font-semibold text-indigo-600 hover:underline">
                  Sign in here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
