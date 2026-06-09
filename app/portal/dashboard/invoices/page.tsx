import { getPortalSession } from '../../actions'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const STATUS_BADGE: Record<string, string> = {
  Paid: 'default',
  Overdue: 'destructive',
  Pending: 'secondary',
  Draft: 'outline',
  Cancelled: 'outline',
}

export default async function PortalInvoicesPage() {
  const session = await getPortalSession()
  if (!session) return null

  let adminSupabase
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    adminSupabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
  } else {
    adminSupabase = await createClient()
  }

  const { data: invoices } = await adminSupabase
    .from('invoices')
    .select('*')
    .eq('client_id', session.clientId)
    .eq('workspace_id', session.workspaceId)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Your Invoices</h1>
      <p className="text-muted-foreground">View and manage all your invoices in one place.</p>
      
      <Card className="border-border/40 bg-background/60 backdrop-blur-xl">
        <CardContent className="p-0">
          {!invoices || invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No invoices found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/40">
                  <TableHead className="pl-6">Invoice Number</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice: any) => (
                  <TableRow key={invoice.id} className="border-border/40 hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium pl-6">{invoice.invoice_number}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(invoice.issue_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {invoice.currency} {Number(invoice.total).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[invoice.status] as any || 'secondary'}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/portal/${invoice.id}`}>View Invoice</Link>
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
