'use server'

import { createClient } from '@/lib/supabase/server'
import { findWorkspace } from '@/lib/workspace'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const expenseSchema = z.object({
  description: z.string().min(1),
  amount: z.coerce.number().min(0),
  vendor: z.string().optional(),
  category_id: z.string().uuid().optional().or(z.literal('')),
  currency: z.string().default('USD'),
  expense_date: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' }),
  status: z.enum(['recorded', 'reimbursed', 'pending']).default('recorded'),
})

async function resolveContext(workspaceSlug: string) {
  const supabase = await createClient()
  const workspace = await findWorkspace(supabase, workspaceSlug)
  if (!workspace) return { error: 'No workspace found.' as const }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }
  const { data: member } = await supabase.from('workspace_members')
    .select('role').eq('workspace_id', workspace.id).eq('user_id', user.id).single()
  if (!member || member.role === 'member') return { error: 'Unauthorized: Members cannot perform this action.' as const }
  return { supabase, workspace, user }
}

async function uploadReceipt(supabase: any, workspaceId: string, expenseId: string, file: File) {
  const ext = file.name.split('.').pop() || 'bin'
  const path = `${workspaceId}/${expenseId}/receipt.${ext}`
  const { error } = await supabase.storage.from('receipts').upload(path, file, { upsert: true })
  if (error) { console.error('Receipt upload failed:', error.message); return null }
  return path
}

export async function createExpenseAction(workspaceSlug: string, prevState: any, formData: FormData) {
  const ctx = await resolveContext(workspaceSlug)
  if ('error' in ctx) return { error: ctx.error }
  const { supabase, workspace, user } = ctx

  const raw = {
    description: formData.get('description') as string,
    amount: formData.get('amount') as string,
    vendor: (formData.get('vendor') as string) || undefined,
    category_id: (formData.get('category_id') as string) || '',
    currency: (formData.get('currency') as string) || 'USD',
    expense_date: formData.get('expense_date') as string,
    status: (formData.get('status') as string) || 'recorded',
  }
  const validated = expenseSchema.safeParse(raw)
  if (!validated.success) return { error: 'Invalid inputs', errors: validated.error.flatten().fieldErrors }
  const v = validated.data

  const { data: expense, error } = await supabase.from('expenses').insert({
    workspace_id: workspace.id,
    description: v.description,
    amount: v.amount,
    vendor: v.vendor ?? null,
    category_id: v.category_id || null,
    currency: v.currency,
    expense_date: v.expense_date,
    status: v.status,
    created_by: user.id,
  }).select().single()
  if (error) return { error: error.message }

  // Optional receipt upload
  const receipt = formData.get('receipt') as File | null
  if (receipt && receipt.size > 0) {
    const path = await uploadReceipt(supabase, workspace.id, expense.id, receipt)
    if (path) await supabase.from('expenses').update({ receipt_url: path }).eq('id', expense.id)
  }

  await supabase.from('activity_logs').insert({
    workspace_id: workspace.id, user_id: user.id,
    entity_type: 'expense', entity_id: expense.id,
    action: 'created', metadata: { amount: v.amount, description: v.description },
  })

  revalidatePath(`/dashboard/${workspaceSlug}/expenses`)
  return { success: true }
}

export async function deleteExpenseAction(workspaceSlug: string, id: string) {
  const ctx = await resolveContext(workspaceSlug)
  if ('error' in ctx) return { error: ctx.error }
  const { supabase, workspace, user } = ctx

  // Best-effort: remove any stored receipts under this expense's folder.
  const { data: files } = await supabase.storage.from('receipts').list(`${workspace.id}/${id}`)
  if (files?.length) {
    await supabase.storage.from('receipts').remove(files.map((f: any) => `${workspace.id}/${id}/${f.name}`))
  }

  const { error } = await supabase.from('expenses').delete().eq('id', id).eq('workspace_id', workspace.id)
  if (error) return { error: error.message }

  await supabase.from('activity_logs').insert({
    workspace_id: workspace.id, user_id: user.id,
    entity_type: 'expense', entity_id: id, action: 'deleted', metadata: {},
  })
  revalidatePath(`/dashboard/${workspaceSlug}/expenses`)
  return { success: true }
}

export async function createCategoryAction(workspaceSlug: string, name: string, color: string) {
  const ctx = await resolveContext(workspaceSlug)
  if ('error' in ctx) return { error: ctx.error }
  const { supabase, workspace } = ctx
  const { error } = await supabase.from('expense_categories')
    .insert({ workspace_id: workspace.id, name, color })
  if (error) return { error: error.message }
  revalidatePath(`/dashboard/${workspaceSlug}/expenses`)
  return { success: true }
}

/** Returns a short-lived signed URL for viewing a private receipt. */
export async function getReceiptUrlAction(workspaceSlug: string, path: string) {
  const supabase = await createClient()
  const workspace = await findWorkspace(supabase, workspaceSlug)
  if (!workspace || !path.startsWith(`${workspace.id}/`)) return { error: 'Not found' }
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 60 * 5)
  if (error) return { error: error.message }
  return { url: data.signedUrl }
}
