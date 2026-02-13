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
  ArrowLeft, FileText, Download,
  Activity, Printer, Eye, Phone, Mail, Globe, Hash,
  MapPin, Heart, Info, AlertTriangle, UserPlus, Calendar,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { currentSchool, loading: schoolLoading } = useCurrentSchool();
  const [application, setApplication] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchApplication = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/admissions/applications/${id}/`);
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

  const getStatusColor = (status: string) => {
    const s = status?.toUpperCase();
    if (s === 'ADMITTED' || s === 'ENROLLED') return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
    if (s === 'OFFERED' || s === 'ACCEPTED') return "bg-blue-500/10 text-blue-600 border-blue-200";
    if (s === 'PENDING' || s === 'SUBMITTED') return "bg-amber-500/10 text-amber-600 border-amber-200";
    return "bg-slate-500/10 text-slate-600 border-slate-200";
  };

  const DataField = ({ label, value, icon: Icon, colorClass = "text-slate-400" }: { label: string; value?: any; icon?: any; colorClass?: string }) => {
    const displayValue = value && typeof value === 'object' ? value.name : value;
    return (
      <div className="group p-3 rounded-xl transition-all duration-300 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          {Icon && <Icon className={`h-3 w-3 ${colorClass} group-hover:text-indigo-500 transition-colors`} />}
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
        <p className="text-slate-500 font-medium animate-pulse">Decrypting Dossier...</p>
      </div>
    </div>
  );

  if (!application) return <div className="p-10 text-center">Application not found.</div>;

  const getImageUrl = (path: string | null | undefined) => {
    if (!path) return "";
    if (path.startsWith('http')) return path;
    const fileName = path.split('/').pop();
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return `${baseUrl}/media/admission_photos/${fileName}`;
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

        {/* 2. HERO COMPONENT */}
        <div className="relative overflow-hidden bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 bg-indigo-500/5 blur-[100px] rounded-full" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
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

              <div className="space-y-2">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                    {application.first_name} <span className="text-indigo-600">{application.last_name}</span>
                  </h1>
                </div>
                {application.preferred_name && (
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest italic">
                    Known as: {application.preferred_name}
                  </p>
                )}
                <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-2">
                  <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-none font-bold py-1 px-3 rounded-lg">
                    {typeof application.class_applied === 'object' ? application.class_applied.name : application.class_applied}
                  </Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-mono py-1 px-3 rounded-lg">
                    {application.admission_number || "REF-" + application.id.slice(0, 6)}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex justify-center md:block print:hidden bg-slate-50/50 p-4 rounded-3xl border border-slate-100 backdrop-blur-sm">
              {/* <AdmissionActions
                applicationId={id}
                currentStatus={application.status}
                onUpdated={fetchApplication}
                onEnrolled={(student) => router.push(`/dashboard/modules/students/${student.id}`)}
              /> */}
              <AdmissionActions
                applicationId={id}
                currentStatus={application.status}
                applicationData={application}
                onUpdated={fetchApplication}
                onEnrolled={(student) => router.push(`/dashboard/modules/students/${student.id}`)}
              />
            </div>
          </div>
        </div>

        {/* 3. BENTO GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* MAIN COLUMN (LEFT/MIDDLE) */}
          <div className="lg:col-span-8 space-y-6">

            {/* Bio Information */}
            <Card className="rounded-[2.5rem] border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50/50 px-8 py-4 border-b border-slate-100 flex items-center gap-2 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">
                <User className="h-4 w-4 text-indigo-500" /> Identity Matrix
              </div>
              <CardContent className="p-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  <DataField label="Gender" value={application.gender} icon={User} />
                  <DataField label="Birth Date" value={application.date_of_birth} icon={Calendar} />
                  <DataField label="Nationality" value={application.nationality} icon={Globe} />
                  <DataField label="Religion" value={application.religion} icon={Heart} />
                  <DataField label="ID Number" value={application.passport_number} icon={Hash} />
                  <DataField label="Category" value={application.category} icon={Info} />
                </div>
              </CardContent>
            </Card>

            {/* Guardian & Contact */}
            <Card className="rounded-[2.5rem] border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50/50 px-8 py-4 border-b border-slate-100 flex items-center gap-2 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Primary Guardian Secure Access
              </div>
              <CardContent className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <DataField label="Legal Guardian" value={application.primary_guardian_name} icon={User} />
                  <DataField label="Relationship" value={application.primary_guardian_relationship} icon={Info} />
                  <DataField label="Guardian ID" value={application.primary_guardian_id_number} icon={Hash} />
                </div>
                <div className="bg-indigo-600 rounded-[2rem] p-6 text-white space-y-5 shadow-lg shadow-indigo-100">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md"><Phone className="h-5 w-5" /></div>
                    <div>
                      <p className="text-[10px] font-black text-indigo-200 uppercase tracking-tighter">Phone Line</p>
                      <p className="text-base font-black">{application.primary_guardian_phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md"><Mail className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-indigo-200 uppercase tracking-tighter">Digital Node</p>
                      <p className="text-sm font-black truncate">{application.primary_guardian_email}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* NEW: Residential & Logistics Bento */}
            <Card className="rounded-[2.5rem] border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50/50 px-8 py-4 border-b border-slate-100 flex items-center gap-2 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">
                <MapPin className="h-4 w-4 text-amber-500" /> Geospatial & Logistics
              </div>
              <CardContent className="p-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="sm:col-span-2">
                  <DataField label="Residential Address" value={application.address} icon={MapPin} />
                </div>
                <DataField label="District/City" value={application.district} icon={Globe} />
                <DataField label="Province/State" value={application.region} icon={Globe} />
                <DataField label="Previous School" value={application.previous_school} icon={BookOpen} />
                <DataField label="Placement" value={application.placement_type} icon={Info} />
              </CardContent>
            </Card>
          </div>

          {/* SIDEBAR COLUMN (RIGHT) */}
          <div className="lg:col-span-4 space-y-6">

            {/* Health & Vitality Stats */}
            <Card className="rounded-[2.5rem] border-slate-200 shadow-sm overflow-hidden border-t-4 border-t-red-500">
              <div className="bg-red-50/50 px-6 py-4 border-b border-red-50 flex items-center gap-2 font-black text-red-900 text-[10px] uppercase tracking-widest">
                <Activity className="h-4 w-4 text-red-500" /> Medical Vitality
              </div>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-red-100 shadow-sm">
                  <div className="h-14 w-14 rounded-2xl bg-red-500 flex items-center justify-center text-white text-xl font-black">
                    {application.blood_group || 'O+'}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Blood Type</p>
                    <p className="text-xs font-bold text-red-600">Verified compatibility</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <DataField label="Known Allergies" value={application.allergies} icon={AlertTriangle} colorClass="text-amber-500" />
                  <DataField label="Chronic Records" value={application.chronic_conditions} icon={Activity} colorClass="text-red-400" />
                </div>
              </CardContent>
            </Card>

            {/* NEW: Emergency Response Node */}
            <Card className="rounded-[2.5rem] bg-slate-900 text-white shadow-xl shadow-slate-200 overflow-hidden relative">
              <div className="absolute -right-4 -bottom-4 opacity-10"><UserPlus className="h-24 w-24" /></div>
              <CardContent className="p-8 space-y-5">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Emergency Node
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Contact Name</p>
                    <p className="text-lg font-black">{application.emergency_contact_name || "N/A"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Relationship</p>
                      <p className="font-bold text-sm">{application.emergency_relationship || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">SOS Phone</p>
                      <p className="font-bold text-sm text-amber-400 font-mono">{application.emergency_contact_phone || "N/A"}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documents Section */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Files Vault</h3>
              <div className="space-y-3">
                {application.documents?.map((doc: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-3xl hover:border-indigo-500 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-indigo-50 group-hover:bg-indigo-500 rounded-xl flex items-center justify-center text-indigo-500 group-hover:text-white transition-colors">
                        <FileText className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-black text-slate-700 truncate w-32">{doc.file_name || "Attachment " + (i + 1)}</p>
                    </div>
                    <a href={doc.file} target="_blank" className="p-2 text-slate-400 hover:text-indigo-600"><Eye className="h-4 w-4" /></a>
                  </div>
                ))}
              </div>
            </div>

            {/* Statement of Intent */}
            <div className="p-8 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem]">
              <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-[0.2em] flex items-center gap-2">
                <Info className="h-3 w-3" /> Statement of Intent
              </h4>
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