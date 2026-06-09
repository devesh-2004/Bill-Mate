'use server'

import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { cookies } from 'next/headers'

export async function verifyPortalToken(token: string, clientId: string) {
  const supabase = await createClient()

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  // We use service role to check this because the user is not authenticated yet.
  let adminSupabase = supabase
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    adminSupabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
  }

  const { data: access, error } = await adminSupabase
    .from('client_portal_access')
    .select('*')
    .eq('client_id', clientId)
    .eq('token_hash', tokenHash)
    .single()

  if (error || !access) {
    return { error: 'Invalid or expired portal token.' }
  }

  if (new Date(access.expires_at) < new Date()) {
    return { error: 'Portal token has expired. Please request a new link.' }
  }

  // Update last used at
  await adminSupabase.from('client_portal_access').update({ last_used_at: new Date().toISOString() }).eq('id', access.id)

  // Set secure cookie. Value is clientId:workspaceId
  const cookieStore = await cookies()
  const payload = `${clientId}:${access.workspace_id}`
  cookieStore.set('billmate_portal_session', payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/portal',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  })

  return { success: true }
}

export async function getPortalSession() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('billmate_portal_session')
  if (!sessionCookie?.value) return null

  const [clientId, workspaceId] = sessionCookie.value.split(':')
  if (!clientId || !workspaceId) return null

  return { clientId, workspaceId }
}

export async function signOutPortal() {
  const cookieStore = await cookies()
  cookieStore.delete('billmate_portal_session')
}

export async function updateBillingProfile(formData: FormData) {
  const session = await getPortalSession()
  if (!session) return { error: 'Unauthorized' }

  let adminSupabase
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    adminSupabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
  } else {
    adminSupabase = await createClient() // fallback
  }

  const rawData = {
    billing_name: formData.get('billing_name') as string,
    billing_email: formData.get('billing_email') as string,
    billing_address: formData.get('billing_address') as string,
  }

  const { error } = await adminSupabase
    .from('clients')
    .update(rawData)
    .eq('id', session.clientId)
    .eq('workspace_id', session.workspaceId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function createDispute(formData: FormData) {
  const session = await getPortalSession()
  if (!session) return { error: 'Unauthorized' }

  let adminSupabase
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    adminSupabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
  } else {
    adminSupabase = await createClient()
  }

  const rawData = {
    workspace_id: session.workspaceId,
    client_id: session.clientId,
    invoice_id: formData.get('invoice_id') as string,
    reason: formData.get('reason') as string,
    details: formData.get('details') as string,
  }

  const { error } = await adminSupabase.from('disputes').insert(rawData)
  if (error) return { error: error.message }
  return { success: true }
}

export async function sendClientMessage(formData: FormData) {
  const session = await getPortalSession()
  if (!session) return { error: 'Unauthorized' }

  let adminSupabase
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    adminSupabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
  } else {
    adminSupabase = await createClient()
  }

  const rawData = {
    workspace_id: session.workspaceId,
    client_id: session.clientId,
    invoice_id: formData.get('invoice_id') as string || null,
    dispute_id: formData.get('dispute_id') as string || null,
    sender_type: 'client',
    body: formData.get('body') as string,
  }

  const { error } = await adminSupabase.from('messages').insert(rawData)
  if (error) return { error: error.message }
  return { success: true }
}
