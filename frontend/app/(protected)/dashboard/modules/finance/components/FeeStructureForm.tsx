"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import api from "@/utils/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  structureId?: string;
  cloneFromId?: string;
}

interface FeeCategory {
  id: string;
  name: string;
  is_mandatory?: boolean;
  display_order?: number;
}

interface FeeItemDetail {
  id: string;
  name: string;
  amount: number;
  description?: string;
  is_optional: boolean; // Tracking optional status locally
  is_new?: boolean;
}

interface CategoryGroup {
  category: FeeCategory;
  items: FeeItemDetail[];
  selected: boolean;
  expanded: boolean;
}

function asArray(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as any;
    if (Array.isArray(o.results)) return o.results;
    if (Array.isArray(o.data)) return o.data;
  }
  return [];
}

function readFormCache(key: string): any[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (Date.now() - at > 5 * 60 * 1000) return null;
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function writeFormCache(key: string, data: any[]) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch { /* */ }
}

export default function FeeStructureForm({
  open,
  onOpenChange,
  onSuccess,
  structureId,
  cloneFromId,
}: Props) {
  const { currentSchool } = useCurrentSchool();
  const currencySymbol = currentSchool?.currency_symbol || "KES";

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    grade_level: "",
    academic_year: new Date().getFullYear().toString(),
    billing_period_type: "term",
    period_name: "Term 1",
    is_active: true,
  });

  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [gradeLevels, setGradeLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [newItem, setNewItem] = useState({
    name: "",
    amount: "",
    category_id: "",
    description: "",
    is_optional: false,
  });

  // --- Helpers ---

  const totalAmount = useMemo(
    () =>
      categoryGroups.reduce(
        (sum, group) =>
          sum + (group.selected ? group.items.reduce((iSum, item) => iSum + item.amount, 0) : 0),
        0
      ),
    [categoryGroups]
  );

  const hasSelection = useMemo(
    () => categoryGroups.some((g) => g.selected && g.items.length > 0),
    [categoryGroups]
  );

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const orderA = a.display_order ?? 999;
      const orderB = b.display_order ?? 999;
      return orderA - orderB || a.name.localeCompare(b.name);
    });
  }, [categories]);

  // --- Logic ---

  const loadData = useCallback(async () => {
    // Never block the whole dialog on network — show fields immediately
    setFormLoading(false);
    try {
      const schoolId = currentSchool?.id || "none";
      const gradesKey = `erp_fee_form_grades_${schoolId}`;
      const catsKey = `erp_fee_form_cats_${schoolId}`;

      const cachedGrades = readFormCache(gradesKey);
      const cachedCats = readFormCache(catsKey);
      if (cachedGrades?.length) setGradeLevels(cachedGrades);
      if (cachedCats?.length) {
        setCategories(cachedCats);
        if (!structureId && !cloneFromId) {
          setCategoryGroups(
            cachedCats.map((cat: FeeCategory) => ({
              category: cat,
              items: [],
              selected: false,
              expanded: false,
            }))
          );
        }
      }

      // Load independently so one slow endpoint does not block the other.
      // Soft timeout: keep cached data; do not throw for the whole form.
      const softGet = async (url: string, ms = 20000) => {
        try {
          return await Promise.race([
            api.get(url, { headers: { "X-School-ID": currentSchool?.id } }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("timeout")), ms)
            ),
          ]);
        } catch (e: any) {
          if (e?.message === "timeout") {
            console.warn("Slow API:", url, "(using cache if any)");
            return null;
          }
          console.warn("API error:", url, e?.message || e);
          return null;
        }
      };

      const [gradesRes, categoriesRes] = await Promise.all([
        softGet("/academics/grade-levels/"),
        softGet("/finance/categories/"),
      ]);

      if (gradesRes) {
        const fetchedGrades = asArray(gradesRes.data);
        setGradeLevels(fetchedGrades);
        writeFormCache(gradesKey, fetchedGrades);
      }
      if (categoriesRes) {
        const fetchedCats = asArray(categoriesRes.data);
        setCategories(fetchedCats);
        writeFormCache(catsKey, fetchedCats);
        if (!structureId && !cloneFromId) {
          setCategoryGroups(
            fetchedCats.map((cat: FeeCategory) => ({
              category: cat,
              items: [],
              selected: false,
              expanded: false,
            }))
          );
        }
      }

      const fetchedGrades = gradesRes
        ? asArray(gradesRes.data)
        : (readFormCache(gradesKey) || []);
      const fetchedCats = categoriesRes
        ? asArray(categoriesRes.data)
        : (readFormCache(catsKey) || []);

      const targetId = structureId || cloneFromId;
      const catsForMap = fetchedCats.length
        ? fetchedCats
        : (readFormCache(catsKey) || categories);

      if (targetId) {
        const res = await softGet(`/finance/structures/${targetId}/`, 25000);
        if (!res) {
          toast.error("Could not load this fee structure for editing");
          return;
        }
        const data = res.data;

        const gradeId = String(
          data.grade_level?.id ?? data.grade_level ?? ""
        );

        setFormData({
          name: cloneFromId
            ? `${data.grade_level?.name || data.name || "Structure"} – ${
                String(data.period_name || "").includes("1")
                  ? "Term 2"
                  : String(data.period_name || "").includes("2")
                    ? "Term 3"
                    : "Copy"
              } – ${data.academic_year || ""}`
            : (data.name || ""),
          description: data.description || "",
          grade_level: gradeId,
          academic_year: String(data.academic_year || new Date().getFullYear()),
          billing_period_type: data.billing_period_type || "term",
          period_name: cloneFromId
            ? (String(data.period_name || "").includes("1")
                ? "Term 2"
                : String(data.period_name || "").includes("2")
                  ? "Term 3"
                  : `${data.period_name || "Term"} (Copy)`)
            : (data.period_name || "Term 1"),
          is_active: data.is_active !== false,
        });

        // Prefill all structure lines into category groups
        const items = Array.isArray(data.structure_items) ? data.structure_items : [];
        const mappedGroups = (catsForMap as FeeCategory[]).map((cat) => {
          const matches = items.filter((si: any) => {
            const itemCatId =
              si.category_id ??
              si.item_details?.category?.id ??
              si.item_details?.category;
            return String(itemCatId) === String(cat.id);
          });
          const byName =
            matches.length > 0
              ? matches
              : items.filter(
                  (si: any) =>
                    (si.category_name || si.item_details?.category_name) === cat.name
                );
          const use = matches.length ? matches : byName;
          return {
            category: cat,
            selected: use.length > 0,
            expanded: use.length > 0,
            items: use.map((si: any) => ({
              id: String(si.item_details?.id ?? si.item),
              name: si.item_name || si.item_details?.name || si.name || "Fee item",
              description: si.item_details?.description || "",
              amount: Number(si.amount || 0),
              is_optional: !!(
                si.is_optional ??
                si.item_details?.is_optional
              ),
              is_new: false,
            })),
          };
        });

        // Lines whose category is missing from catalogue still show under a bucket
        const mappedIds = new Set(
          mappedGroups.flatMap((g) => g.items.map((i) => String(i.id)))
        );
        const orphans = items.filter((si: any) => {
          const id = String(si.item_details?.id ?? si.item);
          return !mappedIds.has(id);
        });
        if (orphans.length && mappedGroups.length) {
          mappedGroups[0].items.push(
            ...orphans.map((si: any) => ({
              id: String(si.item_details?.id ?? si.item),
              name: si.item_details?.name || "Fee item",
              description: si.item_details?.description || "",
              amount: Number(si.amount || 0),
              is_optional: !!si.item_details?.is_optional,
              is_new: false,
            }))
          );
          mappedGroups[0].selected = true;
          mappedGroups[0].expanded = true;
        }

        setCategoryGroups(mappedGroups);
      } else {
        setCategoryGroups(
          (catsForMap as FeeCategory[]).map((cat) => ({
            category: cat,
            items: [],
            selected: false,
            expanded: false,
          }))
        );
      }
    } catch (err) {
      console.warn("Load Error:", err);
      // Form stays usable with cache / empty dropdowns
    } finally {
      setFormLoading(false);
    }
  }, [currentSchool?.id, structureId, cloneFromId]);

  useEffect(() => {
    if (open && currentSchool?.id) {
      loadData();
    } else if (open && !currentSchool?.id) {
      setFormLoading(false);
      toast.error("Select a school before creating fee structures");
    } else if (!open) {
      setFormData({
        name: "",
        description: "",
        grade_level: "",
        academic_year: new Date().getFullYear().toString(),
        billing_period_type: "term",
        period_name: "Term 1",
        is_active: true,
      });
      setCategoryGroups([]);
    }
  }, [open, currentSchool?.id, loadData]);

  // --- Handlers ---

  const handleAddNewItem = () => {
    if (!newItem.name || !newItem.amount || !newItem.category_id) {
      return toast.error("Name, category and amount required");
    }
    const amount = parseFloat(newItem.amount);
    const category = categories.find((c) => c.id === newItem.category_id);
    if (!category) return;

    const item: FeeItemDetail = {
      id: `temp_${Date.now()}`,
      name: newItem.name,
      description: newItem.description,
      amount,
      is_optional: newItem.is_optional,
      is_new: true,
    };

    setCategoryGroups((prev) =>
      prev.map((g) =>
        g.category.id === category.id
          ? { ...g, items: [...g.items, item], selected: true, expanded: true }
          : g
      )
    );
    setNewItem({ name: "", amount: "", category_id: "", description: "", is_optional: false });
  };

  const removeItem = (categoryId: string, itemId: string) => {
    setCategoryGroups((prev) =>
      prev.map((g) =>
        g.category.id === categoryId
          ? { ...g, items: g.items.filter((i) => i.id !== itemId) }
          : g
      )
    );
  };

  const updateItemField = (categoryId: string, itemId: string, field: keyof FeeItemDetail, value: any) => {
    setCategoryGroups((prev) =>
      prev.map((g) =>
        g.category.id === categoryId
          ? { ...g, items: g.items.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)) }
          : g
      )
    );
  };

  const toggleCategory = (catId: string) => {
    setCategoryGroups((prev) =>
      prev.map((g) => (g.category.id === catId ? { ...g, selected: !g.selected } : g))
    );
  };

  const handleSubmit = async () => {
    if (!currentSchool?.id) return toast.error("No school selected");
    if (!formData.name.trim()) return toast.error("Name required");
    if (!formData.grade_level) return toast.error("Grade required");
    if (!hasSelection) return toast.error("Select at least one fee line (tick a category and add amounts)");

    setLoading(true);
    try {
      const structureItems: { item: number | string; amount: number }[] = [];
      const optionalIds: (number | string)[] = [];

      for (const group of categoryGroups) {
        if (!group.selected || !group.items.length) continue;
        for (const item of group.items) {
          let itemId: number | string = item.id;

          // Create new catalogue items first
          if (item.is_new || String(item.id).startsWith("temp_")) {
            const itemRes = await api.post(
              "/finance/items/",
              {
                name: item.name,
                category: group.category.id,
                description: item.description || "",
                is_optional: !!item.is_optional,
                frequency: "per_term",
                is_active: true,
              },
              { headers: { "X-School-ID": currentSchool.id } }
            );
            itemId = itemRes.data.id;
          }

          const amount = Number(item.amount);
          if (!amount || amount <= 0) {
            throw new Error(`Amount required for ${item.name}`);
          }
          const normalizedId =
            typeof itemId === "string" && /^\d+$/.test(itemId) ? Number(itemId) : itemId;
          structureItems.push({ item: normalizedId, amount });
          if (item.is_optional) optionalIds.push(normalizedId);
        }
      }

      if (structureItems.length === 0) {
        toast.error("Add at least one fee line with an amount before saving");
        return;
      }

      const payload = {
        name: formData.name.trim(),
        description: formData.description || "",
        grade_level: formData.grade_level,
        academic_year: formData.academic_year,
        billing_period_type: formData.billing_period_type || "term",
        period_name: formData.period_name || "Term 1",
        is_active: formData.is_active !== false,
        school: currentSchool.id,
        structure_items: structureItems,
        available_optional_items: optionalIds,
      };

      if (structureId) {
        await api.patch(`/finance/structures/${structureId}/`, payload, {
          headers: { "X-School-ID": currentSchool.id },
        });
      } else {
        await api.post("/finance/structures/", payload, {
          headers: { "X-School-ID": currentSchool.id },
        });
      }

      toast.success(structureId ? "Structure updated" : "Structure created");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Save structure failed", {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
        code: error?.code,
      });
      const d = error?.response?.data;
      let msg = "Failed to save structure";
      if (!error?.response) {
        msg =
          "Network error — is the API running? Check Django terminal and NEXT_PUBLIC_API_URL.";
      } else if (typeof d === "string" && d.trim()) {
        msg = d;
      } else if (d?.detail) {
        msg = String(d.detail);
      } else if (d && typeof d === "object" && Object.keys(d).length) {
        msg = Object.entries(d)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : JSON.stringify(v)}`)
          .join(" · ");
      } else if (error?.response?.status) {
        msg = `Save failed (HTTP ${error.response.status}). Check Django logs.`;
      } else if (error?.message) {
        msg = error.message;
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>
            {structureId ? "Edit fee structure" : cloneFromId ? "Clone fee structure" : "Create fee structure"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {(gradeLevels.length === 0 || categories.length === 0) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border bg-stone-50 px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading grades / fee categories in the background…
            </div>
          )}
            <section className="grid grid-cols-4 gap-4">
              <div className="col-span-2">
                <Label>Structure Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <Label>Grade Level</Label>
                <Select value={formData.grade_level} onValueChange={(val) => setFormData({ ...formData, grade_level: val })}>
                  <SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger>
                  <SelectContent>
                    {gradeLevels.map((g) => (
                      <SelectItem key={String(g.id)} value={String(g.id)}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Academic Year</Label>
                <Input value={formData.academic_year} onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })} />
              </div>
            </section>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Billing Frequency</Label>
                <Select value={formData.billing_period_type} onValueChange={(val) => setFormData({ ...formData, billing_period_type: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="term">Termly</SelectItem>
                    <SelectItem value="semester">Semester</SelectItem>
                    <SelectItem value="full_year">Full Year</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Period Name (e.g. Term 1)</Label>
                <Input
                  value={formData.period_name}
                  onChange={(e) => setFormData({ ...formData, period_name: e.target.value })}
                />
              </div>
            </div>

            <section className="border p-4 rounded bg-slate-50/50">
              <h3 className="text-sm font-semibold mb-3">Add Custom Item</h3>
              <div className="grid grid-cols-5 gap-3 items-end">
                <Input placeholder="Item name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
                <Input type="number" placeholder="Amount" value={newItem.amount} onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })} />
                <Select value={newItem.category_id} onValueChange={(v) => setNewItem({ ...newItem, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    {sortedCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center space-x-2 pb-2">
                    <Checkbox id="is_opt" checked={newItem.is_optional} onCheckedChange={(v) => setNewItem({...newItem, is_optional: !!v})} />
                    <Label htmlFor="is_opt" className="text-xs">Optional?</Label>
                </div>
                <Button onClick={handleAddNewItem} variant="secondary"><Plus className="h-4 w-4 mr-1" />Add</Button>
              </div>
            </section>

            {categories.length === 0 && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3">
                No fee categories yet. Create categories under Finance first, or wait for them to finish loading — you can still fill name, grade, and period above.
              </p>
            )}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Items Breakdown</h3>
                <div className="text-lg font-bold text-secondary-700">{currencySymbol} {totalAmount.toLocaleString()}</div>
              </div>

              <div className="space-y-3">
                {categoryGroups.map((group) => (
                  <div key={group.category.id} className={cn("border rounded-lg transition-all", group.selected && "border-primary/50 shadow-sm")}>
                    <div className="flex justify-between items-center p-3">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={group.selected} onCheckedChange={() => toggleCategory(group.category.id)} />
                        <span className="font-medium">{group.category.name}</span>
                        <span className="text-xs text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-full">{group.items.length} items</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setCategoryGroups(p => p.map(g => g.category.id === group.category.id ? { ...g, expanded: !g.expanded } : g))}>
                        {group.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>

                    {group.expanded && (
                      <div className="bg-slate-50/50 border-t divide-y">
                        {group.items.length === 0 && <p className="p-4 text-sm text-muted-foreground italic">No items added.</p>}
                        {group.items.map((item) => (
                          <div key={item.id} className="p-3 flex justify-between items-center hover:bg-white transition-colors">
                            <div className="flex-1 space-y-1">
                                <div className="text-sm font-medium">{item.name}</div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`opt-${item.id}`} 
                                        checked={item.is_optional} 
                                        onCheckedChange={(v) => updateItemField(group.category.id, item.id, "is_optional", !!v)} 
                                    />
                                    <Label htmlFor={`opt-${item.id}`} className="text-[10px] text-primary-700 font-bold uppercase">Optional Item</Label>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Input 
                                type="number" 
                                value={item.amount} 
                                onChange={(e) => updateItemField(group.category.id, item.id, "amount", Number(e.target.value))} 
                                className="w-24 h-8 text-sm" 
                              />
                              <Button variant="ghost" size="icon" onClick={() => removeItem(group.category.id, item.id)} className="h-8 w-8 text-red-500 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={loading || !hasSelection} onClick={handleSubmit}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {structureId ? "Update" : "Save Structure"}
              </Button>
            </DialogFooter>
          </div>
      </DialogContent>
    </Dialog>
  );
}