import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationType } from './types'

export interface NotifyInput {
  workspace_id: string
  /** Omit (or null) to broadcast to every member of the workspace. */
  user_id?: string | null
  type?: NotificationType
  title: string
  body?: string
  /** Relative app path to deep-link to, e.g. /dashboard/acme/invoices/123 */
  link?: string
  entity_type?: string
  entity_id?: string
}

/**
 * Create a notification. Pass any Supabase client — a server client (RLS,
 * member-initiated) or the admin client (worker / webhooks). Realtime delivery
 * to the bell happens automatically via the supabase_realtime publication.
 */
export async function createNotification(supabase: SupabaseClient, input: NotifyInput) {
  const { error } = await supabase.from('notifications').insert({
    workspace_id: input.workspace_id,
    user_id: input.user_id ?? null,
    type: input.type ?? 'info',
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    entity_type: input.entity_type ?? null,
    entity_id: input.entity_id ?? null,
  })
  if (error) console.error('createNotification failed:', error.message)
  return { error: error?.message }
}
