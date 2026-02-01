"use client"

import { useState, useActionState } from "react"
import { createInvoiceAction, updateInvoiceAction } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2 } from "lucide-react"

type InvoiceItem = {
  description: string
  quantity: number
  price: number
}

type Client = {
  id: string
  name: string
}

type Invoice = {
  id?: string
  client_id?: string
  invoice_number?: string
  status?: string
  due_date?: string
  currency?: string
  tax_rate?: number
  invoice_items?: InvoiceItem[]
}

const initialState = {
  error: "",
  errors: {}
}

export default function InvoiceForm({ invoice, clients }: { invoice?: Invoice, clients: Client[] }) {
  const [items, setItems] = useState<InvoiceItem[]>(invoice?.invoice_items || [{ description: "", quantity: 1, price: 0 }])

  // We bind the items to the action or pass as JSON hidden field
  // Binding objects in useActionState can be tricky with complex state updates.
  // Easiest robust way: Hidden input with JSON.stringify(items)
  
  const action = invoice?.id 
    ? updateInvoiceAction.bind(null, invoice.id, items) // Note: items passed here might be stale if closure, better use hidden input
    : createInvoiceAction.bind(null, items)

  // Actually, binding 'items' directly is dangerous because `items` state changes.
  // The action needs to receive the *current* items.
  // FormData handling is safer.
  // I will use `createInvoiceAction` without bind for items, and parse hidden input.
  
  const finalAction = invoice?.id ? updateInvoiceAction.bind(null, invoice.id, []) : createInvoiceAction.bind(null, [])

  const [state, formAction, isPending] = useActionState(finalAction, initialState)

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, price: 0 }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const [currency, setCurrency] = useState("INR")
  const [taxRate, setTaxRate] = useState(invoice?.tax_rate || 0)

  const calculateTotals = () => {
    const subtotal = items.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.price || 0)), 0)
    const tax = subtotal * (Number(taxRate) / 100)
    const total = subtotal + tax
    return { subtotal, tax, total }
  }

  const { subtotal, tax, total } = calculateTotals()

  // ... (inside the form JSX)
  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>{invoice?.id ? "Edit Invoice" : "Create Invoice"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="items_json" value={JSON.stringify(items)} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="client_id">Client</Label>
              <Select name="client_id" defaultValue={invoice?.client_id}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invoice_number">Invoice Number</Label>
              <Input id="invoice_number" name="invoice_number" defaultValue={invoice?.invoice_number || `INV-${Date.now()}`} required />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input id="due_date" name="due_date" type="date" defaultValue={invoice?.due_date} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={invoice?.status || "Pending"}>
                <SelectTrigger>
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Currency & Tax Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="grid gap-2 hidden">
                <Label htmlFor="currency">Currency</Label>
                <Select name="currency" value={currency} onValueChange={setCurrency} disabled>
                    <SelectTrigger>
                        <SelectValue placeholder="INR" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="INR">INR (₹)</SelectItem>
                    </SelectContent>
                </Select>
                <input type="hidden" name="currency" value="INR" />
             </div>
             <div className="grid gap-2">
                <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                <Input 
                    type="number" 
                    id="tax_rate" 
                    name="tax_rate" 
                    min="0" max="100" step="0.1"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                />
             </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Items</h3>
                 <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-2" /> Add Item
                 </Button>
            </div>
            
            <div className="space-y-4">
               {items.map((item, index) => (
                 <div key={index} className="flex gap-4 items-end">
                    <div className="flex-1">
                        <Label className="text-xs">Description</Label>
                        <Input 
                            value={item.description} 
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            required 
                        />
                    </div>
                    <div className="w-20">
                        <Label className="text-xs">Qty</Label>
                        <Input 
                            type="number" 
                            min="1"
                            value={item.quantity} 
                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                            required 
                        />
                    </div>
                    <div className="w-24">
                        <Label className="text-xs">Price (₹)</Label>
                         <Input 
                            type="number" 
                            min="0" step="0.01"
                            value={item.price} 
                            onChange={(e) => updateItem(index, 'price', e.target.value)}
                            required 
                        />
                    </div>
                     <div className="w-24 pb-2 text-right font-medium">
                        ₹{(Number(item.quantity) * Number(item.price)).toFixed(2)}
                     </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                 </div>
               ))}
            </div>
            
            <div className="flex flex-col items-end pt-4 border-t gap-1">
                <div className="flex justify-between w-48 text-sm">
                   <span className="text-muted-foreground">Subtotal:</span>
                   <span>{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between w-48 text-sm">
                   <span className="text-muted-foreground">Tax ({taxRate}%):</span>
                   <span>{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between w-48 text-lg font-bold border-t pt-1 mt-1">
                   <span>Total:</span>
                   <span>₹ {total.toFixed(2)}</span>
                </div>
            </div>
          </div>

          {state?.error && <p className="text-red-500 text-sm">{state.error}</p>}
          
          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Invoice"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
