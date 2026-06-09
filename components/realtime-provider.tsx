"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export function RealtimeProvider({ workspaceId }: { workspaceId?: string }) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!workspaceId) return

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'invoices',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          console.log('Realtime event received!', payload)
          // Ideally show a toast notification here
          // e.g. toast(`Invoice ${payload.new.invoice_number} was updated!`)
          
          // Refresh the current route to fetch new data
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceId, router, supabase])

  return null
}
