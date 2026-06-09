"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import { Plus } from "lucide-react"
import { createExpenseAction } from "./actions"

type Category = { id: string; name: string; color: string }

export function ExpenseManager({ workspaceSlug, categories }: { workspaceSlug: string; categories: Category[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true); setError("")
    const fd = new FormData(e.currentTarget)
    const res = await createExpenseAction(workspaceSlug, null, fd)
    setPending(false)
    if (res?.error) { setError(res.error); return }
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Add Expense</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Record Expense</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" required placeholder="Cloud hosting" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min={0} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expense_date">Date</Label>
              <Input id="expense_date" name="expense_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Input id="vendor" name="vendor" placeholder="AWS" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category_id">Category</Label>
              <select id="category_id" name="category_id"
                className="flex h-9 w-full rounded-md border border-input bg-background/60 px-3 py-1 text-sm shadow-sm">
                <option value="">Uncategorized</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <select id="status" name="status" defaultValue="recorded"
                className="flex h-9 w-full rounded-md border border-input bg-background/60 px-3 py-1 text-sm shadow-sm">
                <option value="recorded">Recorded</option>
                <option value="pending">Pending</option>
                <option value="reimbursed">Reimbursed</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="USD" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="receipt">Receipt (optional)</Label>
            <Input id="receipt" name="receipt" type="file" accept="image/*,application/pdf" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save Expense"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
