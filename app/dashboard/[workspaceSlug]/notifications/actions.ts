'use server'

import { createClient } from '@/lib/supabase/server'

export async function markNotificationRead(id: string) {
  const supabase = await createClient()
  // RLS guarantees the user can only update notifications addressed to them
  // (or broadcasts) within their workspaces.
  const { error } = await supabase.from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function markAllNotificationsRead(workspaceId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('read', false)
  if (error) return { error: error.message }
  return { success: true }
}
