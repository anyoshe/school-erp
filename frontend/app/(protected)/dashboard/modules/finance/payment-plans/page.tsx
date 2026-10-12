"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Plus, Trash2, Loader2, CalendarClock } from "lucide-react";
import api from "@/utils/api";
import { toast } from "sonner";

interface PaymentPlan {
  id: number;
  name: string;
  number_of_installments: number;
  frequency: string;
  description: string;
}

export default function PaymentPlansPage() {
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    number_of_installments: 1,
    frequency: "MONTHLY",
    description: "",
  });

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await api.get("/finance/payment-plans/");
      // Handle both paginated results or direct arrays
      setPlans(res.data.results || res.data);
    } catch (err) {
      toast.error("Failed to load payment plans");
    } finally {
      setLoading(false);
    }
  };

 const handleCreate = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Validation
  if (!formData.name) return toast.error("Plan name is required");

  setIsSubmitting(true);

  // We map 'frequency' from the UI to 'plan_type' for the API
  const payload = {
    name: formData.name,
    number_of_installments: formData.number_of_installments,
    plan_type: formData.frequency.toLowerCase(), // Django expects lowercase 'weekly', 'monthly'
    description: formData.description,
  };

  try {
    // Send the correctly formatted payload
    await api.post("/finance/payment-plans/", payload);
    
    toast.success("Payment plan created successfully");
    
    // Reset form
    setFormData({
      name: "",
      number_of_installments: 1,
      frequency: "MONTHLY",
      description: "",
    });
    
    fetchPlans(); // Refresh the table
  } catch (err: any) {
    // This will help you see future errors in the toast
    const errorMsg = err.response?.data 
      ? JSON.stringify(err.response.data) 
      : "Failed to create plan";
    toast.error(errorMsg);
  } finally {
    setIsSubmitting(false);
  }
};

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure? This may affect enrollment options for parents.")) return;
    try {
      await api.delete(`/finance/payment-plans/${id}/`);
      toast.success("Plan removed");
      fetchPlans();
    } catch (err) {
      toast.error("Could not delete plan. It might be linked to active student invoices.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Fee Payment Plans</h1>
        <p className="text-slate-500 text-sm">
          Create flexible schedules (Weekly, Monthly, Termly) to accommodate different parent financial situations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Creation Form */}
        <Card className="lg:col-span-1 border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary-600" />
              Configure New Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Plan Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. Weekly Installments (Term 1)"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Installments</Label>
                  <Input
                    type="number"
                    min="1"
                    max="52"
                    value={formData.number_of_installments}
                    onChange={(e) => updateField("number_of_installments", parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(v) => updateField("frequency", v)}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                      <SelectItem value="TERMLY">Termly</SelectItem>
                      <SelectItem value="CUSTOM">Custom/Partial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc">Internal Description</Label>
                <Input
                  id="desc"
                  placeholder="Notes for finance team..."
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                />
              </div>

              <Button className="w-full bg-primary hover:bg-primary-700" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Save Payment Plan
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List View */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="border-b">
            <CardTitle className="text-lg text-slate-700">Available Plans</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p>Fetching plans...</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Plan Name</TableHead>
                    <TableHead>Installments</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.length > 0 ? (
                    plans.map((plan) => (
                      <TableRow key={plan.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium">{plan.name}</TableCell>
                        <TableCell>{plan.number_of_installments} payments</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 rounded-full bg-primary-50 text-primary-700 text-[10px] font-bold uppercase tracking-wider">
                            {plan.frequency}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(plan.id)}
                            className="hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-slate-400 italic">
                        No payment plans found. Create your first one on the left.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}