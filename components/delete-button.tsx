"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"

export function DeleteButton({ id, action }: { id: string, action: (id: string) => Promise<void | { error: string }> }) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this? This action cannot be undone.")) {
      startTransition(async () => {
        await action(id)
      })
    }
  }

  return (
    <Button 
      variant="destructive" 
      size="icon" 
      onClick={handleDelete} 
      disabled={isPending}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}
