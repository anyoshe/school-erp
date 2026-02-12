"use client";

import { useEffect, useState, useCallback } from "react";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import api from "@/utils/api";
import { toast } from "sonner";
import { Check, UserPlus, Edit, Trash2, Shield, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Module {
  id: number;
  name: string;
  code: string;
}

interface Role {
  id: string;
  code: string;
  name: string;
  description?: string;
  module_ids: number[];
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: Role;
  is_active?: boolean; // added for edit support
}

const FALLBACK_ROLES: Role[] = [
  { id: "1", code: "SUPER_ADMIN", name: "Super Admin / Owner", description: "Full platform control", module_ids: [] },
  { id: "2", code: "SCHOOL_ADMIN", name: "School Administrator", description: "Manages school settings & users", module_ids: [] },
  { id: "3", code: "PRINCIPAL", name: "Principal / Head Teacher", description: "School leadership", module_ids: [] },
  { id: "4", code: "DEPUTY_PRINCIPAL", name: "Deputy Principal / Vice Principal", description: "Assists principal", module_ids: [] },
  { id: "5", code: "ADMISSIONS_OFFICER", name: "Admissions Officer / Registrar", description: "Handles applications & enrollment", module_ids: [] },
  { id: "6", code: "ACCOUNTANT", name: "Accountant / Bursar", description: "Manages finances", module_ids: [] },
  { id: "7", code: "ACADEMIC_COORDINATOR", name: "Academic Coordinator / Head of Section", description: "Oversees academics", module_ids: [] },
  { id: "8", code: "TEACHER", name: "Teacher", description: "Classroom teaching", module_ids: [] },
  { id: "9", code: "LIBRARIAN", name: "Librarian", description: "Manages library", module_ids: [] },
  { id: "10", code: "HR_MANAGER", name: "HR Manager", description: "Manages staff", module_ids: [] },
  { id: "11", code: "IT_ADMINISTRATOR", name: "IT Administrator", description: "Manages tech infrastructure", module_ids: [] },
  { id: "12", code: "SECRETARY", name: "Secretary / Admin Assistant", description: "Administrative support", module_ids: [] },
  { id: "13", code: "NURSE", name: "Nurse / Health Officer", description: "Health services", module_ids: [] },
  { id: "14", code: "COUNSELOR", name: "Counselor", description: "Student guidance", module_ids: [] },
  { id: "15", code: "PARENT", name: "Parent", description: "Parent portal access", module_ids: [] },
  { id: "16", code: "STUDENT", name: "Student", description: "Student portal access", module_ids: [] },
];

export default function UsersSettingsPage() {
  const { currentSchool } = useCurrentSchool();

  const [allModules, setAllModules] = useState<Module[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Add user form
  const [newUser, setNewUser] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role_code: "",
  });

  // Edit role form
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    module_ids: [] as number[],
  });
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Edit user form
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    role_code: "",
    is_active: true,
  });

  // Delete confirmation
  // const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Load all data
  const loadData = useCallback(async () => {
    if (!currentSchool?.id) {
      toast.error("No school selected");
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Modules
      try {
        const res = await api.get("/modules/");
        setAllModules(res.data.map((m: any) => ({ ...m, id: Number(m.id) })));
      } catch {
        toast.warning("Could not load modules");
      }

      // Roles
      let loadedRoles: Role[] = [];
      try {
        const res = await api.get("/accounts/roles/");
        loadedRoles = res.data.map((r: any) => ({
          id: r.id,
          code: r.code || r.name,
          name: r.name,
          description: r.description,
          module_ids: (r.module_ids || []).map(Number),
        }));
      } catch (err: any) {
        console.warn("Roles endpoint failed → using fallback", err);
        loadedRoles = FALLBACK_ROLES;
      }
      setRoles(loadedRoles);

      // Users
      const usersRes = await api.get(`/accounts/schools/${currentSchool.id}/users/`);
      const loadedUsers = usersRes.data.map((u: any) => {
        const match = loadedRoles.find((r) => r.code === u.role);
        return {
          id: u.id,
          first_name: u.first_name || "",
          last_name: u.last_name || "",
          email: u.email,
          role: {
            id: match?.id || "0",
            code: u.role || "UNKNOWN",
            name: match?.name || u.role || "Unknown",
            description: match?.description || "",
            module_ids: [],
          },
          is_active: u.is_active ?? true, // fallback
        };
      });
      setUsers(loadedUsers);
    } catch (err: any) {
      toast.error("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentSchool?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create user
  const handleAddUser = async () => {
    if (!currentSchool?.id || !newUser.role_code) {
      toast.error("Please fill all required fields");
      return;
    }

    setActionLoading(true);

    try {
      const payload = {
        first_name: newUser.first_name.trim(),
        last_name: newUser.last_name.trim(),
        email: newUser.email.trim(),
        role: newUser.role_code,
      };

      const res = await api.post(`/accounts/schools/${currentSchool.id}/users/`, payload);

      console.log("RAW RESPONSE OBJECT:", res);
      console.log("RESPONSE DATA:", res.data);

      const tempPass = res?.data?.temporary_password || null;

      console.log("EXTRACTED TEMP PASS:", tempPass);
      console.log("TYPE OF TEMP PASS:", typeof tempPass);

      toast.success(
        <div className="bg-white border-4 border-green-500 rounded-xl p-6 shadow-2xl max-w-md mx-auto">
          <div className="text-2xl font-bold text-green-700 mb-4 flex items-center gap-3">
            <Check className="h-8 w-8" /> SUCCESS!
          </div>

          <div className="text-lg mb-4">User created successfully!</div>

          <div className="bg-gray-100 p-4 rounded-lg mb-4 border border-gray-300">
            <div className="text-base font-medium text-gray-800 mb-2">
              Temporary password (copy & share securely):
            </div>
            <div className="flex items-center gap-4">
              <code className="font-mono text-xl bg-white px-4 py-3 rounded border flex-1 break-all">
                {tempPass || "NOT RECEIVED"}
              </code>
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  if (tempPass) {
                    navigator.clipboard.writeText(tempPass);
                    toast.success("Copied!", { duration: 1500 });
                  }
                }}
              >
                Copy Password
              </Button>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            User logs in at <strong>/login</strong> with email + this password
          </div>
        </div>,
        {
          duration: 120000,
          position: "top-center",
          style: {
            maxWidth: "500px",
            borderRadius: "16px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            zIndex: 9999,
          },
          className: "sonner-toast-visible",
        }
      );

      loadData();
      setNewUser({ first_name: "", last_name: "", email: "", role_code: "" });
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to create user");
      console.error("Create user error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Open edit user dialog
  const openEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({
      first_name: user.first_name,
      last_name: user.last_name,
      role_code: user.role.code,
      is_active: user.is_active ?? true,
    });
  };

  // Save edited user
  const handleSaveEditUser = async () => {
    if (!editingUser || !currentSchool?.id) return;

    setActionLoading(true);

    try {
      const payload = {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        role: editForm.role_code,
        is_active: editForm.is_active,
      };

      await api.patch(`/accounts/schools/${currentSchool.id}/users/${editingUser.id}/`, payload);

      toast.success("User updated successfully!");
      setEditingUser(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update user");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete user
 const handleDeleteUser = async (user: User) => {
  if (!user || !currentSchool?.id) {
    toast.error("Cannot delete: missing user or school");
    return;
  }

  setActionLoading(true);

  try {
    await api.delete(`/accounts/schools/${currentSchool.id}/users/${user.id}/`);

    toast.success(`Deleted ${user.first_name} ${user.last_name} successfully!`);
    loadData();
  } catch (err: any) {
    toast.error(err.response?.data?.detail || "Failed to delete user");
    console.error("Delete error:", err);
  } finally {
    setActionLoading(false);
  }
};

  // Role CRUD (unchanged)
  const handleSaveRole = async () => {
    if (!roleForm.name.trim()) {
      toast.error("Role name is required");
      return;
    }

    setActionLoading(true);

    try {
      let res: import("axios").AxiosResponse;
      if (editingRole) {
        res = await api.patch(`/accounts/roles/${editingRole.id}/`, roleForm);
        setRoles((prev) =>
          prev.map((r) => (r.id === editingRole.id ? { ...r, ...res.data } : r))
        );
        setEditingRole(null);
        toast.success("Role updated");
      } else {
        res = await api.post("/accounts/roles/", roleForm);
        setRoles((prev) => [...prev, res.data]);
        toast.success("Role created");
      }

      setRoleForm({ name: "", description: "", module_ids: [] });
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to save role");
    } finally {
      setActionLoading(false);
    }
  };

  const startEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      description: role.description || "",
      module_ids: [...role.module_ids],
    });
  };

  const toggleModule = (moduleId: number) => {
    setRoleForm((prev) => ({
      ...prev,
      module_ids: prev.module_ids.includes(moduleId)
        ? prev.module_ids.filter((id) => id !== moduleId)
        : [...prev.module_ids, moduleId],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        <RefreshCw className="w-6 h-6 mr-3 animate-spin" />
        Loading users & roles...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-20">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Users & Roles</h1>
          <p className="text-gray-600 mt-2">
            Manage school users, roles and what each role can access.
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-8">
          <TabsList className="bg-white border">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">School Users</h2>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New User</DialogTitle>
                      <DialogDescription>
                        Create a new user account for this school. A temporary password will be generated.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-5 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>First Name *</Label>
                          <Input
                            value={newUser.first_name}
                            onChange={(e) =>
                              setNewUser({ ...newUser, first_name: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Last Name *</Label>
                          <Input
                            value={newUser.last_name}
                            onChange={(e) =>
                              setNewUser({ ...newUser, last_name: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          value={newUser.email}
                          onChange={(e) =>
                            setNewUser({ ...newUser, email: e.target.value })
                          }
                        />
                      </div>

                      <div>
                        <Label>Role *</Label>
                        <Select
                          value={newUser.role_code}
                          onValueChange={(value) =>
                            setNewUser({ ...newUser, role_code: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.code} value={role.code}>
                                {role.name}
                                {role.description && (
                                  <span className="text-xs text-gray-500 block">
                                    {role.description}
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        onClick={handleAddUser}
                        disabled={actionLoading}
                        className="w-full"
                      >
                        {actionLoading ? "Creating..." : "Create User"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-gray-500">
                          No users added yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.first_name} {user.last_name}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{user.role.name}</Badge>
                          </TableCell>
                         <TableCell className="text-right space-x-1">
  <Button
    variant="ghost"
    size="icon"
    onClick={() => openEditUser(user)}
  >
    <Edit className="h-4 w-4" />
  </Button>

  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button variant="ghost" size="icon" className="text-destructive">
        <Trash2 className="h-4 w-4" />
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete User</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete{" "}
          <strong>
            {user.first_name} {user.last_name}
          </strong>{" "}
          ({user.email})?<br />
          This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={() => handleDeleteUser(user)}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* Edit User Dialog */}
          <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription>
                  Update user details for{" "}
                  {editingUser?.first_name} {editingUser?.last_name}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>First Name</Label>
                    <Input
                      value={editForm.first_name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, first_name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input
                      value={editForm.last_name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, last_name: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>Role</Label>
                  <Select
                    value={editForm.role_code}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, role_code: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.code} value={role.code}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_active"
                    checked={editForm.is_active}
                    onCheckedChange={(checked) =>
                      setEditForm({ ...editForm, is_active: !!checked })
                    }
                  />
                  <label
                    htmlFor="is_active"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Active
                  </label>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEditUser} disabled={actionLoading}>
                  {actionLoading ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Roles Tab */}
          <TabsContent value="roles">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Roles & Permissions</h2>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Shield className="h-4 w-4" />
                      New Role
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>
                        {editingRole ? "Edit Role" : "Create New Role"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingRole
                          ? "Update role name, description and permissions."
                          : "Create a new role and assign modules/permissions."}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                      <div>
                        <Label>Role Name *</Label>
                        <Input
                          value={roleForm.name}
                          onChange={(e) =>
                            setRoleForm({ ...roleForm, name: e.target.value })
                          }
                          placeholder="e.g. Head of Department"
                        />
                      </div>

                      <div>
                        <Label>Description (optional)</Label>
                        <Input
                          value={roleForm.description}
                          onChange={(e) =>
                            setRoleForm({ ...roleForm, description: e.target.value })
                          }
                          placeholder="Brief description of responsibilities"
                        />
                      </div>

                      <div>
                        <Label>Assigned Modules</Label>
                        <div className="mt-3 max-h-60 overflow-y-auto pr-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {allModules.length === 0 ? (
                            <p className="text-sm text-muted-foreground col-span-2">
                              No modules loaded yet
                            </p>
                          ) : (
                            allModules.map((mod) => (
                              <div key={mod.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`mod-${mod.id}`}
                                  checked={roleForm.module_ids.includes(mod.id)}
                                  onCheckedChange={() => toggleModule(mod.id)}
                                />
                                <label
                                  htmlFor={`mod-${mod.id}`}
                                  className="text-sm cursor-pointer font-medium"
                                >
                                  {mod.name}
                                </label>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="flex gap-4 pt-4">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setEditingRole(null);
                            setRoleForm({ name: "", description: "", module_ids: [] });
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveRole}
                          disabled={actionLoading || !roleForm.name.trim()}
                          className="flex-1"
                        >
                          {actionLoading
                            ? "Saving..."
                            : editingRole
                              ? "Update Role"
                              : "Create Role"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roles.length === 0 ? (
                  <p className="text-center text-gray-500 col-span-full py-12">
                    No roles found
                  </p>
                ) : (
                  roles.map((role) => (
                    <Card key={role.id} className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{role.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4 min-h-[2.5rem]">
                          {role.description || "No description provided."}
                        </p>

                        <div className="mb-5">
                          <p className="text-sm font-medium mb-2">Permissions:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {role.module_ids.length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">
                                No modules assigned
                              </span>
                            ) : (
                              role.module_ids.map((id) => {
                                const mod = allModules.find((m) => m.id === id);
                                return mod ? (
                                  <Badge key={id} variant="secondary">
                                    {mod.name}
                                  </Badge>
                                ) : null;
                              })
                            )}
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => startEditRole(role)}
                        >
                          <Edit className="h-3.5 w-3.5 mr-2" />
                          Edit Role
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div> 
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}