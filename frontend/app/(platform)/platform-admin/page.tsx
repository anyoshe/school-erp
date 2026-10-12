"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShieldCheck, Building2, LogOut, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import api, { getCurrentUser } from "@/utils/api";
import {
  removeActiveSchool,
  removeSchoolSupportSessionId,
  setActiveSchool,
  setSchoolSupportSessionId,
} from "@/utils/auth";

interface SchoolSummary {
  id: string;
  name: string;
  short_name: string;
  email: string | null;
  city: string;
  country: string;
  setup_complete: boolean;
  created_at: string;
  updated_at: string;
}

interface SupportContext {
  active: boolean;
  id?: string;
  school: SchoolSummary | null;
  started_at?: string;
  read_only?: boolean;
}

export default function PlatformAdminPage() {
  const router = useRouter();
  const [schools, setSchools] = useState<SchoolSummary[]>([]);
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [supportContext, setSupportContext] = useState<SupportContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const loadSchools = useCallback(async (query = "") => {
    const response = await api.get("/schools/platform-directory/", {
      params: query ? { search: query } : undefined,
    });
    setSchools(response.data);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const user = await getCurrentUser(true);
        if (!user.is_superuser) {
          router.replace("/dashboard");
          return;
        }

        removeActiveSchool();
        removeSchoolSupportSessionId();
        const [directory, context] = await Promise.all([
          api.get("/schools/platform-directory/"),
          api.get("/schools/support-context/"),
        ]);
        if (!active) return;
        setSchools(directory.data);
        const current = context.data as SupportContext;
        setSupportContext(current);
        if (current.active && current.school && current.id) {
          setActiveSchool(current.school.id);
          setSchoolSupportSessionId(current.id);
        }
      } catch (error) {
        console.error("Could not initialize platform administration:", error);
        toast.error("Could not load platform administration.");
        router.replace("/login");
      } finally {
        if (active) setLoading(false);
      }
    }
    initialize();
    return () => {
      active = false;
    };
  }, [router]);

  async function searchSchools(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await loadSchools(search.trim());
    } catch (error) {
      console.error("Could not search schools:", error);
      toast.error("School search failed.");
    }
  }

  async function enterSupport(school: SchoolSummary) {
    if (!reason.trim()) {
      toast.error("Enter a reason for school support access.");
      return;
    }
    setWorking(true);
    try {
      removeActiveSchool();
      removeSchoolSupportSessionId();
      const response = await api.post("/schools/start-support-context/", {
        school_id: school.id,
        reason: reason.trim(),
      });
      setActiveSchool(school.id);
      setSchoolSupportSessionId(response.data.id);
      router.push("/dashboard");
    } catch (error) {
      console.error("Could not start school-support context:", error);
      toast.error("Could not start school-support access.");
    } finally {
      setWorking(false);
    }
  }

  async function endSupport() {
    setWorking(true);
    try {
      await api.post("/schools/end-support-context/");
      removeActiveSchool();
      removeSchoolSupportSessionId();
      setSupportContext({ active: false, school: null });
      setReason("");
      toast.success("School-support context ended.");
    } catch (error) {
      console.error("Could not end school-support context:", error);
      toast.error("Could not end school-support access.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen grid place-items-center text-gray-600">Loading platform administration...</main>;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
              <ShieldCheck className="h-4 w-4" />
              Platform administration
            </p>
            <h1 className="text-3xl font-bold text-gray-900">Registered schools</h1>
            <p className="mt-2 text-gray-600">Select a school to enter a clearly labelled, read-only support context.</p>
          </div>
          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </header>

        {supportContext?.active && supportContext.school && (
          <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4" aria-label="Active support context">
            <div>
              <p className="font-semibold text-amber-950">Active support context: {supportContext.school.name}</p>
              <p className="text-sm text-amber-800">Read-only access · started {supportContext.started_at ? new Date(supportContext.started_at).toLocaleString() : "just now"} · reason recorded for audit</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => router.push("/dashboard")} className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">
                Continue support <ArrowRight className="h-4 w-4" />
              </button>
              <button type="button" disabled={working} onClick={endSupport} className="rounded-lg border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60">
                End context
              </button>
            </div>
          </section>
        )}

        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <label htmlFor="support-reason" className="mb-2 block text-sm font-semibold text-gray-800">Reason for school-support access</label>
          <textarea
            id="support-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Describe the support request. This reason will be retained in the access audit trail."
            className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <p className="mt-1 text-xs text-gray-500">Support access is read-only. API authorization is verified on the server for every school-scoped request.</p>
        </section>

        <form onSubmit={searchSchools} className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by school, email, city, or country"
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <button type="submit" className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Search</button>
        </form>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">{schools.length} {schools.length === 1 ? "school" : "schools"}</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {schools.map((school) => (
              <article key={school.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-1 rounded-lg bg-primary-50 p-2 text-primary-800"><Building2 className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-gray-900">{school.name}</h3>
                    <p className="text-sm text-gray-600">{[school.city, school.country].filter(Boolean).join(", ") || "Location not provided"}</p>
                    {school.email && <p className="text-sm text-gray-500">{school.email}</p>}
                    <p className="mt-1 text-xs text-gray-500">Registered {new Date(school.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${school.setup_complete ? "bg-green-100 text-secondary-800" : "bg-gray-100 text-gray-700"}`}>
                    {school.setup_complete ? "Setup complete" : "Setup incomplete"}
                  </span>
                  <button type="button" disabled={working || !reason.trim()} onClick={() => enterSupport(school)} className="rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50">
                    Enter support context
                  </button>
                </div>
              </article>
            ))}
            {schools.length === 0 && <p className="px-5 py-10 text-center text-sm text-gray-500">No registered schools match this search.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
