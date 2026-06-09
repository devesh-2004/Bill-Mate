'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Key, Copy, Check, Loader2 } from "lucide-react"
import { generatePortalToken } from '../actions'

export function PortalAccessCard({ workspaceSlug, clientId }: { workspaceSlug: string, clientId: string }) {
  const [loading, setLoading] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    const res = await generatePortalToken(workspaceSlug, clientId)
    setLoading(false)
    
    if (res?.success && res.token) {
      const baseUrl = window.location.origin
      setLink(`${baseUrl}/portal/verify?token=${res.token}&client_id=${clientId}`)
      setCopied(false)
    }
  }

  const handleCopy = () => {
    if (link) {
      navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Card className="border-border/40 bg-background/60 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Portal Access
        </CardTitle>
        <CardDescription>Generate a magic link for this client to access their portal.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {link ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Share this link securely with the client. It expires in 7 days.</p>
            <div className="flex items-center gap-2">
              <div className="bg-muted p-2 rounded-md text-sm font-mono flex-1 overflow-x-auto whitespace-nowrap border">
                {link}
              </div>
              <Button size="icon" variant="outline" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button variant="link" className="px-0 text-xs" onClick={handleGenerate}>
              Regenerate Link
            </Button>
          </div>
        ) : (
          <Button onClick={handleGenerate} disabled={loading} className="w-full sm:w-auto">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Magic Link
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
