"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, Download, Sparkles } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { generateInvoiceSummary } from "../ai-actions"
import { ReminderDialog } from "@/components/reminder-dialog"

export default function InvoiceView({ invoice }: { invoice: any }) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)

  const [template, setTemplate] = useState<any>(null)

  useEffect(() => {
    // Dynamically import logic or move to a separate helper if complex, 
    // but for now fetch here.
    // We can't import server action directly inside useEffect easily without "use client" boundary issues 
    // but this file is "use client" so it's fine.
    import("../../settings/actions").then(mod => {
        mod.getTemplate().then(data => setTemplate(data))
    })
  }, [])

  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true)
    const doc = new jsPDF()
    
    const primaryColor = template?.primary_color || '#000000'
    const font = template?.font_family || 'helvetica' // jsPDF standard fonts are limted unless added. 
    // We will stick to color for now as adding fonts to jsPDF client-side is heavy.
    
    // Header
    doc.setTextColor(primaryColor)
    doc.setFontSize(22)
    doc.text("INVOICE", 14, 22)
    doc.setTextColor(0, 0, 0) // Reset
    
    doc.setFontSize(10)
    doc.text(`Invoice #: ${invoice.invoice_number}`, 14, 30)
    doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 14, 35)
    doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 14, 40)
    doc.text(`Status: ${invoice.status}`, 14, 45)

    // Client Info
    doc.text("Bill To:", 14, 55)
    doc.setFontSize(12)
    doc.setTextColor(primaryColor)
    if (invoice.clients) {
        doc.text(invoice.clients.name, 14, 60)
        doc.setTextColor(0, 0, 0)
        doc.setFontSize(10)
        doc.text(invoice.clients.email || "", 14, 65)
        doc.text(invoice.clients.phone || "", 14, 70)
        if (invoice.clients.address) {
             const addressLines = doc.splitTextToSize(invoice.clients.address, 60)
             doc.text(addressLines, 14, 75)
        }
    }

    // Items
    const tableColumn = ["Description", "Quantity", "Price", "Total"]
    const tableRows: any[] = []

    invoice.invoice_items?.forEach((item: any) => {
      const itemData = [
        item.description,
        item.quantity,
        `Rs. ${item.price.toFixed(2)}`,
        `Rs. ${(item.quantity * item.price).toFixed(2)}`,
      ]
      tableRows.push(itemData)
    })

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 90,
      headStyles: { fillColor: primaryColor }
    })

    // Totals
    // @ts-ignore
    const finalY = doc.lastAutoTable.finalY + 10
    doc.text(`Subtotal: Rs. ${invoice.subtotal}`, 140, finalY)
    doc.setFontSize(12)
    doc.setTextColor(primaryColor)
    doc.text(`Total: Rs. ${invoice.total}`, 140, finalY + 7)

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

   const formatCurrency = (amount: number) => {
       return `₹${amount.toFixed(2)}`
   }

   return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="md:col-span-2 lg:col-span-1">
        <CardHeader>
          <div className="flex items-center justify-between">
             <CardTitle className="text-2xl">Invoice {invoice.invoice_number}</CardTitle>
             <Badge variant={invoice.status === 'Paid' ? 'default' : invoice.status === 'Overdue' ? 'destructive' : 'secondary'}>
                {invoice.status}
             </Badge>
          </div>
          <CardDescription>
            Due on {new Date(invoice.due_date).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="grid grid-cols-2 gap-4">
              <div>
                 <h3 className="font-semibold mb-2">Bill To</h3>
                 <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">{invoice.clients?.name}</p>
                    <p>{invoice.clients?.email}</p>
                    <p>{invoice.clients?.phone}</p>
                    <p className="whitespace-pre-wrap">{invoice.clients?.address}</p>
                 </div>
              </div>
              <div className="text-right">
                 <h3 className="font-semibold mb-2">Total Amount</h3>
                 <p className="text-3xl font-bold">{formatCurrency(invoice.total)}</p>
                 {invoice.currency && <p className="text-sm text-muted-foreground">{invoice.currency}</p>}
              </div>
           </div>
           
           <Separator />
           
           <div>
              <h3 className="font-semibold mb-4">Items</h3>
              <div className="space-y-3">
                 {invoice.invoice_items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm">
                       <span>{item.description} (x{item.quantity})</span>
                       <span>{formatCurrency(item.quantity * item.price)}</span>
                    </div>
                 ))}
                 <Separator />
                 <div className="flex justify-between text-sm">
                       <span>Subtotal</span>
                       <span>{formatCurrency(invoice.subtotal)}</span>
                 </div>
                 {invoice.tax > 0 && (
                     <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Tax ({invoice.tax_rate}%)</span>
                        <span>{formatCurrency(invoice.tax)}</span>
                     </div>
                 )}
                 <div className="flex justify-between font-bold text-lg pt-2">
                    <span>Total</span>
                    <span>{formatCurrency(invoice.total)}</span>
                 </div>
              </div>
           </div>

               <div className="flex gap-4 pt-4 flex-wrap">
                  <Button onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
                     {isGeneratingPdf && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                     {!isGeneratingPdf && <Download className="mr-2 h-4 w-4" />}
                     Download PDF
                  </Button>
                  
                  <ReminderDialog invoice={invoice} clientName={invoice.clients?.name || 'Client'} />
               </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 lg:col-span-1 h-fit">
         <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <Sparkles className="h-5 w-5 text-indigo-500" />
               AI Assistant
            </CardTitle>
            <CardDescription>Generate summaries and reminders</CardDescription>
         </CardHeader>
         <CardContent>
            {!aiSummary ? (
               <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4">Use AI to generate a summary and payment reminder for this invoice.</p>
                  <Button onClick={handleGenerateAi} disabled={isGeneratingAi} variant="secondary">
                     {isGeneratingAi && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                     Generate Summary
                  </Button>
               </div>
            ) : (
               <div className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap">
                  {aiSummary}
               </div>
            )}
         </CardContent>
      </Card>
    </div>
  )
}
