'use client'

import { useState } from 'react'
import { sendClientMessage } from '../../actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function ClientChatForm({ invoiceId, disputeId }: { invoiceId?: string, disputeId?: string }) {
  const [loading, setLoading] = useState(false)
  const [body, setBody] = useState('')
  const router = useRouter()

  const handleSend = async () => {
    if (!body.trim()) return
    setLoading(true)
    
    const formData = new FormData()
    formData.append('body', body)
    if (invoiceId) formData.append('invoice_id', invoiceId)
    if (disputeId) formData.append('dispute_id', disputeId)
    
    await sendClientMessage(formData)
    
    setBody('')
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex gap-2 items-end mt-4">
      <Textarea 
        placeholder="Type a message..." 
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-[80px]"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
          }
        }}
      />
      <Button onClick={handleSend} disabled={loading || !body.trim()} size="icon" className="h-[80px] w-16">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
      </Button>
    </div>
  )
}
