import { createClient } from "@/lib/supabase/server"
import { getWorkspaceBySlug } from "@/lib/workspace"
import RecurringForm from "../recurring-form"
import { redirect } from "next/navigation"

export default async function NewRecurringPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params
  const supabase = await createClient()
  const currentWorkspace = await getWorkspaceBySlug(supabase, workspaceSlug)
  if (!currentWorkspace) return <div>Workspace not found.</div>
  if (currentWorkspace.role === "member") redirect(`/dashboard/${workspaceSlug}/recurring`)

  const { data: clients } = await supabase
    .from("clients").select("id, name").eq("workspace_id", currentWorkspace.id).order("name")

  return <RecurringForm clients={clients || []} workspaceSlug={workspaceSlug} />
}
