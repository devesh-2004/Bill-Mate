import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { resolveDefaultWorkspaceSlug } from "@/lib/workspace"

export default async function DashboardRedirect() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const defaultSlug = await resolveDefaultWorkspaceSlug(supabase)
  
  if (defaultSlug) {
    redirect(`/dashboard/${defaultSlug}`)
  } else {
    // If no workspaces and auto-create failed, redirect to an onboarding flow
    redirect('/onboarding')
  }
}
