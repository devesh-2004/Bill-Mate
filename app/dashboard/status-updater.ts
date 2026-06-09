"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentWorkspace } from "@/lib/workspace"

export async function updateOverdueInvoices(workspaceId?: string) {
  const supabase = await createClient()
  
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  let workspace_id = workspaceId
  if (!workspace_id) {
     workspace_id = await getCurrentWorkspace(supabase) || ''
  }
  if (!workspace_id) return

  const { error } = await supabase
    .from("invoices")
    .update({ status: "Overdue" })
    .eq("workspace_id", workspace_id)
    .eq("status", "Pending")
    .lt("due_date", today)

  if (error) {
    console.error("Auto-Update Error:", error)
  }
}
