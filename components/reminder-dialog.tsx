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
import { Sparkles, Copy, Check, Loader2 } from "lucide-react"
import { generatePaymentReminder, markReminderSent } from "@/app/dashboard/[workspaceSlug]/invoices/reminder-action"

export function ReminderDialog({ invoice, clientName }: { invoice: any, clientName: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reminderText, setReminderText] = useState("")
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")

  // FIX: Generate AFTER dialog opens, not as the open trigger
  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && !reminderText) {
      setLoading(true)
      setError("")
      const result = await generatePaymentReminder(invoice, clientName)
      if (result.error) {
        setError(result.error)
      } else {
        setReminderText(result.text || "")
      }
      setLoading(false)
    }
  }

  const handleRegenerate = async () => {
    setLoading(true)
    setError("")
    setReminderText("")
    const result = await generatePaymentReminder(invoice, clientName)
    if (result.error) {
      setError(result.error)
    } else {
      setReminderText(result.text || "")
    }
    setLoading(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(reminderText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    markReminderSent(invoice.id)
  }
  
  // Only show for Pending/Overdue
  if (invoice.status === "Paid" || invoice.status === "Cancelled") return null

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          {invoice.status === "Overdue" ? "AI Reminder" : "AI Follow-up"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] border-border/40 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            AI Payment Reminder
          </DialogTitle>
          <DialogDescription>
            AI-generated email to send to <strong>{clientName}</strong>. You can edit it before copying.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-10 gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              Generating reminder with AI...
            </div>
          ) : error ? (
            // FIX: Use inline error instead of alert()
            <div className="rounded-md bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
              <p className="font-medium mb-1">Failed to generate</p>
              <p>{error}</p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={handleRegenerate}>
                Try again
              </Button>
            </div>
          ) : reminderText ? (
            <Textarea 
              className="min-h-[220px] font-mono text-sm leading-relaxed resize-none bg-muted/50 border-border/40" 
              value={reminderText} 
              onChange={(e) => setReminderText(e.target.value)}
            />
          ) : null}
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
            {reminderText && !loading && (
              <Button variant="ghost" size="sm" onClick={handleRegenerate} className="text-muted-foreground">
                Regenerate
              </Button>
            )}
          </div>
          {reminderText && !loading && (
            <Button
              onClick={handleCopy}
              className={`gap-2 ${copied ? 'bg-emerald-600 hover:bg-emerald-700 border-none text-white' : ''}`}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy to Clipboard"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
