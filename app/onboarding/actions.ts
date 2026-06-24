"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createNotification } from "@/lib/notifications"
import { redirect } from "next/navigation"

export async function createWorkspaceAction(prevState: any, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Identity is verified server-side here — the rest of the bootstrap is safe.
  if (!user) {
    return { error: "Unauthorized" }
  }

  const name = formData.get("name") as string
  const slug = formData.get("slug") as string

  if (!name || !slug) {
    return { error: "Name and slug are required" }
  }

  // Workspace creation is a bootstrap op: the new owner has no membership row
  // yet, which trips workspace-scoped RLS during the insert. Use the service
  // role and force owner_id to the authenticated user (cannot be spoofed).
  const admin = createAdminClient()

  const { data: workspace, error } = await admin
    .from("workspaces")
    .insert({
      name,
      slug: slug.toLowerCase(),
      owner_id: user.id,
    })
    .select()
    .single()

  if (error || !workspace) {
    console.error("Failed to create workspace:", error)
    if (error?.code === "23505") {
      return { error: "That workspace URL is already taken. Try another slug." }
    }
    return { error: error?.message || "Failed to create workspace." }
  }

  // The on_workspace_created trigger adds the owner membership; this is a
  // belt-and-suspenders upsert in case the trigger is missing.
  await admin
    .from("workspace_members")
    .upsert(
      { workspace_id: workspace.id, user_id: user.id, role: "owner" },
      { onConflict: "workspace_id,user_id", ignoreDuplicates: true }
    )

  // Welcome the new owner. Uses the admin client because the owner's membership
  // row was only just created above (avoids any RLS visibility race on insert).
  await createNotification(admin, {
    workspace_id: workspace.id,
    user_id: user.id,
    type: "system",
    title: "Welcome to BillMate",
    body: `Your workspace "${workspace.name}" is ready.`,
    link: `/dashboard/${workspace.slug}`,
  })

  redirect(`/dashboard/${workspace.slug}`)
}
