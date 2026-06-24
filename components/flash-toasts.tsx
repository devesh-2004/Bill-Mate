"use client"

import { useEffect } from "react"
import { toast } from "sonner"

// Auth events (login / signup) don't create a notifications row, so they can't
// arrive over realtime. The server actions drop a short-lived `bm_flash` cookie
// instead; we read it once on the first dashboard render, toast, then clear it.
const MESSAGES: Record<string, { title: string; body: string }> = {
  login: { title: "Signed in", body: "Welcome back to BillMate." },
  welcome: { title: "Welcome to BillMate", body: "Your workspace is ready." },
}

export function FlashToasts() {
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)bm_flash=([^;]+)/)
    if (!match) return
    const flash = MESSAGES[decodeURIComponent(match[1])]
    // Clear immediately so it never fires twice.
    document.cookie = "bm_flash=; Max-Age=0; path=/"
    if (!flash) return
    toast.custom(() => (
      <div className="flex w-[340px] max-w-[88vw] items-start gap-3 rounded-2xl border border-border/50 bg-popover/95 px-4 py-3 shadow-lg backdrop-blur">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{flash.title}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{flash.body}</p>
        </div>
      </div>
    ), { duration: 4000 })
  }, [])

  return null
}
