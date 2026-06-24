'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getWorkspaceBySlug } from '@/lib/workspace'
import { sendEmail } from '@/lib/email'
import { createNotification } from '@/lib/notifications'

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'accountant', 'member']),
})

export async function inviteMember(workspaceSlug: string, prevState: any, formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', success: false }

  const workspace = await getWorkspaceBySlug(supabase, workspaceSlug)
  if (!workspace) return { error: 'Workspace not found', success: false }

  // Only owners and admins can invite
  if (workspace.role !== 'owner' && workspace.role !== 'admin') {
    return { error: 'Only workspace owners and admins can invite members', success: false }
  }

  const rawData = {
    email: formData.get('email') as string,
    role: formData.get('role') as string,
  }

  const validated = inviteSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors.email?.[0] || 'Invalid input', success: false }
  }

  // Privileged member operations use the service role (workspace_members RLS is
  // self-only). RBAC was already enforced above via workspace.role.
  const admin = createAdminClient()

  // Find the user by email via profiles table
  // Note: In production, this would send an email invite. Here we look up by email.
  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('id, email')
    .eq('email', rawData.email)
    .limit(1)
    .maybeSingle()

  // If they don't have an account yet, email them an invitation to sign up.
  // (They get added once they create an account and are re-invited.)
  if (!profiles) {
    await sendEmail({
      to: rawData.email,
      fromName: workspace.name,
      subject: `${workspace.name} invited you to BillMate`,
      text:
        `Hi,\n\n${workspace.name} has invited you to join their workspace on BillMate as a ${rawData.role}.\n\n` +
        `Create your account here to get started: ${APP_URL}/register\n\n` +
        `Once you've signed up, ask them to invite you again and you'll be added automatically.\n\n— ${workspace.name}`,
    })
    await createNotification(supabase, {
      workspace_id: workspace.id,
      type: 'system',
      title: 'Team member invited',
      body: `Invitation sent to ${rawData.email}.`,
      link: `/dashboard/${workspaceSlug}/settings/team`,
    })
    return {
      error: `No BillMate account exists for "${rawData.email}" yet — we've emailed them an invite to sign up. Re-invite them after they register.`,
      success: false,
    }
  }

  // Check if already a member
  const { data: existing } = await admin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspace.id)
    .eq('user_id', profiles.id)
    .maybeSingle()

  if (existing) {
    return { error: 'This user is already a member of this workspace', success: false }
  }

  const { error } = await admin.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: profiles.id,
    role: rawData.role,
  })

  if (error) return { error: error.message, success: false }

  await createNotification(supabase, {
    workspace_id: workspace.id,
    type: 'system',
    title: 'Team member joined',
    body: `${rawData.email} joined the workspace as ${rawData.role}.`,
    link: `/dashboard/${workspaceSlug}/settings/team`,
  })

  // Notify the added member by email (best-effort; never blocks the invite).
  await sendEmail({
    to: rawData.email,
    fromName: workspace.name,
    subject: `You've been added to ${workspace.name} on BillMate`,
    text:
      `Hi,\n\nYou've been added to the "${workspace.name}" workspace on BillMate as a ${rawData.role}.\n\n` +
      `Open it here: ${APP_URL}/dashboard/${workspace.slug}\n\n— ${workspace.name}`,
  })

  revalidatePath(`/dashboard/${workspaceSlug}/settings/team`)
  return { success: true, error: '' }
}

export async function updateMemberRole(workspaceSlug: string, memberId: string, newRole: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const workspace = await getWorkspaceBySlug(supabase, workspaceSlug)
  if (!workspace) return { error: 'Workspace not found' }

  if (workspace.role !== 'owner') {
    return { error: 'Only the workspace owner can change roles' }
  }

  const admin = createAdminClient()

  // Don't allow changing owner's own role
  const { data: memberRecord } = await admin
    .from('workspace_members')
    .select('user_id, role')
    .eq('id', memberId)
    .eq('workspace_id', workspace.id)
    .single()

  if (!memberRecord) return { error: 'Member not found' }
  if (memberRecord.user_id === user.id) return { error: 'You cannot change your own role' }
  if (memberRecord.role === 'owner') return { error: 'Cannot change the owner role' }

  const { error } = await admin
    .from('workspace_members')
    .update({ role: newRole })
    .eq('id', memberId)
    .eq('workspace_id', workspace.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${workspaceSlug}/settings/team`)
  return { success: true }
}

export async function removeMember(workspaceSlug: string, memberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const workspace = await getWorkspaceBySlug(supabase, workspaceSlug)
  if (!workspace) return { error: 'Workspace not found' }

  if (workspace.role !== 'owner' && workspace.role !== 'admin') {
    return { error: 'Only owners and admins can remove members' }
  }

  const admin = createAdminClient()

  // Get the member to check they aren't the owner
  const { data: memberRecord } = await admin
    .from('workspace_members')
    .select('user_id, role')
    .eq('id', memberId)
    .eq('workspace_id', workspace.id)
    .single()

  if (!memberRecord) return { error: 'Member not found' }
  if (memberRecord.role === 'owner') return { error: 'Cannot remove the workspace owner' }
  if (memberRecord.user_id === user.id) return { error: 'You cannot remove yourself' }

  const { error } = await admin
    .from('workspace_members')
    .delete()
    .eq('id', memberId)
    .eq('workspace_id', workspace.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${workspaceSlug}/settings/team`)
  return { success: true }
}
