"use client"

import { useActionState, useState } from "react"
import { createRecurringAction } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2 } from "lucide-react"

type Client = { id: string; name: string }
type Item = { description: string; quantity: number; price: number }

const initialState = { error: "", errors: {} as Record<string, string[]> }

export default function RecurringForm({ clients, workspaceSlug }: { clients: Client[]; workspaceSlug: string }) {
  const [state, formAction, isPending] = useActionState(createRecurringAction.bind(null, workspaceSlug), initialState)
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: 1, price: 0 }])

  const updateItem = (i: number, field: keyof Item, value: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: field === "description" ? value : Number(value) } : it)))
  const addItem = () => setItems((p) => [...p, { description: "", quantity: 1, price: 0 }])
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i))

  const subtotal = items.reduce((a, it) => a + it.quantity * it.price, 0)

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader><CardTitle>New Recurring Schedule</CardTitle></CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="items_json" value={JSON.stringify(items)} />

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" placeholder="Monthly retainer" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client_id">Client</Label>
              <select id="client_id" name="client_id" required
                className="flex h-9 w-full rounded-md border border-input bg-background/60 px-3 py-1 text-sm shadow-sm">
                <option value="">Select a client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="frequency">Frequency</Label>
              <select id="frequency" name="frequency" required defaultValue="monthly"
                className="flex h-9 w-full rounded-md border border-input bg-background/60 px-3 py-1 text-sm shadow-sm">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="interval_count">Every (interval)</Label>
              <Input id="interval_count" name="interval_count" type="number" min={1} defaultValue={1} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="due_days">Due in (days)</Label>
              <Input id="due_days" name="due_days" type="number" min={0} defaultValue={14} />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" name="start_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end_date">End date (optional)</Label>
              <Input id="end_date" name="end_date" type="date" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="max_occurrences">Max occurrences (optional)</Label>
              <Input id="max_occurrences" name="max_occurrences" type="number" min={1} />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="USD" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tax_rate">Tax rate (%)</Label>
              <Input id="tax_rate" name="tax_rate" type="number" min={0} max={100} defaultValue={0} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="discount">Discount</Label>
              <Input id="discount" name="discount" type="number" min={0} defaultValue={0} />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <Label>Line items</Label>
            {items.map((it, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input className="flex-1" placeholder="Description" value={it.description}
                  onChange={(e) => updateItem(i, "description", e.target.value)} />
                <Input className="w-20" type="number" min={1} placeholder="Qty" value={it.quantity}
                  onChange={(e) => updateItem(i, "quantity", e.target.value)} />
                <Input className="w-28" type="number" min={0} placeholder="Price" value={it.price}
                  onChange={(e) => updateItem(i, "price", e.target.value)} />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} className="text-red-500">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Add item</Button>
            <div className="text-right text-sm text-muted-foreground">Subtotal: {subtotal.toFixed(2)}</div>
          </div>

          <div className="flex items-center gap-2">
            <input id="auto_send" name="auto_send" type="checkbox" className="h-4 w-4" />
            <Label htmlFor="auto_send" className="font-normal">Auto-send generated invoices (create as Pending, not Draft)</Label>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Creating…" : "Create Schedule"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
