import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getWorkspaceBySlug } from "@/lib/workspace"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Eye, Edit } from "lucide-react"
import { DeleteButton } from "@/components/delete-button"
import { deleteInvoiceAction } from "./actions"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

const STATUS_OPTIONS = ['All', 'Draft', 'Pending', 'Paid', 'Overdue', 'Cancelled']

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

async function getInvoices(workspace_id: string, search?: string, status?: string) {
  const supabase = await createClient()

  let query = supabase.from("invoices")
    .select("*, clients!inner(name)")
    .eq("workspace_id", workspace_id)
    .order("created_at", { ascending: false })

  if (search) {
     query = query.or(`invoice_number.ilike.%${search}%,clients.name.ilike.%${search}%`)
  }

  if (status && status !== 'All') {
    query = query.eq("status", status)
  }

  const { data } = await query
  return data || []
}

export default async function InvoicesPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ workspaceSlug: string }>,
  searchParams: Promise<{ q?: string, status?: string }>
}) {
  const { workspaceSlug } = await params
  const { q, status } = await searchParams

  const supabase = await createClient()
  const currentWorkspace = await getWorkspaceBySlug(supabase, workspaceSlug)
  
  if (!currentWorkspace) return <div>Workspace not found.</div>

  const search = q || ''
  const activeStatus = status || 'All'
  const invoices = await getInvoices(currentWorkspace.id, search, activeStatus)
  const basePath = `/dashboard/${workspaceSlug}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}{activeStatus !== 'All' ? ` · ${activeStatus}` : ''}</p>
        </div>
        {currentWorkspace.role !== 'member' && (
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white border-none">
            <Link href={`${basePath}/invoices/new`}>
              <Plus className="mr-2 h-4 w-4" /> Create Invoice
            </Link>
          </Button>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <form className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            name="q"
            defaultValue={search}
            placeholder="Search invoice # or client..." 
            className="pl-8 bg-background/60 backdrop-blur-md" 
          />
        </form>

        {/* Status Filter Tabs */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTIONS.map((s) => (
            <Link
              key={s}
              href={`${basePath}/invoices?${q ? `q=${q}&` : ''}status=${s}`}
            >
              <Button
                variant={activeStatus === s ? 'default' : 'ghost'}
                size="sm"
                className={activeStatus === s 
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 border-none text-xs px-3' 
                  : 'text-muted-foreground hover:text-foreground text-xs px-3'
                }
              >
                {s}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-background/60 backdrop-blur-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 hover:bg-transparent">
              <TableHead>Number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id} className="border-border/40 hover:bg-foreground/5 transition-colors">
                <TableCell className="font-medium font-mono text-sm">{invoice.invoice_number}</TableCell>
                <TableCell>{invoice.clients?.name || 'Unknown'}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell className="tabular-nums font-medium">{CURRENCY_SYMBOLS[invoice.currency] || invoice.currency || '$'}{Number(invoice.total).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[invoice.status] as any || 'secondary'}>
                    {invoice.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                      <Link href={`${basePath}/invoices/${invoice.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    
                    {currentWorkspace.role !== 'member' && (
                      <>
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                          <Link href={`${basePath}/invoices/${invoice.id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <DeleteButton id={invoice.id} action={deleteInvoiceAction.bind(null, workspaceSlug)} />
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <p>No invoices found.</p>
                    {activeStatus !== 'All' && (
                      <Link href={`${basePath}/invoices`}>
                        <Button variant="ghost" size="sm">Clear filters</Button>
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
