"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentWorkspace } from "@/lib/workspace"
import { generatePaymentReminderText } from "@/lib/ai"
import { createNotification } from "@/lib/notifications"

export async function generatePaymentReminder(invoice: any, clientName: string) {
  const result = await generatePaymentReminderText(invoice, clientName)
  
  if (result.text) {
    // Log usage to Activity Logs
    const supabase = await createClient()
    const workspace_id = await getCurrentWorkspace(supabase)
    const { data: { user } } = await supabase.auth.getUser()

    if (workspace_id && user) {
        await supabase.from("activity_logs").insert({
            workspace_id,
            user_id: user.id,
            entity_type: "invoice",
            entity_id: invoice.id,
            action: "ai_reminder_generated",
            metadata: { text: result.text }
        })
    }
  }
  
  return result
}

export async function markReminderSent(invoiceId: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from("invoices")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", invoiceId)
    
    if (error) return { error: error.message }

    // Surface "invoice sent to client" in the bell.
    const { data: inv } = await supabase
        .from("invoices")
        .select("workspace_id, invoice_number")
        .eq("id", invoiceId)
        .maybeSingle()
    if (inv) {
        await createNotification(supabase, {
            workspace_id: inv.workspace_id,
            type: "invoice",
            title: "Invoice sent",
            body: `Invoice ${inv.invoice_number} sent to client.`,
            entity_type: "invoice",
            entity_id: invoiceId,
        })
    }
    return { success: true }
}
