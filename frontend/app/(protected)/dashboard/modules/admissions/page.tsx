"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentSchool } from '@/contexts/CurrentSchoolContext';
import api from '@/utils/api';
import ApplicationTable from './components/ApplicationTable';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, ChevronRight, Users, Clock, CalendarCheck, UserCheck, Loader } from 'lucide-react';

const AdmissionsPage = () => {
  const { currentSchool, loading: schoolLoading } = useCurrentSchool();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');

  // Fetch applications for the current school
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

  // Calculate counts per status
  const counts = applications.reduce(
    (acc: Record<string, number>, app: { status?: string }) => {
      const status = app.status || 'UNKNOWN';
      acc[status] = (acc[status] || 0) + 1;
      acc.ALL = (acc.ALL || 0) + 1;
      return acc;
    },
    { ALL: 0 } as Record<string, number>
  );

  // Ready to enroll: ACCEPTED + has fee payment + not yet student
  const readyToEnrollCount = applications.filter(
    (app: { status?: string; fee_payments?: unknown[]; student?: unknown }) =>
      app.status === 'ACCEPTED' &&
      (app.fee_payments?.length ?? 0) > 0 &&
      !app.student
  ).length;

  const statusTabs = [
    { key: 'ALL', label: 'All', mobileLabel: 'All' },
    { key: 'DRAFT', label: 'Drafts', mobileLabel: 'Drafts' },
    { key: 'SUBMITTED', label: 'Submitted', mobileLabel: 'Pending' },
    { key: 'UNDER_REVIEW', label: 'Review', mobileLabel: 'Review' },
    { key: 'TEST_SCHEDULED', label: 'Test Scheduled', mobileLabel: 'Test' },
    { key: 'OFFERED', label: 'Offered', mobileLabel: 'Offered' },
    { key: 'ACCEPTED', label: 'Accepted', mobileLabel: 'Accepted' },
    { key: 'ENROLLED', label: 'Enrolled', mobileLabel: 'Enrolled' },
    { key: 'REJECTED', label: 'Rejected', mobileLabel: 'Rejected' },
  ];

  if (schoolLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader className="animate-spin h-10 w-10" />
      </div>
    );
  }

  if (!currentSchool) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold">No school selected</h2>
        <p className="mt-2 text-gray-600">Please select a school first</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="py-6 lg:py-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Admissions - {currentSchool.name}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage drafts, submitted applications, reviews, and enrollment
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              {readyToEnrollCount > 0 && (
                <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50">
                  <span className="flex items-center gap-2">
                    {readyToEnrollCount} Ready to Enroll
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </Button>
              )}

              <Link href="/dashboard/modules/admissions/new">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-2 h-4 w-4" />
                  New Application
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-6 mb-6 lg:mb-8">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-600">Total</span>
            </div>
            <p className="mt-2 text-2xl font-bold">{counts.ALL || 0}</p>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-medium text-gray-600">Drafts</span>
            </div>
            <p className="mt-2 text-2xl font-bold">{counts.DRAFT || 0}</p>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <CalendarCheck className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-600">Submitted</span>
            </div>
            <p className="mt-2 text-2xl font-bold">{counts.SUBMITTED || 0}</p>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Enrolled</span>
            </div>
            <p className="mt-2 text-2xl font-bold">{counts.ENROLLED || 0}</p>
          </div>
        </div>

        {/* Tabs & Search */}
        <div className="mb-6 lg:mb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full overflow-x-auto lg:flex-1">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="inline-flex bg-transparent border-b pb-1 gap-1.5">
                  {statusTabs.map(({ key, label, mobileLabel }) => (
                    <TabsTrigger
                      key={key}
                      value={key}
                      className="px-3 py-1.5 text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-t-md whitespace-nowrap"
                    >
                      {label}
                      {counts[key] > 0 && (
                        <Badge variant="secondary" className="ml-1.5 text-xs">
                          {counts[key]}
                        </Badge>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search name, admission #, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Applications Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">Loading applications...</div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                No applications yet
              </h3>
              <p className="text-gray-600 mb-6">
                Start by adding a new application.
              </p>
              <Link href="/dashboard/modules/admissions/new">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-2 h-4 w-4" />
                  New Application
                </Button>
              </Link>
            </div>
          ) : (
            <ApplicationTable
              searchTerm={searchTerm}
              applications={applications}
              statusFilter={activeTab === 'ALL' ? undefined : activeTab}
            />
          )}
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-10 bg-white border-t shadow-lg">
        <div className="mx-auto max-w-screen-xl px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-medium">
            {applications.length} applications
            {activeTab !== 'ALL' && (
              <span className="ml-2 text-gray-500">
                • {statusTabs.find(t => t.key === activeTab)?.mobileLabel}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard/modules/admissions/new">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdmissionsPage;