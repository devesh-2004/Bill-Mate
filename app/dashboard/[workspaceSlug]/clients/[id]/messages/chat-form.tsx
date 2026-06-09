'use client'

import { useState } from 'react'
import { sendWorkspaceMessage } from '../../actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send } from 'lucide-react'

export function ChatForm({ workspaceSlug, clientId, disputeId, invoiceId }: { workspaceSlug: string, clientId: string, disputeId?: string, invoiceId?: string }) {
  const [loading, setLoading] = useState(false)
  const [body, setBody] = useState('')

  const handleSend = async () => {
    if (!body.trim()) return
    setLoading(true)
    await sendWorkspaceMessage(workspaceSlug, clientId, body, disputeId, invoiceId)
    setBody('')
    setLoading(false)
  }

  return (
    <div className="flex gap-2 items-end mt-4">
      <Textarea 
        placeholder="Type a message to the client..." 
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
