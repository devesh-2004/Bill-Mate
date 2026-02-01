import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import InvoiceForm from "../../invoice-form"
import { createClient } from "@/lib/supabase/server"

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch invoice with items
  const { data: invoice } = await supabase.from("invoices").select("*, invoice_items(*)").eq("id", id).single()
  const { data: clients } = await supabase.from("clients").select("id, name")

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
        <h1 className="text-2xl font-bold tracking-tight">Edit Invoice</h1>
      </div>
      <InvoiceForm invoice={invoice} clients={clients || []} />
    </div>
  )
}
