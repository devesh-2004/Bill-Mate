import InvoiceForm from "../invoice-form"
import { createClient } from "@/lib/supabase/server"
import { getWorkspaceBySlug } from "@/lib/workspace"
import { notFound } from "next/navigation"

export default async function NewInvoicePage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params
  const supabase = await createClient()
  const workspace = await getWorkspaceBySlug(supabase, workspaceSlug)

  if (!workspace) notFound()

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("workspace_id", workspace.id)
    .order("name", { ascending: true })

  return (
    <div className="pb-10">
      <InvoiceForm clients={clients || []} workspaceSlug={workspaceSlug} />
    </div>
  )
}
