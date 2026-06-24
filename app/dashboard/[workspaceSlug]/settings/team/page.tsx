import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getWorkspaceBySlug } from "@/lib/workspace"
import { notFound } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { InviteMemberDialog } from "./invite-dialog"
import { MemberActions } from "./member-actions"
import { BiometricSettings } from "@/components/biometric-settings"

const ROLE_BADGE_STYLE: Record<string, string> = {
  owner: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  admin: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  accountant: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  member: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
}

// FIX: Use workspaceSlug from URL params, not from cookies
export default async function TeamSettingsPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params
  const supabase = await createClient()

  // FIX: Use workspace-scoped lookup to ensure multi-tenant isolation
  const currentWorkspace = await getWorkspaceBySlug(supabase, workspaceSlug)
  if (!currentWorkspace) notFound()

  // workspace_members RLS is self-only, so co-member listing uses the service
  // role. Safe: getWorkspaceBySlug already confirmed the caller belongs here,
  // and we scope strictly to currentWorkspace.id.
  const admin = createAdminClient()
  const { data: members } = await admin
    .from("workspace_members")
    .select("id, role, joined_at, profiles(id, full_name, email)")
    .eq("workspace_id", currentWorkspace.id)
    .order("joined_at", { ascending: true })

  const canManage = currentWorkspace.role === 'owner' || currentWorkspace.role === 'admin'

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
          <p className="text-muted-foreground mt-1">
            {members?.length || 0} member{members?.length !== 1 ? 's' : ''} in this workspace
          </p>
        </div>
        {canManage && (
          <InviteMemberDialog workspaceSlug={workspaceSlug} />
        )}
      </div>

      <div className="rounded-xl border border-border/40 bg-background/60 backdrop-blur-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 hover:bg-transparent">
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members?.map((member: any) => (
              <TableRow key={member.id} className="border-border/40 hover:bg-foreground/5 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-sm font-semibold text-indigo-500">
                      {(member.profiles?.full_name || member.profiles?.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{member.profiles?.full_name || "Unnamed User"}</div>
                      <div className="text-sm text-muted-foreground">{member.profiles?.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`capitalize ${ROLE_BADGE_STYLE[member.role] || ROLE_BADGE_STYLE.member}`}
                  >
                    {member.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(member.joined_at).toLocaleDateString()}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <MemberActions
                      memberId={member.id}
                      currentRole={member.role}
                      workspaceSlug={workspaceSlug}
                      isOwner={member.role === 'owner'}
                      currentUserRole={currentWorkspace.role}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
            {(!members || members.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No members found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Security — renders only inside the native app on a biometric-capable device */}
      <BiometricSettings username={user?.email || user?.id || "billmate-user"} />

      <div className="rounded-lg border border-border/40 bg-muted/20 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Role Permissions:</strong>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          <div><Badge variant="outline" className={ROLE_BADGE_STYLE.owner}>Owner</Badge><p className="mt-1">Full access, billing, delete workspace</p></div>
          <div><Badge variant="outline" className={ROLE_BADGE_STYLE.admin}>Admin</Badge><p className="mt-1">Manage members, all data</p></div>
          <div><Badge variant="outline" className={ROLE_BADGE_STYLE.accountant}>Accountant</Badge><p className="mt-1">Create/edit invoices, view all</p></div>
          <div><Badge variant="outline" className={ROLE_BADGE_STYLE.member}>Member</Badge><p className="mt-1">View only access</p></div>
        </div>
      </div>
    </div>
  )
}
