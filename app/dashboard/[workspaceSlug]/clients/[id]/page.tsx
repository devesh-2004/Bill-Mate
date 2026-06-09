import { createClient } from "@/lib/supabase/server"
import { getWorkspaceBySlug } from "@/lib/workspace"
import { getClientRiskStats } from "../actions"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Edit, AlertTriangle, Clock, FileText, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PortalAccessCard } from "./portal-access-card"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: 'C$', AUD: 'A$', JPY: '¥'
}

const STATUS_BADGE: Record<string, string> = {
  Paid: 'default',
  Overdue: 'destructive',
  Pending: 'secondary',
  Draft: 'outline',
  Cancelled: 'outline',
}

// FIX: params must be a Promise in Next.js 15
export default async function ClientPage({ params }: { params: Promise<{ workspaceSlug: string, id: string }> }) {
  const { workspaceSlug, id } = await params
  const supabase = await createClient()

  // FIX: Verify workspace membership
  const workspace = await getWorkspaceBySlug(supabase, workspaceSlug)
  if (!workspace) notFound()

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id) // Enforce workspace isolation
    .single()

  if (!client) notFound()

  // Fetch client's invoices
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total, currency, due_date")
    .eq("client_id", id)
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })

  const riskStats = await getClientRiskStats(id)

  const getRiskBadgeColor = (level: string) => {
    if (level === 'High') return 'bg-red-500/10 text-red-500 border-red-500/20'
    if (level === 'Medium') return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
    return 'bg-green-500/10 text-green-500 border-green-500/20'
  }

  // FIX: Use workspace-scoped base path for all navigation links
  const basePath = `/dashboard/${workspaceSlug}`

  const totalRevenue = invoices?.filter(i => i.status === 'Paid').reduce((acc, i) => acc + Number(i.total), 0) || 0
  const pendingAmount = invoices?.filter(i => i.status === 'Pending' || i.status === 'Overdue').reduce((acc, i) => acc + Number(i.total), 0) || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* FIX: Use workspace-scoped path */}
          <Button variant="outline" size="icon" asChild>
            <Link href={`${basePath}/clients`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
              {riskStats && riskStats.riskLevel !== 'Unknown' && (
                <Badge className={`border ${getRiskBadgeColor(riskStats.riskLevel)}`} variant="outline">
                  {riskStats.riskLevel} Risk
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Client since {new Date(client.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Messages & Disputes */}
          <Button asChild variant="secondary">
            <Link href={`${basePath}/clients/${client.id}/messages`}>
              <MessageSquare className="mr-2 h-4 w-4" /> Messages
            </Link>
          </Button>
          {/* FIX: Use workspace-scoped edit path */}
          <Button asChild variant="outline">
            <Link href={`${basePath}/clients/${client.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" /> Edit Client
            </Link>
          </Button>
        </div>
      </div>

      {/* Portal Access */}
      <PortalAccessCard workspaceSlug={workspaceSlug} clientId={client.id} />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Contact Info */}
        <Card className="border-border/40 bg-background/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Email</span>
              {client.email
                ? <a href={`mailto:${client.email}`} className="text-indigo-400 hover:underline">{client.email}</a>
                : <span className="text-muted-foreground">N/A</span>
              }
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Phone</span>
              <span>{client.phone || "N/A"}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Address</span>
              <span className="whitespace-pre-wrap text-sm">{client.address || "N/A"}</span>
            </div>
            {client.tax_id && (
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Tax ID</span>
                <span className="font-mono">{client.tax_id}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card className="border-border/40 bg-background/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
            <CardDescription>Based on all invoices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Revenue</p>
              <p className="text-2xl font-bold text-emerald-500">${totalRevenue.toFixed(2)}</p>
            </div>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Outstanding</p>
              <p className="text-2xl font-bold text-amber-500">${pendingAmount.toFixed(2)}</p>
            </div>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Invoices</p>
              <p className="text-2xl font-bold">{invoices?.length || 0}</p>
            </div>
          </CardContent>
        </Card>

        {/* Payment Insights */}
        <Card className="border-border/40 bg-background/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Payment Insights</CardTitle>
            <CardDescription>Calculated from payment history</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!riskStats || riskStats.totalInvoices === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No payment history yet.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> Avg Delay
                    </div>
                    <div className="text-xl font-bold">
                      {riskStats.avgDelay} <span className="text-sm font-normal text-muted-foreground">days</span>
                    </div>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3 w-3" /> Late Rate
                    </div>
                    <div className="text-xl font-bold">
                      {riskStats.lateRate}<span className="text-sm font-normal text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
                {riskStats.riskLevel === 'High' && (
                  <div className="bg-red-500/10 p-3 rounded-md border border-red-500/20 text-sm text-red-400 flex gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>This client frequently pays late. Consider requesting upfront deposits.</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Client's Invoices */}
      <Card className="border-border/40 bg-background/60 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoices
            </CardTitle>
            <CardDescription>{invoices?.length || 0} invoice{invoices?.length !== 1 ? 's' : ''}</CardDescription>
          </div>
          <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white border-none">
            <Link href={`${basePath}/invoices/new`}>
              Create Invoice
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!invoices || invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No invoices for this client yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/40">
                  <TableHead>Number</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id} className="border-border/40 hover:bg-foreground/5">
                    <TableCell className="font-mono text-sm font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="tabular-nums">{CURRENCY_SYMBOLS[invoice.currency] || invoice.currency || '$'}{Number(invoice.total).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[invoice.status] as any || 'secondary'}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`${basePath}/invoices/${invoice.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
