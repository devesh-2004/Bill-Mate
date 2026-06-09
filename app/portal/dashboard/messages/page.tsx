import { getPortalSession } from '../../actions'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, AlertCircle } from 'lucide-react'
import { ClientChatForm } from './chat-form'

export default async function PortalMessagesPage() {
  const session = await getPortalSession()
  if (!session) return null

  let adminSupabase
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    adminSupabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
  } else {
    adminSupabase = await createClient()
  }

  const { data: workspace } = await adminSupabase
    .from('workspaces')
    .select('name')
    .eq('id', session.workspaceId)
    .single()

  const { data: client } = await adminSupabase
    .from('clients')
    .select('name')
    .eq('id', session.clientId)
    .single()

  const { data: disputes } = await adminSupabase
    .from('disputes')
    .select('*, invoices(invoice_number)')
    .eq('client_id', session.clientId)
    .eq('workspace_id', session.workspaceId)
    .order('created_at', { ascending: false })

  const { data: messages } = await adminSupabase
    .from('messages')
    .select('*, invoices(invoice_number), profiles:sender_user_id(full_name)')
    .eq('client_id', session.clientId)
    .eq('workspace_id', session.workspaceId)
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Messages & Support</h1>
        <p className="text-muted-foreground">Communicate directly with {workspace?.name}</p>
      </div>

      {disputes && disputes.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Your Disputes
          </h2>
          <div className="grid gap-4">
            {disputes.map((dispute: any) => (
              <Card key={dispute.id} className="border-amber-500/20 bg-amber-500/5">
                <CardHeader className="py-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base text-amber-600 dark:text-amber-400">
                        Invoice #{dispute.invoices?.invoice_number}
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
                      <strong>Resolution Note from Provider:</strong> {dispute.resolution_note}
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
              const isClient = msg.sender_type === 'client'
              return (
                <div key={msg.id} className={`flex flex-col ${isClient ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    isClient 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : 'bg-muted rounded-bl-none'
                  }`}>
                    {msg.invoice_id && (
                      <div className={`text-xs mb-1 font-medium ${isClient ? 'text-indigo-200' : 'text-muted-foreground'}`}>
                        Re: Invoice #{msg.invoices?.invoice_number}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap text-sm">{msg.body}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 px-1">
                    {isClient ? 'You' : msg.profiles?.full_name || workspace?.name} • {new Date(msg.created_at).toLocaleString()}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
        <div className="p-4 border-t bg-muted/20">
          <ClientChatForm />
        </div>
      </Card>
    </div>
  )
}
