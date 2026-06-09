import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client. Bypasses RLS — use ONLY in trusted server
 * contexts (webhooks, the BullMQ worker, the token-authenticated client portal,
 * and the API-key-authenticated developer API). Never import this into a
 * Client Component or expose the key to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase admin credentials (URL / SERVICE_ROLE_KEY).')
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
