"use client"
import { useState, useTransition } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createInvoiceAction, updateInvoiceAction } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, ArrowLeft } from "lucide-react"
import Link from "next/link"

const invoiceSchema = z.object({
  client_id: z.string().min(1, "Client is required"),
  invoice_number: z.string().min(1, "Invoice number is required"),
  issue_date: z.string().optional(),
  due_date: z.string().min(1, "Due date is required"),
  status: z.enum(['Draft', 'Paid', 'Pending', 'Overdue', 'Cancelled']),
  currency: z.string().default("USD"),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1, "Required"),
    quantity: z.coerce.number().min(1, "Min 1"),
    price: z.coerce.number().min(0, "Min 0")
  })).min(1, "At least one item is required")
})

type InvoiceFormValues = z.infer<typeof invoiceSchema>

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: 'C$', AUD: 'A$', JPY: '¥'
}

export default function InvoiceForm({ invoice, clients, workspaceSlug }: { invoice?: any, clients: any[], workspaceSlug: string }) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState("")

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema) as any,
    defaultValues: {
      client_id: invoice?.client_id || "",
      invoice_number: invoice?.invoice_number || `INV-${Date.now()}`,
      issue_date: invoice?.issue_date || new Date().toISOString().split('T')[0],
      due_date: invoice?.due_date || "",
      status: invoice?.status || "Draft",
      currency: invoice?.currency || "USD",
      tax_rate: invoice?.tax_rate || 0,
      notes: invoice?.notes || "",
      terms: invoice?.terms || "",
      items: invoice?.invoice_items?.length ? invoice.invoice_items : [{ description: "", quantity: 1, price: 0 }]
    }
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  })

  const taxRate = form.watch("tax_rate") || 0
  const items = form.watch("items") || []
  const currency = form.watch("currency") || "USD"
  const currencySymbol = CURRENCY_SYMBOLS[currency] || currency

  const subtotal = items.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.price || 0)), 0)
  const tax = subtotal * (Number(taxRate) / 100)
  const total = subtotal + tax

  const onSubmit = (data: InvoiceFormValues) => {
    setServerError("")
    startTransition(async () => {
      const formData = new FormData()
      formData.append("client_id", data.client_id)
      formData.append("invoice_number", data.invoice_number)
      formData.append("status", data.status)
      formData.append("issue_date", data.issue_date || "")
      formData.append("due_date", data.due_date)
      formData.append("currency", data.currency)
      formData.append("tax_rate", data.tax_rate.toString())
      formData.append("notes", data.notes || "")
      formData.append("terms", data.terms || "")
      formData.append("items_json", JSON.stringify(data.items))

      let result;
      if (invoice?.id) {
        result = await updateInvoiceAction(workspaceSlug, invoice.id, [], null, formData)
      } else {
        result = await createInvoiceAction(workspaceSlug, [], null, formData)
      }

      if (result?.error) {
        setServerError(result.error)
      }
    })
  }

  const basePath = `/dashboard/${workspaceSlug}`

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={`${basePath}/invoices`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {invoice?.id ? "Edit Invoice" : "Create Invoice"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {invoice?.id ? `Editing ${invoice.invoice_number}` : "Fill in the details below to create a new invoice."}
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Main Details Card */}
        <Card className="border-border/40 bg-background/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="client_id">Client *</Label>
                <Select onValueChange={(val) => form.setValue("client_id", val)} defaultValue={form.getValues("client_id")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.client_id && <span className="text-red-500 text-xs">{form.formState.errors.client_id.message}</span>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="invoice_number">Invoice Number *</Label>
                <Input {...form.register("invoice_number")} />
                {form.formState.errors.invoice_number && <span className="text-red-500 text-xs">{form.formState.errors.invoice_number.message}</span>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="issue_date">Issue Date</Label>
                <Input type="date" {...form.register("issue_date")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="due_date">Due Date *</Label>
                <Input type="date" {...form.register("due_date")} />
                {form.formState.errors.due_date && <span className="text-red-500 text-xs">{form.formState.errors.due_date.message}</span>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select onValueChange={(val: any) => form.setValue("status", val)} defaultValue={form.getValues("status")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Select onValueChange={(val) => form.setValue("currency", val)} defaultValue={form.getValues("currency")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="INR">INR (₹)</SelectItem>
                    <SelectItem value="CAD">CAD (C$)</SelectItem>
                    <SelectItem value="AUD">AUD (A$)</SelectItem>
                    <SelectItem value="JPY">JPY (¥)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                <Input type="number" step="0.1" min="0" max="100" {...form.register("tax_rate")} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items Card */}
        <Card className="border-border/40 bg-background/60 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Line Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ description: "", quantity: 1, price: 0 })}>
                <Plus className="h-4 w-4 mr-2" /> Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Header */}
            <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
              <span className="col-span-6">Description</span>
              <span className="col-span-2 text-center">Qty</span>
              <span className="col-span-2 text-center">Price</span>
              <span className="col-span-1 text-right">Total</span>
              <span className="col-span-1"></span>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-12 md:col-span-6">
                  <Input
                    {...form.register(`items.${index}.description`)}
                    placeholder="Description of service/product"
                  />
                  {form.formState.errors.items?.[index]?.description && <span className="text-red-500 text-xs">Required</span>}
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    {...form.register(`items.${index}.quantity`)}
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Price"
                    {...form.register(`items.${index}.price`)}
                  />
                </div>
                <div className="col-span-3 md:col-span-1 text-right font-medium text-sm tabular-nums">
                  {currencySymbol}{(Number(items[index]?.quantity || 0) * Number(items[index]?.price || 0)).toFixed(2)}
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length === 1}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}

            {form.formState.errors.items?.root && (
              <span className="text-red-500 text-sm">{form.formState.errors.items.root.message}</span>
            )}

            <Separator />

            {/* Totals */}
            <div className="flex flex-col items-end gap-1">
              <div className="flex justify-between w-56 text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="tabular-nums">{currencySymbol}{subtotal.toFixed(2)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between w-56 text-sm">
                  <span className="text-muted-foreground">Tax ({taxRate}%):</span>
                  <span className="tabular-nums">{currencySymbol}{tax.toFixed(2)}</span>
                </div>
              )}
              <Separator className="w-56" />
              <div className="flex justify-between w-56 text-lg font-bold">
                <span>Total:</span>
                <span className="tabular-nums">{currencySymbol}{total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes & Terms Card */}
        <Card className="border-border/40 bg-background/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base">Notes & Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes <span className="text-muted-foreground text-xs">(optional — visible to client)</span></Label>
              <Textarea
                {...form.register("notes")}
                placeholder="Payment instructions, thank you message, etc."
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="terms">Terms & Conditions <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                {...form.register("terms")}
                placeholder="Payment is due within 30 days..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {serverError && (
          <div className="rounded-md bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-500">
            {serverError}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href={`${basePath}/invoices`}>Cancel</Link>
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-[0_0_20px_rgba(79,70,229,0.3)]"
          >
            {isPending ? "Saving..." : invoice?.id ? "Update Invoice" : "Create Invoice"}
          </Button>
        </div>
      </form>
    </div>
  )
}
