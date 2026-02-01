import { createClient } from "@/lib/supabase/server"
import DashboardStats from "@/components/dashboard-stats"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, FileText } from "lucide-react"

async function getStats() {
  const supabase = await createClient()

  // We can fetch data in parallel
  const [invoicesResponse] = await Promise.all([
     supabase.from("invoices").select("total, status"),
  ])

  const invoices = invoicesResponse.data || []
  
  const totalRevenue = invoices
    .filter((inv) => inv.status === "Paid")
    .reduce((acc, curr) => acc + (Number(curr.total) || 0), 0)

  const pendingAmount = invoices
    .filter((inv) => inv.status === "Pending")
    .reduce((acc, curr) => acc + (Number(curr.total) || 0), 0)
    
  const overdueAmount = invoices
    .filter((inv) => inv.status === "Overdue")
    .reduce((acc, curr) => acc + (Number(curr.total) || 0), 0)

  return {
    totalRevenue,
    pendingAmount,
    overdueAmount,
    invoiceCount: invoices.length,
    pendingCount: invoices.filter(i => i.status === "Pending").length,
    overdueCount: invoices.filter(i => i.status === "Overdue").length
  }
}

import { getMonthlyRevenue } from "./revenue-actions"
import { RevenueChart } from "@/components/revenue-chart"
import { ProfitLossChart } from "@/components/profit-loss-chart"
import { AIInsights } from "@/components/ai-insights"
import { updateOverdueInvoices } from "./status-updater"

// ... imports ...

export default async function DashboardPage() {
  // Trigger auto-update check (fire and forget, or await if we want strict consistency)
  await updateOverdueInvoices()

  const stats = await getStats()
  const revenueData = await getMonthlyRevenue()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
         {/* Quick actions could go here too */}
      </div>
      
      <DashboardStats stats={stats} />
      
      <div className="grid gap-4 md:grid-cols-2">
        <RevenueChart data={revenueData} />
        <ProfitLossChart data={revenueData} />
      </div>

      <div className="grid gap-4 md:grid-cols-1">
         <AIInsights revenueData={revenueData} stats={stats} />
      </div>
      
      <div className="mt-8">
         <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
         <div className="flex gap-4">
            <Link href="/clients/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Client
              </Button>
            </Link>
            <Link href="/invoices/new">
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </Link>
         </div>
      </div>
    </div>
  )
}
