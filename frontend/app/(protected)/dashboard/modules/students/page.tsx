// app/(protected)/dashboard/modules/students/page.tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import { useStudents } from "./hooks/useStudents";
import StudentTable from "./components/StudentTable";
import StudentFormDialog from "./components/StudentFormDialog";
import { studentService } from "./services/studentService";
import { Student } from "./types/student";

// ──────────────────────────────────────────────────────────────────────────────
// Main Students Dashboard Page
// ──────────────────────────────────────────────────────────────────────────────
export default function StudentsPage() {
  const { 
    students, 
    isLoading, 
    isError, 
    refetch
  } = useStudents();

  const [openForm, setOpenForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [enrollmentFilter, setEnrollmentFilter] = useState<string>("all");
  // Calculate summary stats
  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.status === "ACTIVE").length;
  const recentlyEnrolled = students.filter(s => {
    if (!s.admission_date) return false;
    const admissionDate = new Date(s.admission_date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return admissionDate >= weekAgo;
  }).length;

  // Filter students based on selected filters
  const filteredStudents = students.filter(student => {
    // Status filter
    if (statusFilter !== "all" && student.status !== statusFilter) {
      return false;
    }

    // Enrollment filter
    if (enrollmentFilter !== "all") {
      const admissionDate = student.admission_date ? new Date(student.admission_date) : null;
      const now = new Date();
      
      if (enrollmentFilter === "today") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return admissionDate && admissionDate >= today;
      } else if (enrollmentFilter === "week") {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return admissionDate && admissionDate >= weekAgo;
      } else if (enrollmentFilter === "month") {
        const monthAgo = new Date();
        monthAgo.setMonth(now.getMonth() - 1);
        return admissionDate && admissionDate >= monthAgo;
      }
    }

    return true;
  });

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
    toast.success(
      editingStudent ? "Student updated successfully" : "Student created successfully"
    );
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <h2 className="text-2xl font-bold text-destructive mb-4">
          Failed to load students
        </h2>
        <Button onClick={refetch}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header + Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground">
            Manage all enrolled students in your school
          </p>
        </div>

        <Button onClick={handleAddNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Add New Student
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeStudents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recently Enrolled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{recentlyEnrolled}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="GRADUATED">Graduated</SelectItem>
                  <SelectItem value="TRANSFERRED">Transferred</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="EXPELLED">Expelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Enrollment Period</label>
              <Select value={enrollmentFilter} onValueChange={setEnrollmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by enrollment date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Enrolled Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Badge variant="secondary" className="px-3 py-1">
                {filteredStudents.length} students
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="graduated">Graduated</TabsTrigger>
          <TabsTrigger value="transferred">Transferred</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {isLoading ? (
            <StudentTableSkeleton />
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Student Records</CardTitle>
              </CardHeader>
              <CardContent>
                <StudentTable
                  students={filteredStudents}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* You can add more tab contents later */}
      </Tabs>

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