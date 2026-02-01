"use server"

import { createClient } from "@/lib/supabase/server"

export async function updateOverdueInvoices() {
  const supabase = await createClient()
  
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // Find IDs to update
  // We can do this in one update query if using direct SQL, 
  // but with Supabase JS client 'update' with filter implies "update ... where ..."
  
  const { error } = await supabase
    .from("invoices")
    .update({ status: "Overdue" })
    .eq("status", "Pending")
    .lt("due_date", today)

  if (error) {
    console.error("Auto-Update Error:", error)
  }
}
