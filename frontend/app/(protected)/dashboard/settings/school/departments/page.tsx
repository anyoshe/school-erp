// app/(protected)/dashboard/settings/school/departments/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import api from "@/utils/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Department {
  id: string;
  name: string;
  short_name?: string;
  code?: string;
}

interface Curriculum {
  id: string;
  name: string;
}

export default function DepartmentsPage() {
  const { currentSchool, refreshSchools } = useCurrentSchool();

  const [currentDepartments, setCurrentDepartments] = useState<Department[]>([]);
  const [originalDepartments, setOriginalDepartments] = useState<Department[]>([]);
  const [templateDepartments, setTemplateDepartments] = useState<Department[]>([]);
  const [schoolCurriculum, setSchoolCurriculum] = useState<Curriculum | null>(null);

  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptShort, setNewDeptShort] = useState("");
  const [newDeptCode, setNewDeptCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!currentSchool?.id) return;

    const fetchData = async () => {
      setFetching(true);
      try {
        // 1. Get school's curriculum
        const currRes = await api.get("/academics/curricula/", {
          headers: { "X-School-ID": currentSchool.id },
        });
        const schoolCurr = (currRes.data.results || currRes.data)[0];
        setSchoolCurriculum(schoolCurr);

        // 2. Get template departments (from matching curriculum template)
        if (schoolCurr) {
          const templatesRes = await api.get("/academics/curriculum-templates/");
          const matchingTemplate = templatesRes.data.find(
            (t: Curriculum) => t.name === schoolCurr?.name
          );

          if (matchingTemplate) {
            const tempDeptRes = await api.get("/academics/departments/", {
              params: { curriculum: matchingTemplate.id, school__isnull: "true" },
            });
            setTemplateDepartments(
              (tempDeptRes.data.results || tempDeptRes.data || []).map((d: any) => ({
                ...d,
                id: String(d.id),
              }))
            );
          }
        }

        // 3. Get current school departments
        const deptRes = await api.get("/academics/departments/", {
          headers: { "X-School-ID": currentSchool.id },
        });
        const data = deptRes.data.results || deptRes.data || [];
        const normalized = data.map((d: any) => ({ ...d, id: String(d.id) }));
        setCurrentDepartments(normalized);
        setOriginalDepartments(normalized.map((d: Department) => ({ ...d })));
      } catch (err: any) {
        console.error("Failed to load data:", err);
        toast.error("Failed to load departments", {
          description: err?.response?.data?.detail || "Connection issue",
        });
      } finally {
        setFetching(false);
      }
    };

    fetchData();
  }, [currentSchool]);

  // Available departments = template departments not already in current school
  const availableDepartments = useMemo(() => {
    const currentNames = new Set(
      currentDepartments.map((d) => d.name.trim().toLowerCase())
    );
    return templateDepartments.filter(
      (d) => !currentNames.has(d.name.trim().toLowerCase())
    );
  }, [currentDepartments, templateDepartments]);

  const addCustomDepartment = () => {
    if (!newDeptName.trim()) return;
    const newDept: Department = {
      id: `temp-${Date.now()}`,
      name: newDeptName.trim(),
      short_name: newDeptShort.trim() || undefined,
      code: newDeptCode.trim() || undefined,
    };
    setCurrentDepartments([...currentDepartments, newDept]);
    setNewDeptName("");
    setNewDeptShort("");
    setNewDeptCode("");
  };

  const addFromTemplate = (dept: Department) => {
    const newDept: Department = {
      id: `temp-${Date.now()}`,
      name: dept.name,
      short_name: dept.short_name,
      code: dept.code,
    };
    setCurrentDepartments([...currentDepartments, newDept]);
  };

  const updateDept = (
    id: string,
    field: keyof Department,
    value: string
  ) => {
    setCurrentDepartments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
  };

  const removeDept = (id: string) => {
    setCurrentDepartments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleSave = async () => {
    if (!currentSchool?.id) return;
    setLoading(true);

    try {
      console.log("=== Department Save ===");
      console.log("Current departments:", currentDepartments);
      console.log("Original departments:", originalDepartments);

      // Find departments to delete
      const currentIds = new Set(currentDepartments.map((d) => d.id));
      const originalIds = new Set(originalDepartments.map((d) => d.id));

      const toDelete = [...originalIds].filter(
        (id) => !currentIds.has(id) && !String(id).startsWith("temp-")
      );

      console.log("To Delete:", toDelete);

      // Delete departments
      if (toDelete.length > 0) {
        await Promise.all(
          toDelete.map((id) =>
            api
              .delete(`/academics/departments/${id}/`, {
                headers: { "X-School-ID": currentSchool.id },
              })
              .then(() => console.log(`✓ Deleted department ${id}`))
              .catch((err) =>
                console.error(`✗ Delete failed for ${id}:`, err.message)
              )
          )
        );
      }

      // Create new departments
      const toCreate = currentDepartments.filter((d) =>
        d.id.startsWith("temp-")
      );

      console.log("To Create:", toCreate.length);

      const createdPromises = toCreate.map(async (dept) => {
        const res = await api.post(
          "/academics/departments/",
          {
            name: dept.name,
            short_name: dept.short_name || undefined,
            code: dept.code || undefined,
            school: currentSchool.id,
            curriculum: schoolCurriculum?.id,
          },
          { headers: { "X-School-ID": currentSchool.id } }
        );
        return { tempId: dept.id, realId: String(res.data.id) };
      });

      const createdResults = await Promise.all(createdPromises);

      // Update local state with real IDs
      setCurrentDepartments((prev) =>
        prev.map((d) => {
          const created = createdResults.find((c) => c.tempId === d.id);
          return created ? { ...d, id: created.realId } : d;
        })
      );

      // Reload from backend
      const deptRes = await api.get("/academics/departments/", {
        headers: { "X-School-ID": currentSchool.id },
      });
      const data = deptRes.data.results || deptRes.data || [];
      const normalized = data.map((d: any) => ({ ...d, id: String(d.id) }));
      setCurrentDepartments(normalized);
      setOriginalDepartments(normalized.map((d: Department) => ({ ...d })));

      await refreshSchools();
      toast.success("Departments saved!", {
        style: { background: "#10B981", color: "white" },
      });
    } catch (error: any) {
      console.error("Save failed:", error);
      toast.error("Failed to save departments", {
        description:
          error?.response?.data?.detail || "Check your connection or permissions.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">School Departments</h1>
        <p className="text-slate-600">Add and manage your school's departments</p>
      </div>

      {/* Current Departments */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Current Departments</h2>
        <div className="space-y-3">
          {currentDepartments.length === 0 ? (
            <p className="text-slate-500">No departments yet. Add one from the template below.</p>
          ) : (
            currentDepartments.map((dept) => (
              <div key={dept.id} className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-lg">
                <div className="flex-1 space-y-2">
                  <div>
                    <Label className="text-slate-700 font-medium">Department Name</Label>
                    <Input
                      value={dept.name}
                      onChange={(e) => updateDept(dept.id, "name", e.target.value)}
                      disabled={loading || !dept.id.startsWith("temp-")}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-slate-700 font-medium">Short Name</Label>
                      <Input
                        value={dept.short_name || ""}
                        onChange={(e) => updateDept(dept.id, "short_name", e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <Label className="text-slate-700 font-medium">Code</Label>
                      <Input
                        value={dept.code || ""}
                        onChange={(e) => updateDept(dept.id, "code", e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeDept(dept.id)}
                  disabled={loading}
                  className="mt-8"
                >
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Custom Department */}
      <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h2 className="text-xl font-bold">Add Custom Department</h2>
        <div className="space-y-3">
          <div>
            <Label className="text-slate-700 font-medium">Department Name</Label>
            <Input
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              placeholder="e.g., Science"
              disabled={loading}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-700 font-medium">Short Name</Label>
              <Input
                value={newDeptShort}
                onChange={(e) => setNewDeptShort(e.target.value)}
                placeholder="e.g., SCI"
                disabled={loading}
              />
            </div>
            <div>
              <Label className="text-slate-700 font-medium">Code</Label>
              <Input
                value={newDeptCode}
                onChange={(e) => setNewDeptCode(e.target.value)}
                placeholder="e.g., SCI001"
                disabled={loading}
              />
            </div>
          </div>
          <Button
            onClick={addCustomDepartment}
            disabled={loading || !newDeptName.trim()}
            className="w-full"
          >
            Add Department
          </Button>
        </div>
      </div>

      {/* Available from Template */}
      {availableDepartments.length > 0 && (
        <div className="space-y-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h2 className="text-xl font-bold">Available from Template</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableDepartments.map((dept) => (
              <button
                key={dept.id}
                onClick={() => addFromTemplate(dept)}
                disabled={loading}
                className="p-3 bg-white border border-green-300 rounded-lg hover:bg-green-50 disabled:opacity-50 text-left transition"
              >
                <p className="font-medium text-slate-700">{dept.name}</p>
                {dept.code && <p className="text-sm text-slate-500">{dept.code}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={loading}
        size="lg"
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {loading ? "Saving..." : "Save Departments"}
      </Button>
    </div>
  );
}