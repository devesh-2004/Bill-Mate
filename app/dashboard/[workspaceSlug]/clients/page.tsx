import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getCurrentWorkspace } from "@/lib/workspace"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Edit } from "lucide-react"
import { DeleteButton } from "@/components/delete-button"
import { deleteClientAction } from "./actions"

import { getWorkspaceBySlug } from "@/lib/workspace"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

async function getClients(workspace_id: string, search?: string) {
  const supabase = await createClient()

  let query = supabase.from("clients")
    .select("*")
    .eq("workspace_id", workspace_id)
    .order("created_at", { ascending: false })

  if (search) {
     query = query.ilike('name', `%${search}%`)
  }

  const { data } = await query
  return data || []
}

export default async function ClientsPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ workspaceSlug: string }>,
  searchParams: Promise<{ q?: string }>
}) {
  const { workspaceSlug } = await params
  const { q } = await searchParams

  const supabase = await createClient()
  const currentWorkspace = await getWorkspaceBySlug(supabase, workspaceSlug)
  
  if (!currentWorkspace) return <div>Workspace not found.</div>

  const search = q || ''
  const clients = await getClients(currentWorkspace.id, search)
  const basePath = `/dashboard/${workspaceSlug}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        {currentWorkspace.role !== 'member' && (
          <Button asChild>
            <Link href={`${basePath}/clients/new`}>
              <Plus className="mr-2 h-4 w-4" /> Add Client
            </Link>
          </Button>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-2">
         <form className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
               type="search" 
               name="q"
               defaultValue={search}
               placeholder="Search clients..." 
               className="pl-8 bg-background/60 backdrop-blur-md" 
            />
         </form>
      </div>

      <div className="rounded-md border border-border/40 bg-background/60 backdrop-blur-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.name}</TableCell>
                <TableCell>{client.email}</TableCell>
                <TableCell>{client.phone}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {currentWorkspace.role !== 'member' ? (
                      <>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`${basePath}/clients/${client.id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <DeleteButton id={client.id} action={deleteClientAction.bind(null, workspaceSlug)} />
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground italic px-2 py-1">View Only</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No clients found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
