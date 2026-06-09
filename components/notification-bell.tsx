"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Bell, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { markNotificationRead, markAllNotificationsRead } from "@/app/dashboard/[workspaceSlug]/notifications/actions"
import type { Notification } from "@/lib/types"

export function NotificationBell({
  workspaceId, userId, initial,
}: { workspaceId: string; userId: string; initial: Notification[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [items, setItems] = useState<Notification[]>(initial)
  const unread = items.filter((n) => !n.read).length

  useEffect(() => {
    if (!workspaceId) return
    const channel = supabase
      .channel(`notifications:${workspaceId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => {
        const n = payload.new as Notification
        // Only surface broadcasts or notifications addressed to this user.
        if (n.user_id && n.user_id !== userId) return
        setItems((prev) => [n, ...prev].slice(0, 30))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [workspaceId, userId, supabase])

  async function readOne(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    await markNotificationRead(id)
  }
  async function readAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    await markAllNotificationsRead(workspaceId)
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <button onClick={readAll} className="text-xs text-indigo-500 hover:underline flex items-center gap-1">
              <Check className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</div>
          )}
          {items.map((n) => {
            const inner = (
              <div className={`px-3 py-2.5 border-b border-border/20 hover:bg-foreground/5 transition-colors ${n.read ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )
            return (
              <div key={n.id} onClick={() => !n.read && readOne(n.id)}>
                {n.link ? <Link href={n.link}>{inner}</Link> : inner}
              </div>
            )
          })}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
