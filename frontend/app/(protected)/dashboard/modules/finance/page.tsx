"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, FileText, Users, BarChart2 } from "lucide-react";
import api from "@/utils/api";
import { toast } from "sonner";
import Link from "next/link";

export default function FinanceDashboard() {
  const [stats, setStats] = useState({
    totalOutstanding: 0,
    totalRevenue: 0,
    studentCount: 0,
    overdueInvoices: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [outstandingRes, revenueRes, studentsRes, overdueRes] = await Promise.all([
        api.get("invoices/", { params: { status: "unpaid", aggregate: "balance" } }), // Custom backend param if needed
        api.get("payments/", { params: { aggregate: "total" } }),
        api.get("students/count/"), // Assume student endpoint exists
        api.get("invoices/overdue/"),
      ]);
      setStats({
        totalOutstanding: outstandingRes.data.total_balance || 0,
        totalRevenue: revenueRes.data.total_amount || 0,
        studentCount: studentsRes.data.count || 0,
        overdueInvoices: overdueRes.data.length || 0,
      });
    } catch (err) {
      toast.error("Failed to load dashboard stats");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Finance Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balances</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "Loading..." : `KES ${stats.totalOutstanding.toLocaleString()}`}</div>
          </CardContent>
        </Card>
        {/* Similar cards for Total Revenue, Students with Fees, Overdue Invoices */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent Overdue Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Table or list of overdue */}
            <Link href="/dashboard/finance/invoices?filter=overdue">
              <Button variant="outline">View All</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Chart component, e.g. Recharts */}
            <BarChart2 className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <Link href="/dashboard/modules/finance/fee-structures">
          <Button>Manage Fee Structures</Button>
        </Link>
        <Link href="/dashboard/modules/finance/payment-plans">
    <Button className="bg-indigo-600 hover:bg-indigo-700">
      Manage Payment Plans
    </Button>
  </Link>
        <Link href="/dashboard/modules/finance/student-assignments">
          <Button>Assign Fees to Students</Button>
        </Link>
        <Link href="/dashboard/modules/finance/invoices">
          <Button>Generate Invoices</Button>
        </Link>
        <Link href="/dashboard/modules/finance/payments">
          <Button>Record Payments</Button>
        </Link>
        <Link href="/dashboard/modules/finance/reports">
          <Button>View Reports</Button>
        </Link>
      </div>
    </div>
  );
}