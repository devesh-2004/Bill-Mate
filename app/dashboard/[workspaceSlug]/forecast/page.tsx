import { createClient } from "@/lib/supabase/server"
import { getWorkspaceBySlug } from "@/lib/workspace"
import { ForecastClient } from "./forecast-client"
import type { ForecastContent } from "@/lib/types"

export default async function ForecastPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params
  const supabase = await createClient()
  const currentWorkspace = await getWorkspaceBySlug(supabase, workspaceSlug)
  if (!currentWorkspace) return <div>Workspace not found.</div>

  // Most recent saved forecast.
  const { data: latest } = await supabase
    .from("ai_reports")
    .select("content")
    .eq("workspace_id", currentWorkspace.id)
    .eq("report_type", "forecast")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return <ForecastClient workspaceSlug={workspaceSlug} initial={(latest?.content as ForecastContent) || null} />
}
