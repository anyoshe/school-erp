"use client";

import { useEffect, useState } from "react";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Calendar, DollarSign, AlertCircle } from "lucide-react";

export default function SchoolBillingPage() {
  const { currentSchool } = useCurrentSchool();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Mock data – replace with real API call to your backend
  useEffect(() => {
    setTimeout(() => {
      setSubscription({
        plan: "Standard",
        status: "active",
        nextBilling: "2026-02-15",
        amount: 8500,
        currency: "KES",
        billingCycle: "monthly",
        studentCount: 420,
        studentLimit: 500,
      });
      setLoading(false);
    }, 1200);
  }, []);

  if (loading) return <div className="p-8 text-center">Loading subscription details...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-emerald-600" />
            My School Subscription
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your plan, payment method, and billing history for this school.
          </p>
        </div>

        {/* Current Plan Card */}
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">Current Plan: {subscription.plan}</CardTitle>
              <Badge variant="outline" className="bg-emerald-100 text-emerald-800 px-4 py-1">
                Active
              </Badge>
            </div>
            <CardDescription>
              Next billing on {subscription.nextBilling} • KES {subscription.amount.toLocaleString()} / {subscription.billingCycle}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-white rounded-lg border">
                <div className="text-sm text-gray-600">Students</div>
                <div className="text-2xl font-bold mt-1">
                  {subscription.studentCount} / {subscription.studentLimit}
                </div>
              </div>
              {/* More stats */}
            </div>

            <Separator />

            <div className="flex gap-4">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700">
                Upgrade Plan
              </Button>
              <Button variant="outline" size="lg">
                Update Payment Method
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Plan Comparison / Change Plan */}
        <Card>
          <CardHeader>
            <CardTitle>Available Plans</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Show 3–4 plan cards here with features, prices, "Current" badge */}
            <p className="text-center text-gray-500 py-12">
              Plan comparison coming soon...
            </p>
          </CardContent>
        </Card>

        {/* Billing History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Table of past payments */}
            <div className="text-center py-8 text-gray-500">
              No invoices yet (your subscription is new)
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" size="sm">
              Cancel Subscription
            </Button>
            <p className="text-sm text-gray-500 mt-3">
              Cancelling will downgrade your account after current period ends.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}