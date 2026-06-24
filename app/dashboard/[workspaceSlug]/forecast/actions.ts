'use server'

import { createClient } from '@/lib/supabase/server'
import { findWorkspace } from '@/lib/workspace'
import { generateForecastText } from '@/lib/ai'
import { createNotification } from '@/lib/notifications'
import type { ForecastContent } from '@/lib/types'

/**
 * Generates a financial forecast for the workspace using Gemini, then persists
 * it to ai_reports (report_type = 'forecast'). Reuses the existing AI report
 * model rather than introducing a new table.
 */
export async function generateForecastAction(workspaceSlug: string) {
  const supabase = await createClient()
  const workspace = await findWorkspace(supabase, workspaceSlug, 'id, currency')
  if (!workspace) return { error: 'No workspace found.' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // AI report notifications are addressed to the triggering user only (avoids
  // broadcasting transient "started/completed" noise to the whole team).
  await createNotification(supabase, {
    workspace_id: workspace.id, user_id: user.id, type: 'system',
    title: 'AI report started', body: 'Generating your financial forecast…',
  })

  // Gather the financial signals.
  const { data: invoices } = await supabase
    .from('invoices')
    .select('status, total, due_date, paid_at')
    .eq('workspace_id', workspace.id)

  const now = new Date()
  let overdueAmount = 0, overdueCount = 0, pendingAmount = 0, pendingCount = 0
  const monthly: Record<string, number> = {}

  for (const inv of invoices || []) {
    const total = Number(inv.total || 0)
    if (inv.status === 'Paid' && inv.paid_at) {
      const key = new Date(inv.paid_at).toISOString().slice(0, 7) // YYYY-MM
      monthly[key] = (monthly[key] || 0) + total
    } else if (inv.status === 'Overdue' || (inv.status === 'Pending' && inv.due_date && new Date(inv.due_date) < now)) {
      overdueAmount += total; overdueCount++
    } else if (inv.status === 'Pending') {
      pendingAmount += total; pendingCount++
    }
  }

  const monthlyRevenue = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, revenue]) => ({ month, revenue }))

  const ai = await generateForecastText({
    overdueAmount, overdueCount, pendingAmount, pendingCount,
    monthlyRevenue, currency: workspace.currency || 'USD',
  })
  if (ai.error) {
    await createNotification(supabase, {
      workspace_id: workspace.id, user_id: user.id, type: 'system',
      title: 'AI report failed', body: 'Forecast generation failed. Please try again.',
    })
    return { error: ai.error }
  }

  const content: ForecastContent = {
    cashFlowPrediction: ai.cashFlowPrediction || '',
    riskScore: ai.riskScore ?? 50,
    riskLevel: ai.riskLevel || 'medium',
    recommendations: ai.recommendations || [],
    generatedFor: now.toISOString(),
  }

  const { error } = await supabase.from('ai_reports').insert({
    workspace_id: workspace.id,
    report_type: 'forecast',
    content,
  })
  if (error) {
    await createNotification(supabase, {
      workspace_id: workspace.id, user_id: user.id, type: 'system',
      title: 'AI report failed', body: 'Could not save the forecast. Please try again.',
    })
    return { error: error.message }
  }

  await supabase.from('activity_logs').insert({
    workspace_id: workspace.id, user_id: user.id,
    entity_type: 'workspace', entity_id: workspace.id,
    action: 'forecast_generated', metadata: { riskScore: content.riskScore },
  })

  await createNotification(supabase, {
    workspace_id: workspace.id, user_id: user.id, type: 'system',
    title: 'AI report ready', body: 'Your financial forecast has been generated.',
    link: `/dashboard/${workspaceSlug}/forecast`,
  })

  return { content }
}
