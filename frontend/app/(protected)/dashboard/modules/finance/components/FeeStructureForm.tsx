// "use client";

// import { useState, useEffect, useMemo, useCallback } from "react";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogFooter,
// } from "@/components/ui/dialog";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Button } from "@/components/ui/button";
// import { Checkbox } from "@/components/ui/checkbox";
// import { Loader2, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
// import api from "@/utils/api";
// import { toast } from "sonner";
// import { cn } from "@/lib/utils";
// import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";

// interface Props {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   onSuccess: () => void;
//   structureId?: string;
//   cloneFromId?: string;
// }

// interface FeeCategory {
//   id: string;
//   name: string;
//   is_mandatory?: boolean;
//   display_order?: number;
// }

// interface FeeItemDetail {
//   id: string;
//   name: string;
//   amount: number;
//   description?: string;
//   is_new?: boolean;
// }

// interface CategoryGroup {
//   category: FeeCategory;
//   items: FeeItemDetail[];
//   selected: boolean;
//   expanded: boolean;
// }

// export default function FeeStructureForm({
//   open,
//   onOpenChange,
//   onSuccess,
//   structureId,
//   cloneFromId,
// }: Props) {
//   const { currentSchool } = useCurrentSchool();
//   const currencySymbol = currentSchool?.currency_symbol || "KES";

//   const [formData, setFormData] = useState({
//     name: "",
//     description: "",
//     grade_level: "",
//     academic_year: new Date().getFullYear().toString(),
//     billing_period_type: "term",
//     period_name: "Term 1",
//     is_active: true,
//   });

//   const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
//   const [categories, setCategories] = useState<FeeCategory[]>([]);
//   const [gradeLevels, setGradeLevels] = useState<any[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [formLoading, setFormLoading] = useState(false);

//   const [newItem, setNewItem] = useState({
//     name: "",
//     amount: "",
//     category_id: "",
//     description: "",
//   });

//   // --- Helpers ---

//   const totalAmount = useMemo(
//     () =>
//       categoryGroups.reduce(
//         (sum, group) =>
//           sum + (group.selected ? group.items.reduce((iSum, item) => iSum + item.amount, 0) : 0),
//         0
//       ),
//     [categoryGroups]
//   );

//   const hasSelection = useMemo(
//     () => categoryGroups.some((g) => g.selected && g.items.length > 0),
//     [categoryGroups]
//   );

//   const sortedCategories = useMemo(() => {
//     return [...categories].sort((a, b) => {
//       const orderA = a.display_order ?? 999;
//       const orderB = b.display_order ?? 999;
//       return orderA - orderB || a.name.localeCompare(b.name);
//     });
//   }, [categories]);

//   // --- Logic ---

//   const loadData = useCallback(async () => {
//     setFormLoading(true);
//     try {
//       // 1. Fetch static data (Grades & Categories)
//       const [gradesRes, categoriesRes] = await Promise.all([
//         api.get("/academics/grade-levels/", {
//           params: { is_active: true },
//           headers: { "X-School-ID": currentSchool?.id },
//         }),
//         api.get("/finance/categories/", {
//           headers: { "X-School-ID": currentSchool?.id },
//         }),
//       ]);

//       const fetchedGrades = gradesRes.data || [];
//       const fetchedCats = categoriesRes.data || [];
//       setGradeLevels(fetchedGrades);
//       setCategories(fetchedCats);

//       const targetId = structureId || cloneFromId;

//       if (targetId) {
//         // 2. Fetch the existing structure details
//         const res = await api.get(`/finance/structures/${targetId}/`, {
//           headers: { "X-School-ID": currentSchool?.id },
//         });
//         const data = res.data;

//         // 3. Set basic form info
//         setFormData({
//           name: cloneFromId ? `${data.name} (Copy)` : (data.name || ""),
//           description: data.description || "",
//           grade_level: data.grade_level?.id || "",
//           academic_year: data.academic_year,
//           billing_period_type: data.billing_period_type || "term",
//           period_name: cloneFromId ? `${data.period_name} (Copy)` : (data.period_name || ""),
//           is_active: data.is_active,
//         });

//         // 4. Map existing items into their respective categories
//         const mappedGroups = fetchedCats.map((cat: FeeCategory) => {
//           // 1. Filter using item_details.category
//           const matches = (data.structure_items || []).filter((si: any) => {
//             // Safely check item_details for the category ID
//             const itemCatId = si.item_details?.category?.id || si.item_details?.category;
//             return itemCatId === cat.id;
//           });

//           return {
//             category: cat,
//             selected: matches.length > 0,
//             expanded: matches.length > 0,
//             // 2. Map fields from item_details
//             items: matches.map((si: any) => ({
//               // We use the ID from item_details so the backend recognizes it on save
//               id: String(si.item_details?.id || si.item),
//               name: si.item_details?.name || "Unknown Item", // This was the missing link
//               description: si.item_details?.description || "",
//               amount: Number(si.amount || 0),
//               is_new: false
//             }))
//           };
//         });
//         setCategoryGroups(mappedGroups);
//       } else {
//         // 5. Handle New Structure (Empty)
//         setCategoryGroups(fetchedCats.map((cat: FeeCategory) => ({
//           category: cat,
//           items: [],
//           selected: false,
//           expanded: false,
//         })));
//       }
//     } catch (err) {
//       console.error("Load Error:", err);
//       toast.error("Failed to load form data");
//     } finally {
//       setFormLoading(false);
//     }
//   }, [currentSchool?.id, structureId, cloneFromId]);

//   // Handle open/close
//   useEffect(() => {
//     if (open && currentSchool?.id) {
//       loadData();
//     } else if (!open) {
//       // Clear form on close
//       setFormData({
//         name: "",
//         description: "",
//         grade_level: "",
//         academic_year: new Date().getFullYear().toString(),
//         billing_period_type: "term",
//         period_name: "Term 1",
//         is_active: true,
//       });
//       setCategoryGroups([]);
//     }
//   }, [open, currentSchool?.id, loadData]);

//   // --- Handlers ---

//   const handleAddNewItem = () => {
//     if (!newItem.name || !newItem.amount || !newItem.category_id) {
//       return toast.error("Name, category and amount required");
//     }
//     const amount = parseFloat(newItem.amount);
//     const category = categories.find((c) => c.id === newItem.category_id);
//     if (!category) return;

//     const item: FeeItemDetail = {
//       id: `temp_${Date.now()}`,
//       name: newItem.name,
//       description: newItem.description,
//       amount,
//       is_new: true,
//     };

//     setCategoryGroups((prev) =>
//       prev.map((g) =>
//         g.category.id === category.id
//           ? { ...g, items: [...g.items, item], selected: true, expanded: true }
//           : g
//       )
//     );
//     setNewItem({ name: "", amount: "", category_id: "", description: "" });
//   };

//   const removeItem = (categoryId: string, itemId: string) => {
//     setCategoryGroups((prev) =>
//       prev.map((g) =>
//         g.category.id === categoryId
//           ? { ...g, items: g.items.filter((i) => i.id !== itemId) }
//           : g
//       )
//     );
//   };

//   const updateItemAmount = (categoryId: string, itemId: string, amount: number) => {
//     setCategoryGroups((prev) =>
//       prev.map((g) =>
//         g.category.id === categoryId
//           ? { ...g, items: g.items.map((i) => (i.id === itemId ? { ...i, amount } : i)) }
//           : g
//       )
//     );
//   };

//   const toggleCategory = (catId: string) => {
//     setCategoryGroups((prev) =>
//       prev.map((g) => (g.category.id === catId ? { ...g, selected: !g.selected } : g))
//     );
//   };

//   const handleSubmit = async () => {
//     if (!formData.name.trim()) return toast.error("Name required");
//     if (!formData.grade_level) return toast.error("Grade required");
//     if (!hasSelection) return toast.error("Select at least one item");

//     setLoading(true);
//     try {
//       const structureItems = [];
//       for (const group of categoryGroups) {
//         if (!group.selected) continue;
//         for (const item of group.items) {
//           let itemId = item.id;
//           if (item.is_new) {
//             const itemRes = await api.post("/finance/items/", {
//               name: item.name,
//               category: group.category.id,
//               description: item.description,
//               frequency: "per_term",
//               is_active: true,
//             });
//             itemId = itemRes.data.id;
//           }
//           structureItems.push({ item: itemId, amount: item.amount });
//         }
//       }

//       const payload = {
//         ...formData,
//         school: currentSchool?.id,
//         structure_items: structureItems,
//       };

//       const request = structureId
//         ? api.patch(`/finance/structures/${structureId}/`, payload)
//         : api.post("/finance/structures/", payload);

//       await request;
//       toast.success(structureId ? "Structure updated" : "Structure created");
//       onSuccess();
//       onOpenChange(false);
//     } catch (error: any) {
//       toast.error(error.response?.data?.detail || "Failed to save structure");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-6">
//         <DialogHeader>
//           <DialogTitle>
//             {structureId ? "Edit Fee Structure" : cloneFromId ? "Clone Fee Structure" : "Create Fee Structure"}
//           </DialogTitle>
//         </DialogHeader>

//         {formLoading ? (
//           <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin" /></div>
//         ) : (
//           <div className="space-y-6">
//             <section className="grid grid-cols-4 gap-4">
//               <div className="col-span-2">
//                 <Label>Structure Name</Label>
//                 <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
//               </div>
//               <div>
//                 <Label>Grade Level</Label>
//                 <Select value={formData.grade_level} onValueChange={(val) => setFormData({ ...formData, grade_level: val })}>
//                   <SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger>
//                   <SelectContent>
//                     {gradeLevels.map((g) => (
//                       <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//               </div>
//               <div>
//                 <Label>Academic Year</Label>
//                 <Input value={formData.academic_year} onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })} />
//               </div>
//             </section>

//             <div className="grid grid-cols-2 gap-4">
//               <div>
//                 <Label>Billing Frequency</Label>
//                 <Select value={formData.billing_period_type} onValueChange={(val) => setFormData({ ...formData, billing_period_type: val })}>
//                   <SelectTrigger><SelectValue /></SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="term">Termly</SelectItem>
//                     <SelectItem value="semester">Semester</SelectItem>
//                     <SelectItem value="full_year">Full Year</SelectItem>
//                     <SelectItem value="monthly">Monthly</SelectItem>
//                   </SelectContent>
//                 </Select>
//               </div>
//               <div>
//                 <Label>Period Name (e.g. Term 1)</Label>
//                 <Input
//                   value={formData.period_name}
//                   onChange={(e) => setFormData({ ...formData, period_name: e.target.value })}
//                 />
//               </div>
//             </div>

//             <section className="border p-4 rounded bg-slate-50/50">
//               <h3 className="text-sm font-semibold mb-3">Add Custom Item</h3>
//               <div className="grid grid-cols-4 gap-3">
//                 <Input placeholder="Item name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
//                 <Input type="number" placeholder="Amount" value={newItem.amount} onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })} />
//                 <Select value={newItem.category_id} onValueChange={(v) => setNewItem({ ...newItem, category_id: v })}>
//                   <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
//                   <SelectContent>
//                     {sortedCategories.map((cat) => (
//                       <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//                 <Button onClick={handleAddNewItem} variant="secondary"><Plus className="h-4 w-4 mr-1" />Add</Button>
//               </div>
//             </section>

//             <section>
//               <div className="flex justify-between items-center mb-4">
//                 <h3 className="font-semibold">Items Breakdown</h3>
//                 <div className="text-lg font-bold text-secondary-700">{currencySymbol} {totalAmount.toLocaleString()}</div>
//               </div>

//               <div className="space-y-3">
//                 {categoryGroups.map((group) => (
//                   <div key={group.category.id} className={cn("border rounded-lg transition-all", group.selected && "border-primary/50 shadow-sm")}>
//                     <div className="flex justify-between items-center p-3">
//                       <div className="flex items-center gap-3">
//                         <Checkbox checked={group.selected} onCheckedChange={() => toggleCategory(group.category.id)} />
//                         <span className="font-medium">{group.category.name}</span>
//                         <span className="text-xs text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-full">{group.items.length} items</span>
//                       </div>
//                       <Button variant="ghost" size="sm" onClick={() => setCategoryGroups(p => p.map(g => g.category.id === group.category.id ? { ...g, expanded: !g.expanded } : g))}>
//                         {group.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
//                       </Button>
//                     </div>

//                     {group.expanded && (
//                       <div className="bg-slate-50/50 border-t divide-y">
//                         {group.items.length === 0 && <p className="p-4 text-sm text-muted-foreground italic">No items added.</p>}
//                         {group.items.map((item) => (
//                           <div key={item.id} className="p-3 flex justify-between items-center">
//                             <div className="flex-1 text-sm font-medium">{item.name}</div>
//                             <div className="flex items-center gap-3">
//                               <Input type="number" value={item.amount} onChange={(e) => updateItemAmount(group.category.id, item.id, Number(e.target.value))} className="w-24 h-8 text-sm" />
//                               <Button variant="ghost" size="icon" onClick={() => removeItem(group.category.id, item.id)} className="h-8 w-8 text-red-500 hover:bg-red-50">
//                                 <Trash2 className="h-4 w-4" />
//                               </Button>
//                             </div>
//                           </div>
//                         ))}
//                       </div>
//                     )}
//                   </div>
//                 ))}
//               </div>
//             </section>

//             <DialogFooter>
//               <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
//               <Button disabled={loading || !hasSelection} onClick={handleSubmit}>
//                 {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
//                 {structureId ? "Update" : "Save Structure"}
//               </Button>
//             </DialogFooter>
//           </div>
//         )}
//       </DialogContent>
//     </Dialog>
//   );
// }


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
    setFormLoading(true);
    try {
      const [gradesRes, categoriesRes] = await Promise.all([
        api.get("/academics/grade-levels/", {
          params: { is_active: true },
          headers: { "X-School-ID": currentSchool?.id },
        }),
        api.get("/finance/categories/", {
          headers: { "X-School-ID": currentSchool?.id },
        }),
      ]);

      const fetchedGrades = gradesRes.data || [];
      const fetchedCats = categoriesRes.data || [];
      setGradeLevels(fetchedGrades);
      setCategories(fetchedCats);

      const targetId = structureId || cloneFromId;

      if (targetId) {
        const res = await api.get(`/finance/structures/${targetId}/`, {
          headers: { "X-School-ID": currentSchool?.id },
        });
        const data = res.data;

        setFormData({
          name: cloneFromId
            ? `${data.grade_level?.name || data.name} – ${
                String(data.period_name || "").includes("1")
                  ? "Term 2"
                  : String(data.period_name || "").includes("2")
                    ? "Term 3"
                    : "Copy"
              } – ${data.academic_year || ""}`
            : (data.name || ""),
          description: data.description || "",
          grade_level: data.grade_level?.id || "",
          academic_year: data.academic_year,
          billing_period_type: data.billing_period_type || "term",
          period_name: cloneFromId
            ? (String(data.period_name || "").includes("1")
                ? "Term 2"
                : String(data.period_name || "").includes("2")
                  ? "Term 3"
                  : `${data.period_name || "Term"} (Copy)`)
            : (data.period_name || ""),
          is_active: data.is_active,
        });

        const mappedGroups = fetchedCats.map((cat: FeeCategory) => {
          const matches = (data.structure_items || []).filter((si: any) => {
            const itemCatId = si.item_details?.category?.id || si.item_details?.category;
            return itemCatId === cat.id;
          });

          return {
            category: cat,
            selected: matches.length > 0,
            expanded: matches.length > 0,
            items: matches.map((si: any) => ({
              id: String(si.item_details?.id || si.item),
              name: si.item_details?.name || "Unknown Item",
              description: si.item_details?.description || "",
              amount: Number(si.amount || 0),
              is_optional: si.item_details?.is_optional || false, // Loaded from backend
              is_new: false
            }))
          };
        });
        setCategoryGroups(mappedGroups);
      } else {
        setCategoryGroups(fetchedCats.map((cat: FeeCategory) => ({
          category: cat,
          items: [],
          selected: false,
          expanded: false,
        })));
      }
    } catch (err) {
      console.error("Load Error:", err);
      toast.error("Failed to load form data");
    } finally {
      setFormLoading(false);
    }
  }, [currentSchool?.id, structureId, cloneFromId]);

  useEffect(() => {
    if (open && currentSchool?.id) {
      loadData();
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
    if (!formData.name.trim()) return toast.error("Name required");
    if (!formData.grade_level) return toast.error("Grade required");
    if (!hasSelection) return toast.error("Select at least one item");

    setLoading(true);
    try {
      const structureItems = [];
      const optionalIds = [];

      for (const group of categoryGroups) {
        if (!group.selected) continue;
        for (const item of group.items) {
          let itemId = item.id;
          
          // 1. If it's a new item, create it first
          if (item.is_new) {
            const itemRes = await api.post("/finance/items/", {
              name: item.name,
              category: group.category.id,
              description: item.description,
              is_optional: item.is_optional,
              frequency: "per_term",
              is_active: true,
            }, { headers: { "X-School-ID": currentSchool?.id } });
            itemId = itemRes.data.id;
          }

          // 2. Collect for the payload
          structureItems.push({ item: itemId, amount: item.amount });
          if (item.is_optional) optionalIds.push(itemId);
        }
      }

      // 3. SEND EVERYTHING IN ONE PATCH/POST TO THE STRUCTURE
      const payload = {
        ...formData,
        school: currentSchool?.id,
        structure_items: structureItems,
        available_optional_items: optionalIds,
      };

      const request = structureId
        ? api.patch(`/finance/structures/${structureId}/`, payload, { headers: { "X-School-ID": currentSchool?.id } })
        : api.post("/finance/structures/", payload, { headers: { "X-School-ID": currentSchool?.id } });

      await request;
      toast.success(structureId ? "Structure updated" : "Structure created");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to save structure");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>
            {structureId ? "Edit Fee Structure" : cloneFromId ? "Clone Fee Structure" : "Create Fee Structure"}
          </DialogTitle>
        </DialogHeader>

        {formLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin" /></div>
        ) : (
          <div className="space-y-6">
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
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
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
        )}
      </DialogContent>
    </Dialog>
  );
}