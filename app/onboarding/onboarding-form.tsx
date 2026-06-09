"use client"

import { useActionState } from "react"
import { createWorkspaceAction } from "./actions"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

const initialState = {
  error: "",
}

export function OnboardingForm() {
  const [state, formAction, isPending] = useActionState(createWorkspaceAction, initialState)

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Workspace Name</Label>
        <Input id="name" name="name" placeholder="Acme Corp" required disabled={isPending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Workspace Slug (URL)</Label>
        <div className="flex items-center">
          <span className="text-muted-foreground bg-muted px-3 py-2 rounded-l-md border border-r-0 border-input text-sm select-none">
            billmate.com/
          </span>
          <Input 
            id="slug" 
            name="slug" 
            placeholder="acme-corp" 
            className="rounded-l-none" 
            required 
            pattern="[a-z0-9-]+" 
            title="Only lowercase letters, numbers, and hyphens" 
            disabled={isPending}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">This will be your dedicated workspace URL.</p>
      </div>

      {state?.error && (
        <p className="text-sm font-medium text-red-500 bg-red-500/10 p-3 rounded-md border border-red-500/20">
          {state.error}
        </p>
      )}

      <Button 
        type="submit" 
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]"
        disabled={isPending}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          "Create Workspace"
        )}
      </Button>
    </form>
  )
}
