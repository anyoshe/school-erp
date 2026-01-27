"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/utils/api";
import AdmissionActions from "../components/AdmissionActions";
import { Application } from "@/types/admission";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  User, ShieldCheck, BookOpen, Paperclip,
  ArrowLeft, FileText, ExternalLink, Download,
  Activity, Printer, Eye, Phone, Mail, Globe, Hash
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { currentSchool, loading: schoolLoading } = useCurrentSchool();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchApplication = async () => {
    try {
      setLoading(true);
      const res = await api.get<Application>(`/admissions/applications/${id}/`);
      setApplication(res.data);
    } catch (err: any) {
      toast.error("Failed to load details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && currentSchool) fetchApplication();
  }, [id, currentSchool]);

  const handlePrint = () => window.print();

  // Sleek Status Colors
  const getStatusColor = (status: string) => {
    const s = status?.toUpperCase();
    if (s === 'ADMITTED' || s === 'ENROLLED') return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
    if (s === 'OFFERED' || s === 'ACCEPTED') return "bg-blue-500/10 text-blue-600 border-blue-200";
    if (s === 'PENDING') return "bg-amber-500/10 text-amber-600 border-amber-200";
    return "bg-slate-500/10 text-slate-600 border-slate-200";
  };

  const DataField = ({ label, value, icon: Icon }: { label: string; value?: any; icon?: any }) => {
    const displayValue = value && typeof value === 'object' ? value.name : value;
    return (
      <div className="group p-3 rounded-xl transition-all duration-300 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          {Icon && <Icon className="h-3 w-3 text-slate-400 group-hover:text-indigo-500 transition-colors" />}
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
        </div>
        <div className="text-sm text-slate-900 font-semibold truncate">
          {displayValue || <span className="text-slate-300 font-normal italic">Not provided</span>}
        </div>
      </div>
    );
  };

  if (loading || schoolLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Syncing Application Data...</p>
      </div>
    </div>
  );

  if (!application) return <div className="p-10 text-center">Application not found.</div>;

  const getImageUrl = (path: string | null | undefined) => {
    if (!path) return "";
    if (path.startsWith('http')) return path;
    const fileName = path.split('/').pop();
    const subFolder = "admission_photos"; // Matches your actual folder

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    return `${baseUrl}/media/${subFolder}/${fileName}`;
  };
  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 print:bg-white print:pb-0 font-sans">
      {/* 1. FUTURISTIC NAV */}
      <div className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-30 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/dashboard/modules/admissions" className="group flex items-center text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-all">
            <div className="mr-2 p-1.5 rounded-lg group-hover:bg-indigo-50 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </div>
            Back to Pipeline
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handlePrint} className="hidden sm:flex text-slate-600 hover:bg-slate-100">
              <Printer className="mr-2 h-4 w-4" /> Export PDF
            </Button>
            <Badge className={`px-4 py-1.5 rounded-full border shadow-none font-bold uppercase tracking-tighter ${getStatusColor(application.status)}`}>
              {application.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-10">

        {/* 2. HERO COMPONENT: Mobile Responsive Header */}
        <div className="relative overflow-hidden bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
          {/* Subtle Background Glow */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 bg-indigo-500/5 blur-[100px] rounded-full" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition-opacity" />
                <div className="relative h-32 w-32 rounded-[1.8rem] overflow-hidden bg-slate-100 border-4 border-white shadow-xl">
                  {application.photo ? (
                    <img
                      src={getImageUrl(application.photo)}
                      alt="Profile"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.src = "https://api.dicebear.com/7.x/initials/svg?seed=" + application.first_name;
                      }}
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-300">
                      <User className="h-12 w-12" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  {application.first_name} <span className="text-indigo-600">{application.last_name}</span>
                </h1>
                <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-2">
                  <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-medium py-1">
                    <BookOpen className="h-3 w-3 mr-1.5" />
                    {typeof application.class_applied === 'object' ? application.class_applied.name : application.class_applied}
                  </Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-mono py-1">
                    <Hash className="h-3 w-3 mr-1.5" />
                    {application.admission_number || application.id.slice(0, 8)}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex justify-center md:block print:hidden bg-slate-50/50 p-4 rounded-2xl border border-slate-100 backdrop-blur-sm">
              <AdmissionActions
                applicationId={id}
                currentStatus={application.status} // Pass the status here!
                onUpdated={fetchApplication}
                onEnrolled={(student) => router.push(`/dashboard/modules/students/${student.id}`)}
              />
            </div>
          </div>
        </div>

        {/* 3. BENTO GRID LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Main Dossier Column */}
          <div className="lg:col-span-8 space-y-6">

            {/* Bio Information Bento */}
            <Card className="rounded-[2rem] border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex items-center gap-2 font-bold text-slate-900 text-sm">
                <User className="h-4 w-4 text-indigo-500" /> Bio-Metric Data
              </div>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <DataField label="Gender" value={application.gender} />
                  <DataField label="Birth Date" value={application.date_of_birth} icon={Globe} />
                  <DataField label="Nationality" value={application.nationality} icon={Globe} />
                  <DataField label="Religion" value={application.religion} />
                  <DataField label="Identification" value={application.passport_number} />
                  <DataField label="Group Tag" value={application.category} />
                </div>
              </CardContent>
            </Card>

            {/* Guardian & Secure Contact Bento */}
            <Card className="rounded-[2rem] border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex items-center gap-2 font-bold text-slate-900 text-sm">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Guardian Credentials
              </div>
              <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <DataField label="Primary Contact" value={application.primary_guardian_name} />
                  <DataField label="Relationship" value={application.primary_guardian_relationship} />
                </div>
                <div className="bg-indigo-50/30 p-4 rounded-2xl space-y-4 border border-indigo-100/50">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shadow-sm"><Phone className="h-4 w-4 text-indigo-500" /></div>
                    <div>
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">Phone Line</p>
                      <p className="text-sm font-bold text-indigo-900">{application.primary_guardian_phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shadow-sm"><Mail className="h-4 w-4 text-indigo-500" /></div>
                    <div>
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">Email Node</p>
                      <p className="text-sm font-bold text-indigo-900">{application.primary_guardian_email}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Document Gallery */}
            <div className="space-y-4 px-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Paperclip className="h-3 w-3" /> Encrypted Documents
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(application as any).documents?.map((doc: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:ring-2 hover:ring-indigo-500/20 transition-all cursor-default group">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-slate-100 group-hover:bg-indigo-500 transition-colors rounded-xl flex items-center justify-center text-slate-400 group-hover:text-white">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="max-w-[120px] sm:max-w-none">
                        <p className="text-sm font-bold text-slate-900 truncate">{doc.file_name || "Verification_Doc"}</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase">Secured PDF</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                      <a href={doc.file} target="_blank" className="p-2 text-slate-400 hover:text-indigo-600"><Eye className="h-4 w-4" /></a>
                      <a href={doc.file} download className="p-2 text-slate-400 hover:text-indigo-600"><Download className="h-4 w-4" /></a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar Bento Column */}
          <div className="lg:col-span-4 space-y-6">

            {/* Academic Track Bento */}
            <Card className="rounded-[2rem] border-none bg-indigo-600 text-white shadow-xl shadow-indigo-200 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10"><BookOpen className="h-24 w-24 rotate-12" /></div>
              <CardContent className="p-8 space-y-6 relative">
                <h3 className="text-xs font-black text-indigo-200 uppercase tracking-widest flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Academic Track
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-indigo-300 uppercase">Previous Institution</p>
                    <p className="text-lg font-bold truncate">{application.previous_school || "First Enrollment"}</p>
                  </div>
                  <div className="flex justify-between items-center border-t border-indigo-500 pt-4">
                    <div>
                      <p className="text-[10px] font-bold text-indigo-300 uppercase">Type</p>
                      <p className="font-bold text-sm">{application.placement_type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-indigo-300 uppercase">District</p>
                      <p className="font-bold text-sm">{application.district || 'Global'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Health Stats Bento */}
            <Card className="rounded-[2rem] border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center gap-2 font-bold text-red-900 text-sm">
                <Activity className="h-4 w-4 text-red-500" /> Medical Vitality
              </div>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 font-black">
                    {application.blood_group || 'O+'}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Blood Group</p>
                    <p className="text-xs text-slate-500 font-medium">Standard compatibility</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <DataField label="Allergy Notes" value={application.allergies} />
                  <DataField label="Chronic Records" value={application.chronic_conditions} />
                </div>
              </CardContent>
            </Card>

            {/* Statement of Intent */}
            <div className="p-6 bg-white border-2 border-dashed border-slate-200 rounded-[2rem]">
              <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Applicant Personal Note</h4>
              <p className="text-sm text-slate-600 leading-relaxed italic">
                "{application.notes || "System entry: No subjective notes provided during the digital submission process."}"
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}