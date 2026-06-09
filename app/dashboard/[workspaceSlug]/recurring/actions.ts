'use server'

import { createClient } from '@/lib/supabase/server'
import { findWorkspace } from '@/lib/workspace'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const recurringSchema = z.object({
  client_id: z.string().uuid(),
  title: z.string().optional(),
  frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  interval_count: z.coerce.number().int().min(1).default(1),
  currency: z.string().default('USD'),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
  discount: z.coerce.number().min(0).default(0),
  due_days: z.coerce.number().int().min(0).default(14),
  auto_send: z.coerce.boolean().default(false),
  start_date: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid start date' }),
  end_date: z.string().optional(),
  max_occurrences: z.coerce.number().int().min(1).optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
})

/** Resolves workspace + enforces non-member role. Mirrors invoices/actions.ts. */
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

export async function createRecurringAction(workspaceSlug: string, prevState: any, formData: FormData) {
  const ctx = await resolveContext(workspaceSlug)
  if ('error' in ctx) return { error: ctx.error }
  const { supabase, workspace, user } = ctx

  const raw = {
    client_id: formData.get('client_id') as string,
    title: (formData.get('title') as string) || undefined,
    frequency: formData.get('frequency') as string,
    interval_count: formData.get('interval_count') as string,
    currency: (formData.get('currency') as string) || 'USD',
    tax_rate: (formData.get('tax_rate') as string) || '0',
    discount: (formData.get('discount') as string) || '0',
    due_days: (formData.get('due_days') as string) || '14',
    auto_send: formData.get('auto_send') === 'on' || formData.get('auto_send') === 'true',
    start_date: formData.get('start_date') as string,
    end_date: (formData.get('end_date') as string) || undefined,
    max_occurrences: (formData.get('max_occurrences') as string) || undefined,
    notes: (formData.get('notes') as string) || undefined,
    terms: (formData.get('terms') as string) || undefined,
  }

  const validated = recurringSchema.safeParse(raw)
  if (!validated.success) {
    return { error: 'Invalid inputs', errors: validated.error.flatten().fieldErrors }
  }

  let lineItems: any[] = []
  try { lineItems = JSON.parse((formData.get('items_json') as string) || '[]') } catch { lineItems = [] }
  if (!lineItems.length) return { error: 'Add at least one line item.' }

  const v = validated.data
  const { data: schedule, error } = await supabase.from('recurring_invoices').insert({
    workspace_id: workspace.id,
    client_id: v.client_id,
    title: v.title ?? null,
    frequency: v.frequency,
    interval_count: v.interval_count,
    currency: v.currency,
    tax_rate: v.tax_rate,
    discount: v.discount,
    due_days: v.due_days,
    auto_send: v.auto_send,
    start_date: v.start_date,
    end_date: v.end_date ?? null,
    max_occurrences: v.max_occurrences ?? null,
    notes: v.notes ?? null,
    terms: v.terms ?? null,
    next_run_at: new Date(v.start_date).toISOString(),
    line_items: lineItems.map((it) => ({
      description: String(it.description || ''),
      quantity: Number(it.quantity || 1),
      price: Number(it.price || 0),
    })),
    created_by: user.id,
  }).select().single()

  if (error) return { error: error.message }

  await supabase.from('activity_logs').insert({
    workspace_id: workspace.id,
    user_id: user.id,
    entity_type: 'recurring_invoice',
    entity_id: schedule.id,
    action: 'created',
    metadata: { frequency: v.frequency, title: v.title },
  })

  revalidatePath(`/dashboard/${workspaceSlug}/recurring`)
  redirect(`/dashboard/${workspaceSlug}/recurring`)
}

export async function setRecurringStatusAction(workspaceSlug: string, id: string, status: 'active' | 'paused' | 'cancelled') {
  const ctx = await resolveContext(workspaceSlug)
  if ('error' in ctx) return { error: ctx.error }
  const { supabase, workspace, user } = ctx

  const { error } = await supabase.from('recurring_invoices')
    .update({ status }).eq('id', id).eq('workspace_id', workspace.id)
  if (error) return { error: error.message }

  await supabase.from('activity_logs').insert({
    workspace_id: workspace.id, user_id: user.id,
    entity_type: 'recurring_invoice', entity_id: id,
    action: 'status_changed', metadata: { status },
  })
  revalidatePath(`/dashboard/${workspaceSlug}/recurring`)
  return { success: true }
}

export async function deleteRecurringAction(workspaceSlug: string, id: string) {
  const ctx = await resolveContext(workspaceSlug)
  if ('error' in ctx) return { error: ctx.error }
  const { supabase, workspace } = ctx
  const { error } = await supabase.from('recurring_invoices').delete().eq('id', id).eq('workspace_id', workspace.id)
  if (error) return { error: error.message }
  revalidatePath(`/dashboard/${workspaceSlug}/recurring`)
  return { success: true }
}
