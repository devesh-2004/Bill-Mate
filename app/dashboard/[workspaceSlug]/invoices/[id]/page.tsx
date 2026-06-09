import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getWorkspaceBySlug } from "@/lib/workspace"
import InvoiceView from "./invoice-view"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { ActivityTimeline } from "@/components/activity-timeline"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default async function InvoicePage({ params }: { params: Promise<{ workspaceSlug: string, id: string }> }) {
  const { workspaceSlug, id } = await params
  const supabase = await createClient()

  // FIX: Verify user is a member of this workspace before showing invoice
  const workspace = await getWorkspaceBySlug(supabase, workspaceSlug)
  if (!workspace) notFound()

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, clients(*), invoice_items(*)")
    .eq("id", id)
    .eq("workspace_id", workspace.id) // Enforce workspace isolation
    .single()

  if (!invoice) {
    notFound()
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/dashboard/${workspaceSlug}/invoices`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoice Details</h1>
          <p className="text-sm text-muted-foreground">{invoice.invoice_number}</p>
        </div>
      </div>

      <InvoiceView invoice={invoice} workspaceSlug={workspaceSlug} />
      
      <Card className="border-border/40 bg-background/60 backdrop-blur-xl">
        <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
            <ActivityTimeline invoiceId={invoice.id} />
        </CardContent>
      </Card>
    </div>
  )
}
