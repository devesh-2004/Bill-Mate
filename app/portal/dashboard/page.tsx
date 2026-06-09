import { getPortalSession } from '../actions'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { FileText, AlertCircle, Clock, CheckCircle } from 'lucide-react'

export default async function PortalDashboardOverview() {
  const session = await getPortalSession()
  if (!session) return null

  let adminSupabase
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    adminSupabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
  } else {
    adminSupabase = await createClient()
  }

  // Fetch recent invoices
  const { data: invoices } = await adminSupabase
    .from('invoices')
    .select('*')
    .eq('client_id', session.clientId)
    .eq('workspace_id', session.workspaceId)
    .order('created_at', { ascending: false })
    .limit(5)

  // Fetch active disputes
  const { data: disputes } = await adminSupabase
    .from('disputes')
    .select('id, status, invoices(invoice_number)')
    .eq('client_id', session.clientId)
    .eq('workspace_id', session.workspaceId)
    .eq('status', 'open')

  const totalOutstanding = invoices?.filter(i => i.status === 'Pending' || i.status === 'Overdue')
    .reduce((acc, i) => acc + Number(i.total), 0) || 0

  const currency = invoices?.[0]?.currency || 'USD'

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
      
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-indigo-100 text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Outstanding Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{currency} {totalOutstanding.toFixed(2)}</div>
            <p className="text-xs text-indigo-200 mt-1">Please pay pending invoices promptly.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> Total Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{invoices?.length || 0}</div>
            <Button variant="link" className="px-0 h-auto text-xs mt-1" asChild>
              <Link href="/portal/dashboard/invoices">View all invoices →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Active Disputes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{disputes?.length || 0}</div>
            <Button variant="link" className="px-0 h-auto text-xs mt-1" asChild>
              <Link href="/portal/dashboard/messages">View updates →</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-bold mt-8 mb-4">Recent Invoices</h2>
      <div className="grid gap-4">
        {!invoices || invoices.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
            No invoices found.
          </div>
        ) : (
          invoices.map((invoice: any) => (
            <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg bg-card shadow-sm">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full ${
                  invoice.status === 'Paid' ? 'bg-green-100 text-green-600' :
                  invoice.status === 'Overdue' ? 'bg-red-100 text-red-600' :
                  'bg-yellow-100 text-yellow-600'
                }`}>
                  {invoice.status === 'Paid' ? <CheckCircle className="h-5 w-5" /> : 
                   invoice.status === 'Overdue' ? <AlertCircle className="h-5 w-5" /> :
                   <Clock className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="font-semibold">{invoice.invoice_number}</h3>
                  <p className="text-sm text-muted-foreground">Due: {new Date(invoice.due_date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="font-bold">{invoice.currency} {Number(invoice.total).toFixed(2)}</div>
                  <div className="text-xs font-medium uppercase tracking-wider">{invoice.status}</div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/portal/${invoice.id}`}>View</Link>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
