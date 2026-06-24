"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Bell, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { markNotificationRead, markAllNotificationsRead } from "@/app/dashboard/[workspaceSlug]/notifications/actions"
import type { Notification } from "@/lib/types"

// Shared across every mounted bell instance (the layout renders one in the
// mobile header and one in the desktop bar). Guarantees a realtime INSERT only
// pops a single toast, no matter how many bells are listening.
const toastedIds = new Set<string>()

function showToast(n: Notification, onOpen: (link: string | null) => void) {
  if (toastedIds.has(n.id)) return
  toastedIds.add(n.id)
  toast.custom((id) => (
    <div
      onClick={() => { onOpen(n.link); toast.dismiss(id) }}
      className="flex w-[340px] max-w-[88vw] cursor-pointer items-start gap-3 rounded-2xl border border-border/50 bg-popover/95 px-4 py-3 shadow-lg backdrop-blur"
    >
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{n.title}</p>
        {n.body && <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
      </div>
    </div>
  ), { duration: 5000 })
}

export function NotificationBell({
  workspaceId, userId, initial,
}: { workspaceId: string; userId: string; initial: Notification[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [items, setItems] = useState<Notification[]>(initial)
  const unread = items.filter((n) => !n.read).length
  // Unique per mount so the two bells never collide on the same Phoenix topic.
  const channelName = useRef(`notifications:${workspaceId}:${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    if (!workspaceId) return
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    ;(async () => {
      // Authenticate the realtime socket BEFORE binding postgres_changes.
      // Otherwise RLS on `notifications` evaluates auth.uid() as null and drops
      // every event, so rows only show up on a server-rendered refresh.
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)
      if (cancelled) return

      channel = supabase
        .channel(channelName.current)
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "notifications",
          filter: `workspace_id=eq.${workspaceId}`,
        }, (payload) => {
          const n = payload.new as Notification
          // Only surface broadcasts or notifications addressed to this user.
          if (n.user_id && n.user_id !== userId) return
          setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev].slice(0, 30)))
          showToast(n, (link) => { if (link) router.push(link) })
        })
        .subscribe()
    })()

    return () => { cancelled = true; if (channel) supabase.removeChannel(channel) }
  }, [workspaceId, userId, supabase, router])

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
