import { createClient } from '@/lib/supabase/server'
import { getWorkspaceBySlug } from '@/lib/workspace'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MessageSquare, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChatForm } from './chat-form'

export default async function ClientMessagesPage({ params }: { params: Promise<{ workspaceSlug: string, id: string }> }) {
  const { workspaceSlug, id } = await params
  const supabase = await createClient()

  const workspace = await getWorkspaceBySlug(supabase, workspaceSlug)
  if (!workspace) notFound()

  const { data: client } = await supabase
    .from('clients')
    .select('name')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .single()

  if (!client) notFound()

  const { data: disputes } = await supabase
    .from('disputes')
    .select('*, invoices(invoice_number)')
    .eq('client_id', id)
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })

  const { data: messages } = await supabase
    .from('messages')
    .select('*, invoices(invoice_number), profiles:sender_user_id(full_name)')
    .eq('client_id', id)
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: true })

  const basePath = `/dashboard/${workspaceSlug}`

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={`${basePath}/clients/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Messages & Disputes</h1>
          <p className="text-sm text-muted-foreground">{client.name}</p>
        </div>
      </div>

      {disputes && disputes.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Active & Past Disputes
          </h2>
          <div className="grid gap-4">
            {disputes.map((dispute: any) => (
              <Card key={dispute.id} className="border-amber-500/20 bg-amber-500/5">
                <CardHeader className="py-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base text-amber-600 dark:text-amber-400">
                        Dispute for Invoice #{dispute.invoices?.invoice_number}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Reason: <span className="font-medium text-foreground">{dispute.reason}</span>
                      </CardDescription>
                    </div>
                    <Badge variant={dispute.status === 'open' ? 'destructive' : 'secondary'}>
                      {dispute.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-0 pb-4 text-sm space-y-2">
                  <p>{dispute.details}</p>
                  {dispute.resolution_note && (
                    <div className="mt-4 p-3 bg-muted rounded-md border text-xs">
                      <strong>Resolution Note:</strong> {dispute.resolution_note}
                    </div>
                  )}
                  {dispute.status === 'open' && (
                    <div className="mt-4 pt-4 border-t flex gap-2">
                       {/* This would be handled by a client component in a full implementation, 
                           for now we just note the status since the dispute form needs resolution. */}
                       <p className="text-xs text-muted-foreground">To resolve this dispute, reply in the chat below or update the invoice directly.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className="flex flex-col h-[600px] shadow-sm">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversation History
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {!messages || messages.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No messages yet. Send a message to start the conversation.
            </div>
          ) : (
            messages.map((msg: any) => {
              const isWorkspace = msg.sender_type === 'workspace'
              return (
                <div key={msg.id} className={`flex flex-col ${isWorkspace ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    isWorkspace 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : 'bg-muted rounded-bl-none'
                  }`}>
                    {msg.invoice_id && (
                      <div className={`text-xs mb-1 font-medium ${isWorkspace ? 'text-indigo-200' : 'text-muted-foreground'}`}>
                        Re: Invoice #{msg.invoices?.invoice_number}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap text-sm">{msg.body}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 px-1">
                    {isWorkspace ? msg.profiles?.full_name || 'Workspace Team' : client.name} • {new Date(msg.created_at).toLocaleString()}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
        <div className="p-4 border-t bg-muted/20">
          <ChatForm workspaceSlug={workspaceSlug} clientId={id} />
        </div>
      </Card>
    </div>
  )
}
