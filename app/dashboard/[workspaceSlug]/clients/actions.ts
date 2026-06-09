'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getCurrentWorkspace, findWorkspace } from '@/lib/workspace'

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
})

async function verifyRBAC(supabase: any, workspace_id: string, user_id: string) {
  const { data } = await supabase.from('workspace_members')
     .select('role')
     .eq('workspace_id', workspace_id)
     .eq('user_id', user_id)
     .single()
  
  if (!data || data.role === 'member') {
     throw new Error("Unauthorized: Members cannot perform this action.")
  }
}

export async function createClientAction(workspaceSlug: string, prevState: any, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }
  
  const rawData = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string,
    address: formData.get('address') as string,
  }

  const workspace = await findWorkspace(supabase, workspaceSlug)
  if (!workspace) return { error: "No workspace found." }

  try {
     await verifyRBAC(supabase, workspace.id, user.id)
  } catch (e: any) {
     return { error: e.message }
  }

  const validated = clientSchema.safeParse(rawData)

  if (!validated.success) {
    return { error: 'Invalid inputs', errors: validated.error.flatten().fieldErrors }
  }

  const { error } = await supabase.from('clients').insert({
    ...rawData,
    workspace_id: workspace.id
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/dashboard/${workspaceSlug}/clients`)
  redirect(`/dashboard/${workspaceSlug}/clients`)
}

export async function updateClientAction(workspaceSlug: string, id: string, prevState: any, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }
  
  const rawData = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string,
    address: formData.get('address') as string,
  }

  const workspace = await findWorkspace(supabase, workspaceSlug)
  if (!workspace) return { error: "No workspace found." }

  try {
     await verifyRBAC(supabase, workspace.id, user.id)
  } catch (e: any) {
     return { error: e.message }
  }

  const validated = clientSchema.safeParse(rawData)

  if (!validated.success) {
    return { error: 'Invalid inputs', errors: validated.error.flatten().fieldErrors }
  }

  const { error } = await supabase.from('clients').update(rawData).eq('id', id).eq('workspace_id', workspace.id)

  if (error) {
     return { error: error.message }
  }

  revalidatePath(`/dashboard/${workspaceSlug}/clients`)
  redirect(`/dashboard/${workspaceSlug}/clients`)
}

export async function deleteClientAction(workspaceSlug: string, id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    const workspace = await findWorkspace(supabase, workspaceSlug)
    if (!workspace) return { error: "No workspace found." }

    try {
       await verifyRBAC(supabase, workspace.id, user.id)
    } catch (e: any) {
       return { error: e.message }
    }

    const { error } = await supabase.from('clients').delete().eq('id', id).eq('workspace_id', workspace.id)
    
    if (error) {
        return { error: error.message }
    }
    
    revalidatePath(`/dashboard/${workspaceSlug}/clients`)
}

export async function getClientRiskStats(clientId: string) {
  const supabase = await createClient()
  
  // Fetch paid invoices for this client to calculate risk
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('due_date, paid_at')
    .eq('client_id', clientId)
    .eq('status', 'Paid')
    .not('paid_at', 'is', null)

  if (error) {
    console.error("Error fetching risk stats:", error)
    return null
  }

  if (!invoices || invoices.length === 0) {
    return {
      riskLevel: 'Unknown',
      avgDelay: 0,
      totalInvoices: 0,
      lateRate: 0
    }
  }

  let totalDelay = 0
  let lateCount = 0

  invoices.forEach(inv => {
    const due = new Date(inv.due_date).getTime()
    const paid = new Date(inv.paid_at).getTime()
    const diffDays = (paid - due) / (1000 * 3600 * 24)
    
    // Only count positive delay (late payment)
    if (diffDays > 0) {
        totalDelay += diffDays
        lateCount++
    }
  })

  const avgDelay = totalDelay / invoices.length
  const lateRate = (lateCount / invoices.length) * 100

  let riskLevel = 'Low'
  if (avgDelay > 7) riskLevel = 'High'
  else if (avgDelay > 2) riskLevel = 'Medium'

  return {
    riskLevel,
    avgDelay: Math.round(avgDelay * 10) / 10,
    totalInvoices: invoices.length,
    lateRate: Math.round(lateRate)
  }
}

import crypto from 'crypto'

export async function generatePortalToken(workspaceSlug: string, clientId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const workspace = await findWorkspace(supabase, workspaceSlug)
  if (!workspace) return { error: "No workspace found." }

  try {
     await verifyRBAC(supabase, workspace.id, user.id)
  } catch (e: any) {
     return { error: e.message }
  }

  // Generate 32 byte secure token
  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

  // Invalidate old tokens
  await supabase.from('client_portal_access').delete().eq('client_id', clientId)

  const { error } = await supabase.from('client_portal_access').insert({
    workspace_id: workspace.id,
    client_id: clientId,
    token_hash: tokenHash,
    expires_at: expiresAt
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true, token: rawToken }
}

export async function sendWorkspaceMessage(workspaceSlug: string, clientId: string, body: string, disputeId?: string, invoiceId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const workspace = await findWorkspace(supabase, workspaceSlug)
  if (!workspace) return { error: "No workspace found." }

  try {
     await verifyRBAC(supabase, workspace.id, user.id)
  } catch (e: any) {
     return { error: e.message }
  }

  const { error } = await supabase.from('messages').insert({
    workspace_id: workspace.id,
    client_id: clientId,
    sender_type: 'workspace',
    sender_user_id: user.id,
    body,
    dispute_id: disputeId || null,
    invoice_id: invoiceId || null
  })

  if (error) return { error: error.message }
  
  revalidatePath(`/dashboard/${workspaceSlug}/clients/${clientId}/messages`)
  return { success: true }
}

export async function updateDisputeStatus(workspaceSlug: string, disputeId: string, status: string, resolutionNote?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const workspace = await findWorkspace(supabase, workspaceSlug)
  if (!workspace) return { error: "No workspace found." }

  try {
     await verifyRBAC(supabase, workspace.id, user.id)
  } catch (e: any) {
     return { error: e.message }
  }

  const { error } = await supabase.from('disputes')
    .update({ 
      status, 
      resolution_note: resolutionNote,
      resolved_at: status === 'resolved' || status === 'rejected' ? new Date().toISOString() : null
    })
    .eq('id', disputeId)
    .eq('workspace_id', workspace.id)

  if (error) return { error: error.message }

  // Extract client ID from dispute to revalidate properly
  const { data: dispute } = await supabase.from('disputes').select('client_id').eq('id', disputeId).single()
  if (dispute) {
    revalidatePath(`/dashboard/${workspaceSlug}/clients/${dispute.client_id}/messages`)
  }
  
  return { success: true }
}
