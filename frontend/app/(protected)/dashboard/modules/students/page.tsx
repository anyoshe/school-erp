// "use client";

// import { useState } from "react";
// import { useStudents } from "./hooks/useStudents";
// import StudentTable from "./components/StudentTable";
// import StudentForm from "./components/StudentForm";
// import { studentService } from "./services/studentService";
// import { Student } from "./types/student";

// export default function StudentsPage() {
//   const { students, loading, refresh } = useStudents();
//   const [editing, setEditing] = useState<Student | null>(null);
//   const [open, setOpen] = useState(false);

//   const handleDelete = async (id: string) => {
//     if (!id) return;
//     await studentService.remove(id);
//     refresh();
//   };

//   if (loading) return <p>Loading...</p>;

//   return (
//     <div className="space-y-6">
//       <button onClick={() => setOpen(true)} className="btn-primary">Add Student</button>

//       <StudentTable
//         students={students}
//         onEdit={(s) => { setEditing(s); setOpen(true); }}
//         onDelete={handleDelete}
//       />

//       {open && (
//         <div className="modal">
//           <StudentForm
//             student={editing ?? undefined}
//             onClose={() => { setOpen(false); setEditing(null); }}
//             onSaved={refresh}
//           />
//         </div>
//       )}
//     </div>
//   );
// }




// app/(protected)/dashboard/modules/students/page.tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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
                  students={students}
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