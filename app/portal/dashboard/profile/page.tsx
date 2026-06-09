import { getPortalSession } from '../../actions'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from './profile-form'

export default async function PortalProfilePage() {
  const session = await getPortalSession()
  if (!session) return null

  let adminSupabase
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    adminSupabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
  } else {
    adminSupabase = await createClient()
  }

  const { data: client } = await adminSupabase
    .from('clients')
    .select('*')
    .eq('id', session.clientId)
    .eq('workspace_id', session.workspaceId)
    .single()

  if (!client) return null

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
      <ProfileForm initialData={client} />
    </div>
  )
}
