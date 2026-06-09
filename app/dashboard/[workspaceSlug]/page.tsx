import { createClient } from "@/lib/supabase/server"
import { getCurrentWorkspace } from "@/lib/workspace"
import DashboardStats from "@/components/dashboard-stats"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, FileText } from "lucide-react"

async function getStats(workspace_id: string) {
  const supabase = await createClient()

  if (!workspace_id) {
    return {
      totalRevenue: 0, pendingAmount: 0, overdueAmount: 0,
      invoiceCount: 0, pendingCount: 0, overdueCount: 0, clientCount: 0
    }
  }

  // Fetch invoices and client count in parallel
  const [invoicesResponse, clientsResponse] = await Promise.all([
     supabase.from("invoices").select("total, status").eq("workspace_id", workspace_id),
     supabase.from("clients").select("id", { count: 'exact', head: true }).eq("workspace_id", workspace_id),
  ])

  const invoices = invoicesResponse.data || []
  const clientCount = clientsResponse.count || 0
  
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
    overdueCount: invoices.filter(i => i.status === "Overdue").length,
    clientCount
  }
}

import { getMonthlyRevenue } from "../revenue-actions"
import { RevenueChart } from "@/components/revenue-chart"
import { ProfitLossChart } from "@/components/profit-loss-chart"
import { AIInsights } from "@/components/ai-insights"
import { updateOverdueInvoices } from "../status-updater"

// ... imports ...

import { getWorkspaceBySlug } from "@/lib/workspace"

export default async function DashboardPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params
  const supabase = await createClient()
  const currentWorkspace = await getWorkspaceBySlug(supabase, workspaceSlug)
  
  if (!currentWorkspace) {
    return <div>Workspace not found.</div>
  }

  await updateOverdueInvoices(currentWorkspace.id)

  const stats = await getStats(currentWorkspace.id)
  const revenueData = await getMonthlyRevenue(currentWorkspace.id)

  const basePath = `/dashboard/${workspaceSlug}`

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Overview
            </h1>
            <p className="text-muted-foreground mt-1 text-lg">
              Here is what's happening with your finances today.
            </p>
         </div>
         <div className="flex gap-3">
            <Link href={`${basePath}/clients/new`}>
              <Button variant="secondary" className="bg-background/50 backdrop-blur-md border border-border/50 hover:bg-background/80 transition-all">
                <Plus className="mr-2 h-4 w-4" />
                Add Client
              </Button>
            </Link>
            <Link href={`${basePath}/invoices/new`}>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all border-none">
                <FileText className="mr-2 h-4 w-4" />
                New Invoice
              </Button>
            </Link>
         </div>
      </div>
      
      <DashboardStats stats={stats} />
      
      {/* Analytics Charts */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="md:col-span-1 lg:col-span-4 h-full">
           <RevenueChart data={revenueData} />
        </div>
        <div className="md:col-span-1 lg:col-span-3 h-full">
           <ProfitLossChart data={revenueData} />
        </div>
      </div>

      {/* AI Insights Section */}
      <div className="grid gap-6 grid-cols-1">
         <AIInsights revenueData={revenueData} stats={stats} />
      </div>
      
    </div>
  )
}
