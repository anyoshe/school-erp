"use client";

import { useEffect, useState, useCallback } from "react";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import api from "@/utils/api";
import { toast } from "sonner";
import {
    UserPlus,
    Edit,
    Trash2,
    Shield,
    RefreshCw,
} from "lucide-react";

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
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

/* ─────────────────────────────────────────────── */
/* Types                                           */
/* ─────────────────────────────────────────────── */
interface Module {
    id: number;
    name: string;
    code: string;
}

interface Role {
    id: number;
    name: string;
    description?: string;
    module_ids: number[];
}

interface User {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    role: Role;
}

/* ─────────────────────────────────────────────── */
/* Predefined common school roles                  */
/* ─────────────────────────────────────────────── */
const PREDEFINED_ROLES = [
    "Super Admin / Owner",
    "Principal / Head Teacher",
    "Deputy Principal",
    "Academic Coordinator",
    "Teacher",
    "Class Teacher",
    "Admissions Officer / Registrar",
    "Accountant / Bursar / Finance Officer",
    "Librarian",
    "HR Manager",
    "IT Administrator",
    "Secretary / Admin Assistant",
    "Nurse / Health Officer",
    "Counselor",
    "Parent",
    "Student",
] as const;

/* ─────────────────────────────────────────────── */
/* Main Component                                  */
/* ─────────────────────────────────────────────── */
export default function UsersSettingsPage() {
    const { currentSchool } = useCurrentSchool();

    const [allModules, setAllModules] = useState<Module[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // User form
    const [newUser, setNewUser] = useState({
        first_name: "",
        last_name: "",
        email: "",
        role_id: "",
    });

    // Role form
    const [roleForm, setRoleForm] = useState({
        name: "",
        description: "",
        module_ids: [] as number[],
    });
    const [editingRole, setEditingRole] = useState<Role | null>(null);

    // ─── Data Loading ────────────────────────────────────────
    // const loadData = useCallback(async () => {
    //     if (!currentSchool?.id) return;

    //     try {
    //         setLoading(true);

    //         const [modulesRes, rolesRes, usersRes] = await Promise.all([
    //             api.get("/modules/"),
    //             api.get("/roles/"),
    //             api.get(`/schools/${currentSchool.id}/users/`),
    //         ]);

    //         setAllModules(modulesRes.data.map((m: any) => ({ ...m, id: Number(m.id) })));

    //         setRoles(
    //             rolesRes.data.map((r: any) => ({
    //                 ...r,
    //                 id: Number(r.id),
    //                 module_ids: r.module_ids?.map(Number) ?? [],
    //             }))
    //         );

    //         setUsers(
    //             usersRes.data.map((u: any) => ({
    //                 ...u,
    //                 id: Number(u.id),
    //                 role: { ...u.role, id: Number(u.role?.id) },
    //             }))
    //         );
    //     } catch (err) {
    //         console.error("Failed to load users/roles data:", err);
    //         toast.error("Could not load users and roles");
    //     } finally {
    //         setLoading(false);
    //     }
    // }, [currentSchool?.id]);
    const loadData = useCallback(async () => {
        if (!currentSchool?.id) {
            toast.error("No school selected");
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            // 1. Modules (should already work from previous pages)
            let modules = [];
            try {
                const modulesRes = await api.get("/modules/");
                modules = modulesRes.data.map((m: any) => ({ ...m, id: Number(m.id) }));
            } catch (err: any) {
                console.warn("Failed to load modules:", err?.response?.status);
                toast.warning("Could not load module list");
            }
            setAllModules(modules);

            // 2. Roles – most likely missing
            let loadedRoles = [];
            try {
                const rolesRes = await api.get("/roles/");
                loadedRoles = rolesRes.data.map((r: any) => ({
                    ...r,
                    id: Number(r.id),
                    module_ids: r.module_ids?.map(Number) ?? [],
                }));
            } catch (err: any) {
                console.warn("Failed to load roles:", err?.response?.status);
                if (err?.response?.status === 404) {
                    toast.info("Roles endpoint not found yet – create it on backend");
                } else {
                    toast.error("Failed to load roles");
                }
            }
            setRoles(loadedRoles);

            // 3. School users
            let loadedUsers = [];
            try {
                const usersRes = await api.get(`/schools/${currentSchool.id}/users/`);
                loadedUsers = usersRes.data.map((u: any) => ({
                    ...u,
                    id: Number(u.id),
                    role: { ...u.role, id: Number(u.role?.id) },
                }));
            } catch (err: any) {
                console.warn("Failed to load users:", err?.response?.status);
                if (err?.response?.status === 404) {
                    toast.info("Users list endpoint not implemented yet");
                } else {
                    toast.error("Failed to load school users");
                }
            }
            setUsers(loadedUsers);

        } catch (unexpectedErr) {
            console.error("Unexpected error in loadData:", unexpectedErr);
            toast.error("Something went wrong while loading data");
        } finally {
            setLoading(false);
        }
    }, [currentSchool?.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // ─── User Actions ────────────────────────────────────────
    const handleAddUser = async () => {
        if (!currentSchool?.id || !newUser.role_id) {
            toast.error("Please fill all required fields");
            return;
        }

        setActionLoading(true);
        try {
            const payload = {
                ...newUser,
                role: Number(newUser.role_id),
            };

            const response = await api.post(`/schools/${currentSchool.id}/users/`, payload);

            setUsers((prev) => [...prev, response.data]);
            setNewUser({ first_name: "", last_name: "", email: "", role_id: "" });
            toast.success("User created successfully");
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "Failed to add user");
        } finally {
            setActionLoading(false);
        }
    };

    // ─── Role Actions ────────────────────────────────────────
    const handleSaveRole = async () => {
        if (!roleForm.name.trim()) {
            toast.error("Role name is required");
            return;
        }

        setActionLoading(true);
        try {
            if (editingRole) {
                const response = await api.patch(`/roles/${editingRole.id}/`, roleForm);
                setRoles(prev => prev.map(r => r.id === editingRole.id ? response.data : r));
                setEditingRole(null);
            } else {
                const response = await api.post("/roles/", roleForm);
                setRoles(prev => [...prev, response.data]);
            }
            setRoleForm({ name: "", description: "", module_ids: [] });
            toast.success(`Role ${editingRole ? "updated" : "created"} successfully`);
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
                        Manage school users and define what each role can access.
                    </p>
                </div>

                <Tabs defaultValue="users" className="space-y-8">
                    <TabsList className="bg-white border">
                        <TabsTrigger value="users">Users</TabsTrigger>
                        <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
                    </TabsList>

                    {/* USERS TAB */}
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
                                                    value={newUser.role_id}
                                                    onValueChange={(value) =>
                                                        setNewUser({ ...newUser, role_id: value })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select role" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {roles.map((role) => (
                                                            <SelectItem key={role.id} value={role.id.toString()}>
                                                                {role.name}
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
                                                        <Button variant="ghost" size="icon">
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="text-destructive">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ROLES TAB */}
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
                                        </DialogHeader>

                                        <div className="grid gap-5 py-4">
                                            <div>
                                                <Label>Role Name *</Label>
                                                <Select
                                                    value={roleForm.name}
                                                    onValueChange={(value) =>
                                                        setRoleForm({ ...roleForm, name: value })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Choose or type role name" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {PREDEFINED_ROLES.map((role) => (
                                                            <SelectItem key={role} value={role}>
                                                                {role}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div>
                                                <Label>Description (optional)</Label>
                                                <Input
                                                    value={roleForm.description}
                                                    onChange={(e) =>
                                                        setRoleForm({ ...roleForm, description: e.target.value })
                                                    }
                                                />
                                            </div>

                                            <div>
                                                <Label>Permissions (Modules)</Label>
                                                <div className="mt-3 grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2">
                                                    {allModules.map((module) => (
                                                        <div
                                                            key={module.id}
                                                            className="flex items-center space-x-2"
                                                        >
                                                            <Checkbox
                                                                id={`mod-${module.id}`}
                                                                checked={roleForm.module_ids.includes(module.id)}
                                                                onCheckedChange={() => toggleModule(module.id)}
                                                            />
                                                            <label
                                                                htmlFor={`mod-${module.id}`}
                                                                className="text-sm cursor-pointer"
                                                            >
                                                                {module.name}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex gap-3 pt-2">
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
                                                    disabled={actionLoading}
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
                                {roles.map((role) => (
                                    <Card key={role.id} className="overflow-hidden">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-lg">{role.name}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-muted-foreground min-h-[2.5rem] mb-4">
                                                {role.description || "No description provided"}
                                            </p>

                                            <div className="mb-4">
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
                                ))}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}