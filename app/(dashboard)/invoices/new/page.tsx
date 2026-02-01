import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import InvoiceForm from "../invoice-form"
import { createClient } from "@/lib/supabase/server"

export default async function NewInvoicePage() {
  const supabase = await createClient()
  const { data: clients } = await supabase.from("clients").select("id, name")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Create Invoice</h1>
      </div>
      <InvoiceForm clients={clients || []} />
    </div>
  )
}
