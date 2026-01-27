"use client";

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentSchool } from '@/contexts/CurrentSchoolContext';
import api from '@/utils/api';
import ApplicationTable from './components/ApplicationTable';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Search, Plus, Users, Clock, 
  CalendarCheck, UserCheck, Loader2, 
  Filter, Sparkles, ChevronRight 
} from 'lucide-react';
import { cn } from "@/lib/utils";

const AdmissionsPage = () => {
  const { currentSchool, loading: schoolLoading } = useCurrentSchool();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications', currentSchool?.id],
    queryFn: async () => {
      if (!currentSchool?.id) throw new Error("No school selected");
      const res = await api.get('/admissions/applications/', {
        headers: { 'X-School-ID': currentSchool.id },
      });
      return res.data;
    },
    enabled: !!currentSchool?.id && !schoolLoading,
  });

  // Memoized stats to prevent re-calculation jumps
  const { counts, readyToEnrollCount } = useMemo(() => {
    const statusCounts = applications.reduce(
      (acc: Record<string, number>, app: any) => {
        const status = app.status || 'UNKNOWN';
        acc[status] = (acc[status] || 0) + 1;
        acc.ALL = (acc.ALL || 0) + 1;
        return acc;
      },
      { ALL: 0 } as Record<string, number>
    );

    const ready = applications.filter(
      (app: any) => app.status === 'ACCEPTED' && (app.fee_payments?.length ?? 0) > 0 && !app.student
    ).length;

    return { counts: statusCounts, readyToEnrollCount: ready };
  }, [applications]);

  const statusTabs = [
    { key: 'ALL', label: 'All', icon: Users },
    { key: 'SUBMITTED', label: 'Pending', icon: Clock },
    { key: 'ACCEPTED', label: 'Accepted', icon: CalendarCheck },
    { key: 'ENROLLED', label: 'Enrolled', icon: UserCheck },
  ];

  if (schoolLoading) {
    return (
      <div className="flex h-[80vh] w-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Loading Environment</p>
      </div>
    );
  }

  if (!currentSchool) {
    return (
      <div className="flex h-[70vh] items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-slate-100 flex items-center justify-center">
            <Filter className="h-8 w-8 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">No School Selected</h2>
          <p className="text-slate-500">Please select a school from the dashboard sidebar to manage admissions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      {/* --- HEADER SECTION --- */}
      <div className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-indigo-600 p-1 rounded-md">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Admission Portal</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 truncate">
                {currentSchool.name}
              </h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {readyToEnrollCount > 0 && (
                <Badge className="hidden sm:flex bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 py-1.5 px-3 rounded-xl gap-2 transition-all cursor-default">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {readyToEnrollCount} Ready to Enroll
                </Badge>
              )}
              <Link href="/dashboard/modules/admissions/new" className="flex-1 sm:flex-none">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-100 py-5 sm:py-2">
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="text-sm font-bold">New Application</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* --- STATS GRID --- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {[
            { label: 'Total', value: counts.ALL, color: 'text-blue-600', icon: Users, bg: 'bg-blue-50' },
            { label: 'Drafts', value: counts.DRAFT || 0, color: 'text-amber-600', icon: Clock, bg: 'bg-amber-50' },
            { label: 'Pending', value: counts.SUBMITTED || 0, color: 'text-purple-600', icon: CalendarCheck, bg: 'bg-purple-50' },
            { label: 'Enrolled', value: counts.ENROLLED || 0, color: 'text-emerald-600', icon: UserCheck, bg: 'bg-emerald-50' },
          ].map((stat, i) => (
            <div key={i} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4 transition-transform hover:scale-[1.02]">
              <div className={cn("h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center", stat.bg)}>
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{stat.label}</p>
                <p className="text-xl font-black text-slate-900 leading-none mt-1">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* --- CONTROLS SECTION --- */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          {/* Scrollable Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap border",
                  activeTab === tab.key 
                    ? "bg-slate-900 text-white border-slate-900 shadow-md" 
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                <span className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-md text-[10px]",
                  activeTab === tab.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {counts[tab.key] || 0}
                </span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative group lg:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <Input
              placeholder="Quick search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 rounded-2xl border-slate-200 bg-white h-11 focus-visible:ring-indigo-600 focus-visible:ring-offset-0 shadow-sm"
            />
          </div>
        </div>

        {/* --- DATA AREA --- */}
        <div className="min-h-[400px]">
          {isLoading ? (
            <div className="bg-white rounded-[2rem] border border-slate-200 p-12 flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
              <p className="text-sm text-slate-400 font-medium">Synchronizing records...</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="bg-white rounded-[2rem] border border-slate-200 p-12 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-slate-200" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No applications found</h3>
              <p className="text-slate-500 text-sm max-w-xs mx-auto mt-2">
                We couldn't find any applications for this school. Start by creating a new entry.
              </p>
            </div>
          ) : (
            <ApplicationTable
              searchTerm={searchTerm}
              applications={applications}
              statusFilter={activeTab === 'ALL' ? undefined : activeTab}
            />
          )}
        </div>
      </main>

      {/* --- MOBILE FAB (Floating Action Button) --- */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        {readyToEnrollCount > 0 && activeTab === 'ALL' && (
           <div className="mb-4 text-center">
              <Badge className="bg-emerald-600 text-white shadow-xl py-2 px-4 rounded-full border-none">
                {readyToEnrollCount} Ready to Enroll
              </Badge>
           </div>
        )}
      </div>
    </div>
  );
};

export default AdmissionsPage;