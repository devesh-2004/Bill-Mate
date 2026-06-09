'use server'

import { createClient } from '@/lib/supabase/server'
import { findWorkspace } from '@/lib/workspace'
import type { SearchResult } from '@/lib/types'

/**
 * Global full-text search across clients, invoices, members, notifications and
 * activity logs via the workspace-scoped search_workspace() Postgres RPC. The
 * RPC enforces membership server-side (SECURITY DEFINER), so isolation holds
 * even though it runs with elevated privileges.
 */
export async function globalSearch(workspaceSlug: string, query: string): Promise<{ results?: SearchResult[]; error?: string }> {
  const q = (query || '').trim()
  if (q.length < 2) return { results: [] }

  const supabase = await createClient()
  const workspace = await findWorkspace(supabase, workspaceSlug)
  if (!workspace) return { error: 'No workspace found.' }

  const { data, error } = await supabase.rpc('search_workspace', {
    p_workspace_id: workspace.id,
    p_query: q,
  })
  if (error) return { error: error.message }
  return { results: (data || []) as SearchResult[] }
}
