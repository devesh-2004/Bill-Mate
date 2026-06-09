"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Pause, Play, Trash2 } from "lucide-react"
import { setRecurringStatusAction, deleteRecurringAction } from "./actions"
import { useRouter } from "next/navigation"

export function RecurringRowActions({ id, status, workspaceSlug }: { id: string; status: string; workspaceSlug: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const toggle = () =>
    startTransition(async () => {
      await setRecurringStatusAction(workspaceSlug, id, status === "active" ? "paused" : "active")
      router.refresh()
    })

  const remove = () =>
    startTransition(async () => {
      if (!confirm("Delete this recurring schedule? Generated invoices are kept.")) return
      await deleteRecurringAction(workspaceSlug, id)
      router.refresh()
    })

  return (
    <div className="flex justify-end gap-1">
      {status !== "cancelled" && (
        <Button variant="ghost" size="icon" disabled={isPending} onClick={toggle} title={status === "active" ? "Pause" : "Resume"}>
          {status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
      )}
      <Button variant="ghost" size="icon" disabled={isPending} onClick={remove} className="text-red-500 hover:text-red-600" title="Delete">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
