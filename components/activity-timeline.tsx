import { createClient } from "@/lib/supabase/server"
import { ScrollArea } from "@/components/ui/scroll-area"
import { History, FilePlus, Edit, Trash2, Mail, CheckCircle, Download } from "lucide-react"

export async function ActivityTimeline({ invoiceId }: { invoiceId: string }) {
  const supabase = await createClient()
  const { data: logs } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('entity_id', invoiceId)
    .order('created_at', { ascending: false })

  if (!logs || logs.length === 0) {
    return (
        <div className="text-center py-4 text-sm text-muted-foreground p-4 border rounded-md bg-muted/50">
            <History className="h-4 w-4 mx-auto mb-2 opacity-50" />
            No activity recorded yet.
        </div>
    )
  }

  const getIcon = (action: string) => {
      switch(action) {
          case 'created': return <FilePlus className="h-4 w-4 text-blue-500" />
          case 'updated': return <Edit className="h-4 w-4 text-orange-500" />
          case 'deleted': return <Trash2 className="h-4 w-4 text-red-500" />
          case 'sent': return <Mail className="h-4 w-4 text-purple-500" />
          case 'status_changed': return <CheckCircle className="h-4 w-4 text-green-500" />
          case 'downloaded': return <Download className="h-4 w-4 text-gray-500" />
          default: return <History className="h-4 w-4 text-gray-400" />
      }
  }

  const formatAction = (log: any) => {
      if (log.action === 'created') return 'Invoice Created'
      if (log.action === 'updated') return 'Invoice Updated' 
      return `Action: ${log.action}`
  }

  return (
    <ScrollArea className="h-[300px] w-full rounded-md border p-4">
      <div className="space-y-4">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-4 text-sm">
             <div className="mt-0.5 bg-muted p-1.5 rounded-full h-fit">
                {getIcon(log.action)}
             </div>
             <div className="grid gap-0.5">
                <p className="font-medium text-foreground">{formatAction(log)}</p>
                <p className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                </p>
                {log.metadata && (
                    <p className="text-xs text-muted-foreground mt-1 bg-muted/50 p-1 rounded font-mono">
                        {JSON.stringify(log.metadata).slice(0, 50)}
                        {JSON.stringify(log.metadata).length > 50 ? '...' : ''}
                    </p>
                )}
             </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
