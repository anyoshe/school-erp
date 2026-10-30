"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCurrentSchool } from "@/app/contexts/CurrentSchoolContext";
import api from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2, Sparkles } from "lucide-react";

type Grade = { id: string; name: string };
type Req = {
  id: string;
  grade_level: string;
  grade_level_name?: string;
  item_text: string;
  sort_order: number;
  is_active: boolean;
};

export default function GradeRequirementsPage() {
  const { currentSchool } = useCurrentSchool();
  const headers = useMemo(
    () =>
      currentSchool?.id
        ? { "X-School-ID": String(currentSchool.id) }
        : undefined,
    [currentSchool?.id]
  );

  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradeId, setGradeId] = useState<string>("");
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(false);
  const [newText, setNewText] = useState("");
  const [seeding, setSeeding] = useState(false);

  const loadGrades = useCallback(async () => {
    try {
      const res = await api.get("/academics/grade-levels/", { headers });
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setGrades(list);
      if (!gradeId && list[0]) setGradeId(String(list[0].id));
    } catch {
      toast.error("Could not load grades");
    }
  }, [headers, gradeId]);

  const loadItems = useCallback(async () => {
    if (!gradeId) return;
    setLoading(true);
    try {
      const res = await api.get("/academics/grade-requirements/", {
        headers,
        params: { grade_level: gradeId },
      });
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setItems(list);
    } catch {
      toast.error("Could not load requirements");
    } finally {
      setLoading(false);
    }
  }, [gradeId, headers]);

  useEffect(() => {
    void loadGrades();
  }, [loadGrades]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const addItem = async () => {
    const text = newText.trim();
    if (!text || !gradeId) return;
    try {
      await api.post(
        "/academics/grade-requirements/",
        {
          grade_level: gradeId,
          item_text: text,
          sort_order: items.length,
          is_active: true,
          school: currentSchool?.id,
        },
        { headers }
      );
      setNewText("");
      toast.success("Requirement added");
      void loadItems();
    } catch {
      toast.error("Failed to add");
    }
  };

  const updateItem = async (id: string, patch: Partial<Req>) => {
    try {
      await api.patch(`/academics/grade-requirements/${id}/`, patch, {
        headers,
      });
      void loadItems();
    } catch {
      toast.error("Failed to update");
    }
  };

  const removeItem = async (id: string) => {
    try {
      await api.delete(`/academics/grade-requirements/${id}/`, { headers });
      toast.success("Removed");
      void loadItems();
    } catch {
      toast.error("Failed to remove");
    }
  };

  const seedCbc = async () => {
    setSeeding(true);
    try {
      const res = await api.post(
        "/academics/grade-requirements/seed-cbc-defaults/",
        {},
        { headers }
      );
      toast.success(
        `Seeded ${res.data?.created ?? 0} items across grades (existing lists skipped)`
      );
      void loadItems();
    } catch {
      toast.error("Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-start gap-3">
        <Link href="/dashboard/settings/school/academic">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Grade admission requirements
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lists shown on page 1 of the admission offer letter (before fees).
            Edit per grade or seed CBC defaults.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void seedCbc()}
          disabled={seeding}
          className="shrink-0"
        >
          {seeding ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Seed CBC defaults
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select grade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={gradeId} onValueChange={setGradeId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose grade" />
            </SelectTrigger>
            <SelectContent>
              {grades.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {loading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2"
                >
                  <Input
                    value={it.item_text}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((x) =>
                          x.id === it.id
                            ? { ...x, item_text: e.target.value }
                            : x
                        )
                      )
                    }
                    onBlur={() =>
                      void updateItem(it.id, { item_text: it.item_text })
                    }
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600"
                    onClick={() => void removeItem(it.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No items for this grade. Add below or seed CBC defaults.
                </p>
              )}
            </ul>
          )}

          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="sr-only">New item</Label>
              <Input
                placeholder="e.g. Mathematical set"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addItem();
                }}
              />
            </div>
            <Button onClick={() => void addItem()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
