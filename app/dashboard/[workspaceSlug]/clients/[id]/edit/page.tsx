import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getWorkspaceBySlug } from "@/lib/workspace"
import ClientForm from "../../client-form"

export default async function EditClientPage({ params }: { params: Promise<{ workspaceSlug: string, id: string }> }) {
  const { workspaceSlug, id } = await params
  const supabase = await createClient()
  const workspace = await getWorkspaceBySlug(supabase, workspaceSlug)

  if (!workspace) {
    notFound()
  }
  
  const { data: client } = await supabase.from("clients")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .single()

  if (!client) {
    notFound()
  }

  const basePath = `/dashboard/${workspaceSlug}`

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={`${basePath}/clients`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Edit Client</h1>
      </div>
      <ClientForm client={client} workspaceSlug={workspaceSlug} />
    </div>
  )
}
