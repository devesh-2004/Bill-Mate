'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getCurrentWorkspace, findWorkspace } from '@/lib/workspace'

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().min(1),
  price: z.coerce.number().min(0),
})

const invoiceSchema = z.object({
  client_id: z.string().uuid(),
  invoice_number: z.string().min(1),
  // FIX: Added 'Draft' and 'Cancelled' which the form offers but server previously rejected
  status: z.enum(['Draft', 'Paid', 'Pending', 'Overdue', 'Cancelled']),
  issue_date: z.string().optional(),
  due_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date",
  }),
  currency: z.string().default('USD'),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  terms: z.string().optional(),
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

export async function createInvoiceAction(workspaceSlug: string, items: any[], prevState: any, formData: FormData) {
  const supabase = await createClient()
  
  const rawData = {
    client_id: formData.get('client_id') as string,
    invoice_number: formData.get('invoice_number') as string,
    status: formData.get('status') as string,
    issue_date: formData.get('issue_date') as string || undefined,
    due_date: formData.get('due_date') as string,
    currency: formData.get('currency') as string,
    tax_rate: formData.get('tax_rate') as string,
    notes: formData.get('notes') as string || undefined,
    terms: formData.get('terms') as string || undefined,
  }

  const itemsJson = formData.get('items_json') as string
  let parsedItems = []
  try {
     parsedItems = JSON.parse(itemsJson)
  } catch (e) {
     return { error: "Invalid items data" }
  }

  const validated = invoiceSchema.safeParse(rawData)
  if (!validated.success) {
      return { error: 'Invalid inputs', errors: validated.error.flatten().fieldErrors }
  }

  const taxRate = Number(rawData.tax_rate) || 0
  const subtotal = parsedItems.reduce((acc: number, item: any) => acc + (Number(item.quantity) * Number(item.price)), 0)
  const tax = subtotal * (taxRate / 100)
  const total = subtotal + tax

  // Get workspace context
  const workspace = await findWorkspace(supabase, workspaceSlug)
  if (!workspace) return { error: "No workspace found." }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  try {
     await verifyRBAC(supabase, workspace.id, user.id)
  } catch (e: any) {
     return { error: e.message }
  }

  // 1. Create Invoice
  const { data: invoice, error: invoiceError } = await supabase.from('invoices').insert({
    client_id: rawData.client_id,
    invoice_number: rawData.invoice_number,
    status: rawData.status,
    issue_date: rawData.issue_date || null,
    due_date: rawData.due_date,
    currency: rawData.currency,
    tax_rate: taxRate,
    notes: rawData.notes || null,
    terms: rawData.terms || null,
    workspace_id: workspace.id,
    subtotal,
    tax,
    total
  }).select().single()

  if (invoiceError) {
    return { error: invoiceError.message }
  }

  // 2. Create Items
  const itemsToInsert = parsedItems.map((item: any) => ({
    invoice_id: invoice.id,
    description: item.description,
    quantity: Number(item.quantity),
    price: Number(item.price)
  }))

  const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert)

  if (itemsError) {
    return { error: "Invoice created but items failed: " + itemsError.message }
  }

  // Activity Log
  if (user) {
      await supabase.from('activity_logs').insert({
          user_id: user.id,
          workspace_id: workspace.id,
          entity_type: 'invoice',
          entity_id: invoice.id,
          action: 'created',
          metadata: { invoice_number: invoice.invoice_number, total }
      })
  }

  revalidatePath(`/dashboard/${workspaceSlug}/invoices`)
  redirect(`/dashboard/${workspaceSlug}/invoices`)
}

export async function updateInvoiceAction(workspaceSlug: string, id: string, items: any[], prevState: any, formData: FormData) {
    const supabase = await createClient()
    
    const rawData = {
        client_id: formData.get('client_id') as string,
        invoice_number: formData.get('invoice_number') as string,
        status: formData.get('status') as string,
        issue_date: formData.get('issue_date') as string || undefined,
        due_date: formData.get('due_date') as string,
        currency: formData.get('currency') as string,
        tax_rate: formData.get('tax_rate') as string,
        notes: formData.get('notes') as string || undefined,
        terms: formData.get('terms') as string || undefined,
    }

    const itemsJson = formData.get('items_json') as string
    let parsedItems = []
    try {
        parsedItems = JSON.parse(itemsJson)
    } catch (e) {
        return { error: "Invalid items data" }
    }

    const validated = invoiceSchema.safeParse(rawData)
    if (!validated.success) {
        return { error: 'Invalid inputs', errors: validated.error.flatten().fieldErrors }
    }

    const taxRate = Number(rawData.tax_rate) || 0
    const subtotal = parsedItems.reduce((acc: number, item: any) => acc + (Number(item.quantity) * Number(item.price)), 0)
    const tax = subtotal * (taxRate / 100)
    const total = subtotal + tax

    const workspace = await findWorkspace(supabase, workspaceSlug)
    if (!workspace) return { error: "No workspace found." }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    try {
       await verifyRBAC(supabase, workspace.id, user.id)
    } catch (e: any) {
       return { error: e.message }
    }

    // Update Invoice
    const { error: invoiceError } = await supabase.from('invoices').update({
        client_id: rawData.client_id,
        invoice_number: rawData.invoice_number,
        status: rawData.status,
        issue_date: rawData.issue_date || null,
        due_date: rawData.due_date,
        currency: rawData.currency,
        tax_rate: taxRate,
        notes: rawData.notes || null,
        terms: rawData.terms || null,
        subtotal,
        tax,
        total
    }).eq('id', id).eq('workspace_id', workspace.id)

    if (invoiceError) return { error: invoiceError.message }

    // Replace Items
    await supabase.from('invoice_items').delete().eq('invoice_id', id)
    
    const itemsToInsert = parsedItems.map((item: any) => ({
        invoice_id: id,
        description: item.description,
        quantity: Number(item.quantity),
        price: Number(item.price)
    }))
    
    const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert)
    if (itemsError) return { error: itemsError.message }
    
    // Activity Log
    if (user && workspace.id) {
        await supabase.from('activity_logs').insert({
            user_id: user.id,
            workspace_id: workspace.id,
            entity_type: 'invoice',
            entity_id: id,
            action: 'updated',
            metadata: { 
                invoice_number: rawData.invoice_number, 
                status: rawData.status,
                total 
            }
        })
    }
    
    revalidatePath(`/dashboard/${workspaceSlug}/invoices`)
    redirect(`/dashboard/${workspaceSlug}/invoices`)
}

export async function deleteInvoiceAction(workspaceSlug: string, id: string) {
    const supabase = await createClient()
    const workspace = await findWorkspace(supabase, workspaceSlug)
    if (!workspace) return { error: "No workspace found." }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    try {
       await verifyRBAC(supabase, workspace.id, user.id)
    } catch (e: any) {
       return { error: e.message }
    }

    const { error } = await supabase.from('invoices').delete().eq('id', id).eq('workspace_id', workspace.id)
    if (error) return { error: error.message }

    // Activity Log
    if (user && workspace.id) {
        await supabase.from('activity_logs').insert({
            user_id: user.id,
            workspace_id: workspace.id,
            entity_type: 'invoice',
            entity_id: id,
            action: 'deleted',
            metadata: { id }
        })
    }

    revalidatePath(`/dashboard/${workspaceSlug}/invoices`)
}

export async function markInvoicePaidAction(workspaceSlug: string, invoiceId: string) {
    const supabase = await createClient()
    const workspace = await findWorkspace(supabase, workspaceSlug)
    if (!workspace) return { error: "No workspace found." }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    try {
       await verifyRBAC(supabase, workspace.id, user.id)
    } catch (e: any) {
       return { error: e.message }
    }

    const { error } = await supabase.from('invoices')
        .update({ status: 'Paid', paid_at: new Date().toISOString() })
        .eq('id', invoiceId)
        .eq('workspace_id', workspace.id)

    if (error) return { error: error.message }

    // Activity Log
    await supabase.from('activity_logs').insert({
        user_id: user.id,
        workspace_id: workspace.id,
        entity_type: 'invoice',
        entity_id: invoiceId,
        action: 'status_changed',
        metadata: { status: 'Paid', paid_at: new Date().toISOString() }
    })

    revalidatePath(`/dashboard/${workspaceSlug}/invoices`)
    revalidatePath(`/dashboard/${workspaceSlug}/invoices/${invoiceId}`)
    return { success: true }
}
