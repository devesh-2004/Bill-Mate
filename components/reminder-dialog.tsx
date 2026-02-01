"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, Copy, Check, Send } from "lucide-react"
import { generatePaymentReminder, markReminderSent } from "@/app/(dashboard)/invoices/reminder-action"
// import { toast } from "sonner" 

export function ReminderDialog({ invoice, clientName }: { invoice: any, clientName: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reminderText, setReminderText] = useState("")
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    const result = await generatePaymentReminder(invoice, clientName)
    if (result.error) {
        alert(result.error) // Simple alert for now
    } else {
        setReminderText(result.text || "")
    }
    setLoading(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(reminderText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    
    // Optimistically mark as sent in DB when copied (closest proxy to sending)
    markReminderSent(invoice.id)
  }
  
  // Only show for Pending/Overdue
  if (invoice.status === "Paid") return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" onClick={handleGenerate}>
           <Sparkles className="h-4 w-4 text-indigo-500" />
           {invoice.status === "Overdue" ? "Generate Reminder" : "Draft Follow-up"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>AI Payment Reminder</DialogTitle>
          <DialogDescription>
            Generate a polite email to send to {clientName}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
            {loading ? (
                <div className="flex items-center justify-center p-8 text-sm text-muted-foreground animate-pulse">
                    Generating friendly reminder...
                </div>
            ) : reminderText ? (
                <Textarea 
                    className="min-h-[200px] font-mono text-sm leading-relaxed" 
                    value={reminderText} 
                    onChange={(e) => setReminderText(e.target.value)}
                />
            ) : (
                 <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                    Click generate to start.
                </div>
            )}
        </div>

        <DialogFooter className="sm:justify-between">
           <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
           {reminderText && (
               <Button onClick={handleCopy} className="gap-2">
                   {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                   {copied ? "Copied!" : "Copy to Clipboard"}
               </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
