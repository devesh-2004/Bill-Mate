'use client'

import { useState } from 'react'
import { createDispute } from '../actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function DisputeDialog({ invoiceId, existingDispute }: { invoiceId: string, existingDispute: boolean }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  if (existingDispute) {
    return (
      <Button variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50" onClick={() => router.push('/portal/dashboard/messages')}>
        <AlertCircle className="mr-2 h-4 w-4" />
        View Dispute
      </Button>
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const formData = new FormData(e.currentTarget)
    formData.append('invoice_id', invoiceId)
    
    const res = await createDispute(formData)
    
    setLoading(false)
    if (res.error) {
      setError(res.error)
    } else {
      setOpen(false)
      router.push('/portal/dashboard/messages')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-amber-500/50 text-amber-600 hover:text-amber-700 hover:bg-amber-50">
          <AlertCircle className="mr-2 h-4 w-4" />
          Dispute Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Dispute Invoice</DialogTitle>
          <DialogDescription>
            If there is an error with this invoice, please provide details below. Our team will review it shortly.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for dispute</Label>
            <Input id="reason" name="reason" placeholder="e.g. Incorrect amount, Work not completed" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="details">Additional Details</Label>
            <Textarea id="details" name="details" placeholder="Please provide more context..." required className="min-h-[100px]" />
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-amber-600 hover:bg-amber-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Dispute
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
