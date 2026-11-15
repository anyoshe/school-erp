"use client";

import { useCallback, useEffect, useState } from "react";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import api from "@/utils/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bus, Loader2, Plus, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";

type RouteRow = {
  id: number | string;
  name: string;
  description?: string;
  distance_km?: number | null;
  term_amount: number;
  is_active: boolean;
  sort_order?: number;
};

export default function TransportPage() {
  const { currentSchool } = useCurrentSchool();
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    distance_km: "",
    term_amount: "",
  });

  const headers = currentSchool?.id
    ? { "X-School-ID": String(currentSchool.id) }
    : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, asg] = await Promise.all([
        api.get("/transport/routes/", { headers }),
        api.get("/transport/assignments/", { headers }).catch(() => ({ data: [] })),
      ]);
      const data = res.data;
      setRoutes(Array.isArray(data) ? data : data?.results || []);
      const ad = asg.data;
      setAssignments(Array.isArray(ad) ? ad : ad?.results || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Failed to load routes");
    } finally {
      setLoading(false);
    }
  }, [currentSchool?.id]);

  useEffect(() => {
    if (currentSchool?.id) load();
  }, [currentSchool?.id, load]);

  const createRoute = async () => {
    if (!form.name.trim() || !form.term_amount) {
      toast.error("Route name and term amount are required");
      return;
    }
    setSaving(true);
    try {
      await api.post(
        "/transport/routes/",
        {
          name: form.name.trim(),
          description: form.description.trim(),
          distance_km: form.distance_km ? Number(form.distance_km) : null,
          term_amount: Number(form.term_amount),
          is_active: true,
        },
        { headers }
      );
      toast.success("Route created");
      setForm({ name: "", description: "", distance_km: "", term_amount: "" });
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not create route");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r: RouteRow) => {
    try {
      await api.patch(
        `/transport/routes/${r.id}/`,
        { is_active: !r.is_active },
        { headers }
      );
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Update failed");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50/50 via-slate-50 to-primary-50/30 p-4 sm:p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Bus className="h-7 w-7 text-primary" />
            Transport
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Define routes and term charges by distance. On clearance or fee billing, pick a route
            so the learner is charged the route amount under School transport.
          </p>
        </div>

        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add route
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label>Route name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Eastlands / Route A"
              />
            </div>
            <div className="space-y-1">
              <Label>Distance (km)</Label>
              <Input
                type="number"
                value={form.distance_km}
                onChange={(e) => setForm((f) => ({ ...f, distance_km: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1">
              <Label>Term amount (KES) *</Label>
              <Input
                type="number"
                value={form.term_amount}
                onChange={(e) => setForm((f) => ({ ...f, term_amount: e.target.value }))}
                placeholder="e.g. 4500"
              />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Pickup zones, notes…"
              />
            </div>
            <div className="flex items-end">
              <Button className="w-full" disabled={saving} onClick={createRoute}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save route"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Active subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            {!assignments.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No active transport subscriptions. Assign via clearance (School transport + route) or
                Returning billing → Include transport.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b text-muted-foreground">
                      <th className="py-2 pr-2">Adm #</th>
                      <th className="py-2 pr-2">Learner</th>
                      <th className="py-2 pr-2">Route</th>
                      <th className="py-2 pr-2 text-right">Term fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => (
                      <tr key={a.id} className="border-b border-slate-100">
                        <td className="py-2 pr-2 font-mono text-xs">{a.admission_number || "—"}</td>
                        <td className="py-2 pr-2">{a.student_name || a.student}</td>
                        <td className="py-2 pr-2">{a.route_name || "—"}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          KSh {Number(a.effective_amount ?? 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <RouteIcon className="h-4 w-4" /> Routes & charges
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : routes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No routes yet. Add routes with term amounts so clearance can offer transport by route.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b text-muted-foreground">
                      <th className="py-2 pr-2">Route</th>
                      <th className="py-2 pr-2">Distance</th>
                      <th className="py-2 pr-2">Term fee</th>
                      <th className="py-2 pr-2">Status</th>
                      <th className="py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="py-2 pr-2 font-medium">
                          {r.name}
                          {r.description ? (
                            <span className="block text-xs text-muted-foreground font-normal">
                              {r.description}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-2">
                          {r.distance_km != null ? `${r.distance_km} km` : "—"}
                        </td>
                        <td className="py-2 pr-2">
                          KSh {Number(r.term_amount || 0).toLocaleString()}
                        </td>
                        <td className="py-2 pr-2">
                          <span
                            className={
                              r.is_active
                                ? "text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-xs"
                                : "text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full text-xs"
                            }
                          >
                            {r.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-2">
                          <Button size="sm" variant="outline" onClick={() => toggleActive(r)}>
                            {r.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
