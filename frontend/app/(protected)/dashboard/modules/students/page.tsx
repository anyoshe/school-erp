// app/(protected)/dashboard/modules/students/page.tsx
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Users, Filter, GraduationCap, UserPlus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import { useStudents } from "./hooks/useStudents";
import StudentTable from "./components/StudentTable";
import StudentFormDialog from "./components/StudentFormDialog";
import { studentService } from "./services/studentService";
import { Student } from "./types/student";

export default function StudentsPage() {
  const { students, isLoading, isError, refetch } = useStudents();

  const [openForm, setOpenForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // New filters for hierarchy
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [pathwayFilter, setPathwayFilter] = useState<string>("all");
  const [trackFilter, setTrackFilter] = useState<string>("all");
  const [streamFilter, setStreamFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Compute unique values for filters
  const uniqueGrades = useMemo(() => {
  return Array.from(
    new Set(
      students
        .map(s => s.current_class?.name)
        .filter((x): x is string => x !== undefined && x !== null && x !== "")
    )
  );
}, [students]);

  const uniqueSections = useMemo(() => {
  return Array.from(
    new Set(
      students
        .map(s => s.section)
        .filter((x): x is string => x !== undefined && x !== null && x !== "")
    )
  );
}, [students]);
  const uniquePathways = useMemo(() => {
  return Array.from(
    new Set(
      students
        .map(s => s.pathway)
        .filter((x): x is string => x !== undefined && x !== null && x !== "")
    )
  );
}, [students]);
  const uniqueTracks = useMemo(() => {
  return Array.from(
    new Set(
      students
        .map(s => s.track)
        .filter((x): x is string => x !== undefined && x !== null && x !== "")
    )
  );
}, [students]);

  const uniqueStreams = useMemo(() => {
  return Array.from(
    new Set(
      students
        .map(s => s.stream)
        .filter((x): x is string => x !== undefined && x !== null && x !== "")
    )
  );
}, [students]);

  // Filtered students based on all hierarchy filters
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      if (statusFilter !== "all" && student.status !== statusFilter) return false;

      if (gradeFilter !== "all" && student.current_class?.name !== gradeFilter) return false;
      if (sectionFilter !== "all" && student.section !== sectionFilter) return false;
      if (pathwayFilter !== "all" && student.pathway !== pathwayFilter) return false;
      if (trackFilter !== "all" && student.track !== trackFilter) return false;
      if (streamFilter !== "all" && student.stream !== streamFilter) return false;

      return true;
    });
  }, [students, statusFilter, gradeFilter, sectionFilter, pathwayFilter, trackFilter, streamFilter]);

  // Summary Stats
  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.status === "ACTIVE").length;

  const handleAddNew = () => {
    setEditingStudent(null);
    setOpenForm(true);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setOpenForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this student?")) return;
    try {
      await studentService.remove(id);
      toast.success("Student deleted successfully");
      refetch();
    } catch (error) {
      toast.error("Failed to delete student");
    }
  };

  const handleFormSuccess = () => {
    setOpenForm(false);
    setEditingStudent(null);
    refetch();
    toast.success(editingStudent ? "Student updated successfully" : "Student created successfully");
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <h2 className="text-2xl font-bold text-destructive mb-4">Failed to load students</h2>
        <Button onClick={refetch}>Try Again</Button>
      </div>
    );
  }

  const unplaced = students.filter(s => !s.current_class).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div
        className="rounded-3xl p-6 sm:p-7 text-white shadow-lg relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0F766E 0%, #115E59 55%, #D97706 140%)" }}
      >
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold" style={{ color: "#CCFBF1" }}>Learner registry</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">Students</h1>
            <p className="text-sm mt-1 max-w-xl" style={{ color: "#E7E5E4" }}>
              The centre of the ERP — class placement, fees, guardians and admissions all connect here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" className="bg-white/15 text-white border-0 hover:bg-white/25">
              <Link href="/dashboard/modules/admissions">
                <UserPlus className="h-4 w-4 mr-2" /> From admissions
              </Link>
            </Button>
            <Button onClick={handleAddNew} className="bg-white text-teal-900 hover:bg-teal-50 gap-2">
              <Plus className="h-4 w-4" />
              Add student
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: totalStudents, bg: "#F0FDFA", accent: "#0F766E" },
          { label: "Active", value: activeStudents, bg: "#FFFBEB", accent: "#D97706" },
          { label: "Unplaced", value: unplaced, bg: "#FFF7ED", accent: "#EA580C" },
          { label: "Grades in use", value: uniqueGrades.length, bg: "#F5F5F4", accent: "#57534E" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-stone-100 p-4 shadow-sm" style={{ background: s.bg }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{s.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: s.accent }}>{s.value}</p>
          </div>
        ))}
      </div>

      {unplaced > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{unplaced} student{unplaced === 1 ? "" : "s"} without a class</p>
            <p className="text-amber-800/80">
              Place them under a grade from Academics so fees and attendance can attach correctly.
            </p>
          </div>
        </div>
      )}

      {!isLoading && students.length === 0 && (
        <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50/40 px-6 py-10 text-center">
          <GraduationCap className="h-10 w-10 mx-auto text-teal-700 mb-3" />
          <h2 className="text-lg font-bold text-stone-900">No students yet</h2>
          <p className="text-sm text-stone-600 mt-1 max-w-md mx-auto">
            Enrol accepted applications from Admissions, or add a student directly after your academic structure is set.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <Button asChild style={{ background: "#0F766E" }} className="text-white">
              <Link href="/dashboard/modules/admissions">Open admissions</Link>
            </Button>
            <Button variant="outline" onClick={handleAddNew}>Add manually</Button>
          </div>
        </div>
      )}

      {/* Advanced Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter by Classification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Grade / Class</label>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {uniqueGrades.map(grade => (
                    <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Section</label>
              <Select value={sectionFilter} onValueChange={setSectionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {uniqueSections.map(sec => (
                    <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Pathway</label>
              <Select value={pathwayFilter} onValueChange={setPathwayFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Pathways" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pathways</SelectItem>
                  {uniquePathways.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Track</label>
              <Select value={trackFilter} onValueChange={setTrackFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Tracks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tracks</SelectItem>
                  {uniqueTracks.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Stream</label>
              <Select value={streamFilter} onValueChange={setStreamFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Streams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Streams</SelectItem>
                  {uniqueStreams.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="GRADUATED">Graduated</SelectItem>
                  <SelectItem value="TRANSFERRED">Transferred</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="EXPELLED">Expelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            Showing <Badge variant="secondary">{filteredStudents.length}</Badge> students
          </div>
        </CardContent>
      </Card>

      {/* Student Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student Records</CardTitle>
          <p className="text-sm text-muted-foreground">
            Students are grouped and filtered by Grade, Section, Pathway, Track & Stream
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <StudentTableSkeleton />
          ) : (
            <StudentTable
              students={filteredStudents}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <StudentFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        student={editingStudent ?? undefined}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}


// ──────────────────────────────────────────────────────────────────────────────
// Simple loading skeleton
// ──────────────────────────────────────────────────────────────────────────────
function StudentTableSkeleton() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 p-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      </div>
      <div className="p-4 space-y-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}