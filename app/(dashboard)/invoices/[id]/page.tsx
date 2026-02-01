import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import InvoiceView from "./invoice-view"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

import { ActivityTimeline } from "@/components/activity-timeline"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, clients(*), invoice_items(*)")
    .eq("id", id)
    .single()

  if (!invoice) {
    notFound()
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Invoice Details</h1>
      </div>
      <InvoiceView invoice={invoice} />
      
      <Card>
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
