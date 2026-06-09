"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, Download, Sparkles, CheckCircle, Edit } from "lucide-react"
import Link from "next/link"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { generateInvoiceSummary } from "../ai-actions"
import { ReminderDialog } from "@/components/reminder-dialog"
import { markInvoicePaidAction } from "../actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// FIX: Map currency codes to symbols — previously always used ₹
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: 'C$', AUD: 'A$', JPY: '¥'
}

const STATUS_BADGE: Record<string, string> = {
  Paid: 'default',
  Overdue: 'destructive',
  Pending: 'secondary',
  Draft: 'outline',
  Cancelled: 'outline',
}

export default function InvoiceView({ invoice, workspaceSlug }: { invoice: any, workspaceSlug: string }) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [markPaidError, setMarkPaidError] = useState("")

  // FIX: Use actual currency from invoice
  const currencyCode = invoice.currency || 'USD'
  const currencySymbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode

  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${Number(amount).toFixed(2)}`
  }

  const handleMarkPaid = () => {
    setMarkPaidError("")
    startTransition(async () => {
      const result = await markInvoicePaidAction(workspaceSlug, invoice.id)
      if (result?.error) {
        setMarkPaidError(result.error)
      }
    })
  }

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true)
    
    // FIX: Fetch template via API route instead of direct server action import
    let template: any = null
    try {
      const res = await fetch(`/api/template`)
      if (res.ok) template = await res.json()
    } catch {}
    
    const doc = new jsPDF()
    
    const primaryColor = template?.primary_color || '#4f46e5'
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [79, 70, 229];
    }
    const [r, g, b] = hexToRgb(primaryColor)
    
    // Header Banner
    doc.setFillColor(r, g, b)
    doc.rect(0, 0, 210, 40, 'F')
    
    // Title
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(28)
    doc.setFont("helvetica", "bold")
    doc.text("INVOICE", 14, 25)
    
    // Company Name (Right aligned)
    doc.setFontSize(16)
    doc.text(template?.name || "My Company", 195, 25, { align: "right" })
    
    doc.setTextColor(0, 0, 0)
    
    // Invoice Details
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Invoice Number: ${invoice.invoice_number}`, 14, 50)
    if (invoice.issue_date) {
      doc.text(`Issue Date: ${new Date(invoice.issue_date).toLocaleDateString()}`, 14, 55)
      doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 14, 60)
    } else {
      doc.text(`Date of Issue: ${new Date(invoice.created_at).toLocaleDateString()}`, 14, 55)
      doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 14, 60)
    }
    
    // Status Badge
    doc.setDrawColor(r, g, b)
    doc.setTextColor(r, g, b)
    doc.rect(14, 65, 30, 8)
    doc.text(invoice.status.toUpperCase(), 18, 70)
    
    doc.setTextColor(0, 0, 0)

    // Bill To
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Bill To:", 130, 50)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    if (invoice.clients) {
        doc.text(invoice.clients.name, 130, 55)
        doc.setTextColor(100, 100, 100)
        doc.text(invoice.clients.email || "", 130, 60)
        doc.text(invoice.clients.phone || "", 130, 65)
        if (invoice.clients.address) {
             const addressLines = doc.splitTextToSize(invoice.clients.address, 60)
             doc.text(addressLines, 130, 70)
        }
    }

    // Items Table
    const tableColumn = ["Description", "Quantity", `Price (${currencyCode})`, `Total (${currencyCode})`]
    const tableRows: any[] = []

    invoice.invoice_items?.forEach((item: any) => {
      const itemData = [
        item.description,
        item.quantity,
        Number(item.price).toFixed(2),
        (item.quantity * item.price).toFixed(2),
      ]
      tableRows.push(itemData)
    })

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 90,
      headStyles: { fillColor: [r, g, b], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 90 }
    })

    // Totals
    // @ts-ignore
    const finalY = doc.lastAutoTable.finalY + 10
    doc.setFontSize(10)
    doc.text(`Subtotal:`, 140, finalY)
    doc.text(`${currencyCode} ${Number(invoice.subtotal).toFixed(2)}`, 195, finalY, { align: "right" })
    
    if (invoice.tax > 0) {
      doc.text(`Tax (${invoice.tax_rate}%):`, 140, finalY + 7)
      doc.text(`${currencyCode} ${Number(invoice.tax).toFixed(2)}`, 195, finalY + 7, { align: "right" })
    }

    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(r, g, b)
    const totalY = invoice.tax > 0 ? finalY + 17 : finalY + 10
    doc.text(`Total:`, 140, totalY)
    doc.text(`${currencyCode} ${Number(invoice.total).toFixed(2)}`, 195, totalY, { align: "right" })

    // Notes
    if (invoice.notes) {
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(0, 0, 0)
      doc.text("Notes:", 14, totalY + 20)
      doc.setFont("helvetica", "normal")
      const noteLines = doc.splitTextToSize(invoice.notes, 180)
      doc.text(noteLines, 14, totalY + 27)
    }

    // Footer
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(150, 150, 150)
    doc.text("Thank you for your business!", 105, 280, { align: "center" })

    doc.save(`invoice_${invoice.invoice_number}.pdf`)
    setIsGeneratingPdf(false)
  }

  const handleGenerateAi = async () => {
    setIsGeneratingAi(true)
    const details = {
        clientName: invoice.clients?.name,
        total: invoice.total,
        dueDate: invoice.due_date,
        status: invoice.status,
        items: invoice.invoice_items
    }
    const result = await generateInvoiceSummary(details)
    if (result.text) {
        setAiSummary(result.text)
    }
    setIsGeneratingAi(false)
  }

  const basePath = `/dashboard/${workspaceSlug}`

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Invoice Detail Card */}
      <Card className="lg:col-span-1 border-border/40 bg-background/60 backdrop-blur-xl">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-2xl">Invoice {invoice.invoice_number}</CardTitle>
              <CardDescription className="mt-1">
                {invoice.issue_date
                  ? `Issued: ${new Date(invoice.issue_date).toLocaleDateString()}`
                  : `Created: ${new Date(invoice.created_at).toLocaleDateString()}`
                }
                {" · "}
                Due: {new Date(invoice.due_date).toLocaleDateString()}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_BADGE[invoice.status] as any || 'secondary'}>
                {invoice.status}
              </Badge>
              <Button variant="ghost" size="icon" asChild>
                <Link href={`${basePath}/invoices/${invoice.id}/edit`}>
                  <Edit className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bill To */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">Bill To</h3>
              <div className="text-sm space-y-0.5">
                <p className="font-medium text-foreground text-base">{invoice.clients?.name}</p>
                {invoice.clients?.email && <p className="text-muted-foreground">{invoice.clients.email}</p>}
                {invoice.clients?.phone && <p className="text-muted-foreground">{invoice.clients.phone}</p>}
                {invoice.clients?.address && <p className="text-muted-foreground whitespace-pre-wrap">{invoice.clients.address}</p>}
              </div>
            </div>
            <div className="text-right">
              <h3 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">Total Due</h3>
              <p className="text-4xl font-bold tracking-tight">{formatCurrency(invoice.total)}</p>
              <p className="text-sm text-muted-foreground mt-1">{currencyCode}</p>
              {invoice.paid_at && (
                <p className="text-xs text-green-500 mt-1 flex items-center justify-end gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Paid {new Date(invoice.paid_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Line Items */}
          <div>
            <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Items</h3>
            <div className="space-y-2">
              {invoice.invoice_items?.map((item: any) => (
                <div key={item.id} className="flex justify-between text-sm py-1">
                  <div>
                    <span className="font-medium">{item.description}</span>
                    <span className="text-muted-foreground ml-2">× {item.quantity}</span>
                    <span className="text-muted-foreground ml-1">@ {formatCurrency(item.price)}</span>
                  </div>
                  <span className="font-medium tabular-nums">{formatCurrency(item.quantity * item.price)}</span>
                </div>
              ))}
            </div>

            <Separator className="my-3" />

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.tax > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Tax ({invoice.tax_rate}%)</span>
                  <span className="tabular-nums">{formatCurrency(invoice.tax)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-1 border-t">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms) && (
            <>
              <Separator />
              {invoice.notes && (
                <div>
                  <h3 className="font-semibold mb-1 text-sm text-muted-foreground uppercase tracking-wide">Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <h3 className="font-semibold mb-1 text-sm text-muted-foreground uppercase tracking-wide">Terms</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.terms}</p>
                </div>
              )}
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <Button onClick={handleDownloadPdf} disabled={isGeneratingPdf} variant="outline">
              {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download PDF
            </Button>

            <ReminderDialog invoice={invoice} clientName={invoice.clients?.name || 'Client'} />

            {/* FIX: Quick Mark as Paid button */}
            {invoice.status !== 'Paid' && invoice.status !== 'Cancelled' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    disabled={isPending}
                  >
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Mark as Paid
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark Invoice as Paid?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will set the status to <strong>Paid</strong> and record today as the payment date. 
                      You can still edit the invoice afterward if needed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleMarkPaid}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Yes, Mark as Paid
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {markPaidError && (
            <p className="text-sm text-red-500">{markPaidError}</p>
          )}
        </CardContent>
      </Card>

      {/* AI Assistant Card */}
      <Card className="lg:col-span-1 h-fit border-border/40 bg-background/60 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            AI Assistant
          </CardTitle>
          <CardDescription>Generate summaries and payment reminders with AI</CardDescription>
        </CardHeader>
        <CardContent>
          {!aiSummary ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4 text-sm">
                Use AI to generate a professional summary and payment reminder for this invoice.
              </p>
              <Button
                onClick={handleGenerateAi}
                disabled={isGeneratingAi}
                variant="secondary"
                className="gap-2"
              >
                {isGeneratingAi ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Generate Summary</>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-lg text-sm whitespace-pre-wrap leading-relaxed">
                {aiSummary}
              </div>
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setAiSummary(null)} className="text-xs text-muted-foreground">
                  Reset
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
