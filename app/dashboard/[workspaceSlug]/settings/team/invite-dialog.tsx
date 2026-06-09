'use client'

import { useState, useActionState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, UserPlus } from 'lucide-react'
import { inviteMember } from './team-actions'

export function InviteMemberDialog({ workspaceSlug }: { workspaceSlug: string }) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState('member')
  
  const boundAction = inviteMember.bind(null, workspaceSlug)
  const [state, formAction, isPending] = useActionState(boundAction, { error: '', success: false })

  // Auto-close on success
  if (state.success && open) {
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white border-none">
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] border-border/40 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Enter their email and assign a role. They must already have a BillMate account.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4 pt-2">
          <div className="grid gap-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="colleague@example.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <Select name="role" defaultValue="member" onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin — Manage members, all data</SelectItem>
                <SelectItem value="accountant">Accountant — Create/edit invoices</SelectItem>
                <SelectItem value="member">Member — View only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {state.error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {state.error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white border-none"
            >
              {isPending ? 'Inviting...' : 'Send Invite'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
