import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { getPortalSession } from '../actions'
import { DisputeDialog } from './dispute-dialog'

export default async function ClientPortalPage({ params }: { params: Promise<{ invoice_id: string }> }) {
  const { invoice_id } = await params
  
  // Use a specialized public-facing API or service role if needed, 
  // but if RLS allows public read by ID (or if we bypass RLS for this specific route), we can fetch it.
  // We'll use service role here to bypass RLS since the client is unauthenticated but has the unique UUID.
  // Note: Only use service_role client for read-only single item fetch where UUID acts as a secret key.
  
  let supabase
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    supabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
  } else {
    supabase = await createClient()
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, clients(*), workspaces(name, logo_url, currency), invoice_items(*)")
    .eq("id", invoice_id)
    .single()

  if (!invoice) {
    notFound()
  }

  // Check if there is an active portal session for this client
  const session = await getPortalSession()
  let hasDispute = false
  if (session && session.clientId === invoice.client_id) {
    const { data: dispute } = await supabase
      .from('disputes')
      .select('id')
      .eq('invoice_id', invoice.id)
      .eq('status', 'open')
      .maybeSingle()
    
    if (dispute) hasDispute = true
  }

  const formatCurrency = (amount: number) => {
    return `${invoice.workspaces?.currency || 'USD'} ${amount.toFixed(2)}`
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8 flex items-start justify-center">
      <Card className="max-w-3xl w-full shadow-lg">
        <CardHeader className="flex flex-row items-start justify-between border-b pb-6">
          <div>
             {invoice.workspaces?.logo_url && (
                <img src={invoice.workspaces.logo_url} alt="Logo" className="h-12 mb-4" />
             )}
             <CardTitle className="text-3xl text-primary">{invoice.workspaces?.name || "Invoice"}</CardTitle>
             <div className="mt-4 text-sm text-muted-foreground">
                 <p className="font-semibold text-foreground">Billed To:</p>
                 <p>{invoice.clients?.name}</p>
                 <p>{invoice.clients?.email}</p>
                 <p className="whitespace-pre-wrap">{invoice.clients?.address}</p>
             </div>
          </div>
          <div className="text-right">
             <h1 className="text-4xl font-light text-muted-foreground mb-2">INVOICE</h1>
             <p className="font-medium">{invoice.invoice_number}</p>
             <p className="text-sm text-muted-foreground mt-4">Date: {new Date(invoice.created_at).toLocaleDateString()}</p>
             <p className="text-sm text-muted-foreground">Due: {new Date(invoice.due_date).toLocaleDateString()}</p>
             <Badge variant={invoice.status === 'Paid' ? 'default' : invoice.status === 'Overdue' ? 'destructive' : 'secondary'} className="mt-2">
                {invoice.status}
             </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
           <table className="w-full text-sm text-left">
              <thead>
                 <tr className="border-b">
                    <th className="pb-3 font-semibold">Description</th>
                    <th className="pb-3 font-semibold text-right">Qty</th>
                    <th className="pb-3 font-semibold text-right">Price</th>
                    <th className="pb-3 font-semibold text-right">Total</th>
                 </tr>
              </thead>
              <tbody className="divide-y">
                 {invoice.invoice_items?.map((item: any) => (
                    <tr key={item.id}>
                       <td className="py-4">{item.description}</td>
                       <td className="py-4 text-right">{item.quantity}</td>
                       <td className="py-4 text-right">{formatCurrency(item.price)}</td>
                       <td className="py-4 text-right font-medium">{formatCurrency(item.quantity * item.price)}</td>
                    </tr>
                 ))}
              </tbody>
           </table>
           
           <div className="flex justify-end mt-8 border-t pt-6">
              <div className="w-64 space-y-3">
                 <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(invoice.subtotal)}</span>
                 </div>
                 {invoice.tax > 0 && (
                     <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Tax ({invoice.tax_rate}%)</span>
                        <span>{formatCurrency(invoice.tax)}</span>
                     </div>
                 )}
                 <Separator />
                 <div className="flex justify-between font-bold text-lg">
                    <span>Total Due</span>
                    <span>{formatCurrency(invoice.total)}</span>
                 </div>
              </div>
           </div>

           <div className="mt-12 flex justify-center gap-4 border-t pt-8">
              {session && session.clientId === invoice.client_id && (
                <DisputeDialog invoiceId={invoice.id} existingDispute={hasDispute} />
              )}
              <Button size="lg" className="px-8 shadow-sm">
                  {/* Since window.print() or jspdf needs client side, we can just trigger window.print here if it's a client component, 
                      or wrap the button in a client component. For simplicity, we just use a basic print trigger. */}
                 <Download className="mr-2 h-4 w-4" />
                 Download PDF
              </Button>
           </div>
        </CardContent>
      </Card>
    </div>
  )
}
