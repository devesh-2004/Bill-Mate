import { createClient } from "@/lib/supabase/server"
import { getWorkspaceBySlug } from "@/lib/workspace"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { TrendingUp, TrendingDown, Wallet } from "lucide-react"
import { ExpenseManager } from "./expense-manager"

export default async function ExpensesPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params
  const supabase = await createClient()
  const currentWorkspace = await getWorkspaceBySlug(supabase, workspaceSlug)
  if (!currentWorkspace) return <div>Workspace not found.</div>
  const wsId = currentWorkspace.id
  const canManage = currentWorkspace.role !== "member"

  const [{ data: expenses }, { data: categories }, { data: paidInvoices }] = await Promise.all([
    supabase.from("expenses").select("*, expense_categories(name, color)").eq("workspace_id", wsId).order("expense_date", { ascending: false }),
    supabase.from("expense_categories").select("*").eq("workspace_id", wsId).order("name"),
    supabase.from("invoices").select("total").eq("workspace_id", wsId).eq("status", "Paid"),
  ])

  const totalRevenue = (paidInvoices || []).reduce((a, i: any) => a + Number(i.total || 0), 0)
  const totalExpenses = (expenses || []).reduce((a, e: any) => a + Number(e.amount || 0), 0)
  const profit = totalRevenue - totalExpenses
  const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground text-sm mt-1">Track spending and net profit.</p>
        </div>
        {canManage && <ExpenseManager workspaceSlug={workspaceSlug} categories={categories || []} />}
      </div>

      {/* Revenue vs Expense vs Profit */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-background/60 backdrop-blur-xl border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (Paid)</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-500">{fmt(totalRevenue)}</div></CardContent>
        </Card>
        <Card className="bg-background/60 backdrop-blur-xl border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-500">{fmt(totalExpenses)}</div></CardContent>
        </Card>
        <Card className="bg-background/60 backdrop-blur-xl border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
            <Wallet className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent><div className={`text-2xl font-bold ${profit >= 0 ? "text-indigo-500" : "text-red-500"}`}>{fmt(profit)}</div></CardContent>
        </Card>
      </div>

      <div className="rounded-md border border-border/40 bg-background/60 backdrop-blur-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(expenses || []).map((e: any) => (
              <TableRow key={e.id}>
                <TableCell>{new Date(e.expense_date).toLocaleDateString()}</TableCell>
                <TableCell className="font-medium">{e.description}</TableCell>
                <TableCell>{e.vendor || "—"}</TableCell>
                <TableCell>
                  {e.expense_categories ? (
                    <Badge variant="secondary" style={{ backgroundColor: `${e.expense_categories.color}22`, color: e.expense_categories.color }}>
                      {e.expense_categories.name}
                    </Badge>
                  ) : "—"}
                </TableCell>
                <TableCell className="capitalize">{e.status}</TableCell>
                <TableCell className="text-right font-medium text-red-500">-{fmt(Number(e.amount))}</TableCell>
              </TableRow>
            ))}
            {(!expenses || expenses.length === 0) && (
              <TableRow><TableCell colSpan={6} className="h-24 text-center">No expenses recorded.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
