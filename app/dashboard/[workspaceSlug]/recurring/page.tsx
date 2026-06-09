import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getWorkspaceBySlug } from "@/lib/workspace"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Plus, Repeat } from "lucide-react"
import { RecurringRowActions } from "./row-actions"

const STATUS_VARIANT: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-500",
  paused: "bg-amber-500/15 text-amber-500",
  cancelled: "bg-muted text-muted-foreground",
}

export default async function RecurringPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params
  const supabase = await createClient()
  const currentWorkspace = await getWorkspaceBySlug(supabase, workspaceSlug)
  if (!currentWorkspace) return <div>Workspace not found.</div>

  const { data: schedules } = await supabase
    .from("recurring_invoices")
    .select("*, clients(name)")
    .eq("workspace_id", currentWorkspace.id)
    .order("created_at", { ascending: false })

  const basePath = `/dashboard/${workspaceSlug}`
  const canManage = currentWorkspace.role !== "member"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Repeat className="h-7 w-7 text-indigo-500" /> Recurring Invoices
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Schedules that auto-generate invoices.</p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href={`${basePath}/recurring/new`}><Plus className="mr-2 h-4 w-4" /> New Schedule</Link>
          </Button>
        )}
      </div>

      <div className="rounded-md border border-border/40 bg-background/60 backdrop-blur-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead>Generated</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(schedules || []).map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.title || "Untitled"}</TableCell>
                <TableCell>{s.clients?.name || "—"}</TableCell>
                <TableCell className="capitalize">
                  {s.interval_count > 1 ? `Every ${s.interval_count} ` : ""}{s.frequency}
                </TableCell>
                <TableCell>{s.next_run_at ? new Date(s.next_run_at).toLocaleDateString() : "—"}</TableCell>
                <TableCell>{s.occurrences_generated}{s.max_occurrences ? ` / ${s.max_occurrences}` : ""}</TableCell>
                <TableCell>
                  <Badge className={STATUS_VARIANT[s.status] || ""} variant="secondary">{s.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {canManage ? (
                    <RecurringRowActions id={s.id} status={s.status} workspaceSlug={workspaceSlug} />
                  ) : (
                    <span className="text-xs text-muted-foreground italic">View Only</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!schedules || schedules.length === 0) && (
              <TableRow><TableCell colSpan={7} className="h-24 text-center">No recurring schedules yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
