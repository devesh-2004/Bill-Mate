"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useRouter } from "next/navigation"

type Workspace = {
  id: string
  name: string
  slug: string
  logo_url?: string
  role: string
}

export function WorkspaceSwitcher({ workspaces, currentWorkspaceSlug }: { workspaces: Workspace[], currentWorkspaceSlug?: string }) {
  const router = useRouter()
  
  // Find the active workspace based on the slug, or fallback to the first one
  const activeWorkspace = React.useMemo(() => {
     if (currentWorkspaceSlug) {
        return workspaces.find(w => w.slug === currentWorkspaceSlug) || workspaces[0] || null
     }
     return workspaces[0] || null
  }, [workspaces, currentWorkspaceSlug])

  const handleSelect = (workspace: Workspace) => {
    // Optionally preserve the cookie for "last used" memory
    document.cookie = `workspace_id=${workspace.id}; path=/; max-age=31536000`
    
    // Navigate via URL
    router.push(`/dashboard/${workspace.slug}`)
  }

  if (!activeWorkspace) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label="Select a workspace"
          className={cn("w-full justify-between", "px-4 py-2 border-0 bg-transparent hover:bg-secondary/80")}
        >
          <div className="flex items-center gap-2 truncate">
            <Avatar className="h-6 w-6">
              <AvatarImage src={activeWorkspace.logo_url} alt={activeWorkspace.name} />
              <AvatarFallback>{activeWorkspace.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="truncate">{activeWorkspace.name}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[220px] p-2" align="start">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => handleSelect(workspace)}
            className="flex items-center gap-2 cursor-pointer p-2"
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={workspace.logo_url} alt={workspace.name} />
              <AvatarFallback>{workspace.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate">{workspace.name}</span>
            <Check
              className={cn(
                "ml-auto h-4 w-4",
                activeWorkspace.id === workspace.id ? "opacity-100" : "opacity-0"
              )}
            />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/onboarding')}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
