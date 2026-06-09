"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, Users, FileText, UserCog, Bell, Activity } from "lucide-react"
import { Input } from "@/components/ui/input"
import { globalSearch } from "@/app/dashboard/[workspaceSlug]/search-actions"
import type { SearchResult } from "@/lib/types"

const ICONS: Record<string, any> = {
  client: Users, invoice: FileText, member: UserCog, notification: Bell, activity: Activity,
}

export function GlobalSearch({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Debounced search.
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    const t = setTimeout(async () => {
      const res = await globalSearch(workspaceSlug, q)
      setResults(res.results || [])
      setLoading(false)
      setOpen(true)
    }, 250)
    return () => clearTimeout(t)
  }, [q, workspaceSlug])

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  function go(r: SearchResult) {
    const base = `/dashboard/${workspaceSlug}`
    const path =
      r.entity_type === "client" ? `${base}/clients/${r.entity_id}` :
      r.entity_type === "invoice" ? `${base}/invoices/${r.entity_id}` :
      r.entity_type === "member" ? `${base}/settings/team` :
      base
    setOpen(false); setQ("")
    router.push(path)
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q.length >= 2 && setOpen(true)}
        placeholder="Search everything…"
        className="pl-8 bg-background/60 backdrop-blur-md"
      />
      {open && (q.length >= 2) && (
        <div className="absolute z-50 mt-1 w-80 right-0 rounded-md border border-border/40 bg-background/95 backdrop-blur-xl shadow-lg overflow-hidden">
          {loading && <div className="px-3 py-3 text-sm text-muted-foreground">Searching…</div>}
          {!loading && results.length === 0 && <div className="px-3 py-3 text-sm text-muted-foreground">No results.</div>}
          {!loading && results.map((r) => {
            const Icon = ICONS[r.entity_type] || Search
            return (
              <button key={`${r.entity_type}-${r.entity_id}`} onClick={() => go(r)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-foreground/5 transition-colors">
                <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.entity_type} · {r.subtitle}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
