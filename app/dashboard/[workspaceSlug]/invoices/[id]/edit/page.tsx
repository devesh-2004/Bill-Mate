import { notFound } from "next/navigation"
import InvoiceForm from "../../invoice-form"
import { createClient } from "@/lib/supabase/server"
import { getWorkspaceBySlug } from "@/lib/workspace"

export default async function EditInvoicePage({ params }: { params: Promise<{ workspaceSlug: string, id: string }> }) {
  const { workspaceSlug, id } = await params
  const supabase = await createClient()
  const workspace = await getWorkspaceBySlug(supabase, workspaceSlug)

  if (!workspace) notFound()

  // Fetch invoice with items
  const { data: invoice } = await supabase.from("invoices")
    .select("*, invoice_items(*)")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .single()
    
  const { data: clients } = await supabase.from("clients")
    .select("id, name")
    .eq("workspace_id", workspace.id)

  if (!invoice) notFound()

  return (
    <div className="pb-10">
      <InvoiceForm invoice={invoice} clients={clients || []} workspaceSlug={workspaceSlug} />
    </div>
  )
}
