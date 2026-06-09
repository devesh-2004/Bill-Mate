'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Shield, UserX, Loader2 } from 'lucide-react'
import { updateMemberRole, removeMember } from './team-actions'

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'member', label: 'Member' },
]

export function MemberActions({
  memberId,
  currentRole,
  workspaceSlug,
  isOwner,
  currentUserRole,
}: {
  memberId: string
  currentRole: string
  workspaceSlug: string
  isOwner: boolean
  currentUserRole: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  if (isOwner) {
    return <span className="text-xs text-muted-foreground italic">Owner</span>
  }

  const handleRoleChange = (newRole: string) => {
    setError('')
    startTransition(async () => {
      const result = await updateMemberRole(workspaceSlug, memberId, newRole)
      if (result?.error) setError(result.error)
    })
  }

  const handleRemove = () => {
    if (!confirm('Are you sure you want to remove this member?')) return
    setError('')
    startTransition(async () => {
      const result = await removeMember(workspaceSlug, memberId)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && <span className="text-xs text-red-500">{error}</span>}
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {currentUserRole === 'owner' && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Change Role</DropdownMenuLabel>
                {ROLES.filter(r => r.value !== currentRole).map(role => (
                  <DropdownMenuItem
                    key={role.value}
                    onClick={() => handleRoleChange(role.value)}
                    className="cursor-pointer"
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Set as {role.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={handleRemove}
              className="cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-500/10"
            >
              <UserX className="mr-2 h-4 w-4" />
              Remove Member
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
