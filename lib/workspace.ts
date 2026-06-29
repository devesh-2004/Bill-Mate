import { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createAdminClient } from './supabase/admin'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Resolves a workspace from a URL param that may be either a slug or a UUID
 * (workspaces created by the auto-create fallback have a null slug and are
 * routed by id). Use this in Server Actions instead of `.eq('slug', ...)`.
 * Returns the selected columns, or null. RLS still restricts visibility to
 * workspaces the caller belongs to.
 */
export async function findWorkspace(
  supabase: SupabaseClient,
  slugOrId: string,
  columns: string = 'id'
): Promise<any> {
  const { data } = await supabase
    .from('workspaces')
    .select(columns)
    .eq(UUID_RE.test(slugOrId) ? 'id' : 'slug', slugOrId)
    .maybeSingle()
  return data
}

export async function getCurrentWorkspace(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 1. Check for cookie
  const cookieStore = await cookies()
  const workspaceCookie = cookieStore.get('workspace_id')?.value
  
  if (workspaceCookie) {
    // Optionally verify user is member of this workspace to be safe
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceCookie)
      .single()
      
    if (data) return workspaceCookie
  }

  // 2. Fallback: Get the first workspace the user is a member of
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (data?.workspace_id) {
    return data.workspace_id
  }

  // 3. Auto-create a default workspace if none exists (new user).
  // Bootstrap op (no membership row yet) → use the service role; owner_id is the
  // verified user, so this is safe.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Service role key not configured — skip auto-create; user will be sent to onboarding.
    return null
  }
  const admin = createAdminClient()
  const { data: newWorkspace, error: createError } = await admin
    .from('workspaces')
    .insert({ name: 'My Workspace', owner_id: user.id })
    .select('id')
    .single()

  if (!createError && newWorkspace) {
     await admin.from('workspace_members').upsert(
        { workspace_id: newWorkspace.id, user_id: user.id, role: 'owner' },
        { onConflict: 'workspace_id,user_id', ignoreDuplicates: true }
     )
     return newWorkspace.id
  }

  return null
}

export async function getUserWorkspaces(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('workspace_members')
    .select('role, workspaces(id, name, slug, logo_url)')
    .eq('user_id', user.id)

  if (error || !data) {
    return []
  }

  // Auto-create workspace if new user has none (bootstrap → service role).
  if ((!data || data.length === 0) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
     const admin = createAdminClient()
     const { data: newWorkspace, error: createError } = await admin
        .from('workspaces')
        .insert({ name: 'My Workspace', owner_id: user.id })
        .select()
        .single()

     if (!createError && newWorkspace) {
        await admin.from('workspace_members').upsert(
          { workspace_id: newWorkspace.id, user_id: user.id, role: 'owner' },
          { onConflict: 'workspace_id,user_id', ignoreDuplicates: true }
        )
        return [{ ...newWorkspace, role: 'owner' }]
     }
  }

  return data.map((d: any) => ({
    ...d.workspaces,
    role: d.role
  }))
}

export async function getWorkspaceBySlug(supabase: SupabaseClient, slug: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check if slug is actually a UUID to query by id instead
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)

  let query = supabase
    .from('workspaces')
    .select('id, name, slug, logo_url')

  if (isUuid) {
    query = query.eq('id', slug)
  } else {
    query = query.eq('slug', slug)
  }

  const { data: workspace } = await query.maybeSingle()
  if (!workspace) return null

  // Then, verify the current user is a member and get their role
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return null

  return {
    id: workspace.id as string,
    name: workspace.name as string,
    slug: (workspace.slug || workspace.id) as string, // Fallback to id if slug is null
    logo_url: workspace.logo_url as string | null,
    role: membership.role as string,
  }
}


export async function resolveDefaultWorkspaceSlug(supabase: SupabaseClient) {
   const workspaces = await getUserWorkspaces(supabase)
   if (workspaces && workspaces.length > 0) {
      // Return slug if exists, otherwise return id as fallback for routing
      return workspaces[0].slug || workspaces[0].id
   }
   return null
}
