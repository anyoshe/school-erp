// app/(protected)/dashboard/modules/students/page.tsx
"use client";

import { useState, useMemo } from "react";
import { Plus, Users, Filter } from "lucide-react";
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

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground">Manage students by class, section, pathway, track & stream</p>
        </div>

        <Button onClick={handleAddNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Add New Student
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Students</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{totalStudents}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-secondary-600">{activeStudents}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Sections</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{uniqueSections.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pathways</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{uniquePathways.length}</div></CardContent>
        </Card>
      </div>

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