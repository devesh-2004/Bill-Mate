import { Sidebar } from "@/components/sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "@/components/mode-toggle"
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { getUserWorkspaces, getWorkspaceBySlug } from "@/lib/workspace"
import { PageTransition } from "@/components/page-transition"
import { RealtimeProvider } from "@/components/realtime-provider"
import { MobileSidebar } from "@/components/mobile-sidebar"
import { NotificationBell } from "@/components/notification-bell"
import { GlobalSearch } from "@/components/global-search"
import { Toaster } from "sonner"
import { FlashToasts } from "@/components/flash-toasts"

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceSlug: string }>
}) {
  const { workspaceSlug } = await params
  const supabase = await createClient()
  const workspaces = await getUserWorkspaces(supabase)
  
  // Resolve workspace by slug from the URL
  const currentWorkspace = await getWorkspaceBySlug(supabase, workspaceSlug)

  if (!currentWorkspace) {
    // If the slug is invalid, or user has no access, redirect to their default
    if (workspaces.length > 0) {
       redirect(`/dashboard/${workspaces[0].slug || workspaces[0].id}`)
    } else {
       redirect('/onboarding')
    }
  }

  // Notification inbox for the bell (broadcasts + notifications addressed to me).
  const { data: { user } } = await supabase.auth.getUser()
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("workspace_id", currentWorkspace!.id)
    .order("created_at", { ascending: false })
    .limit(30)

  return (
    <div className="relative flex min-h-screen flex-col md:flex-row bg-background dark:bg-[#0a0a0a] text-foreground overflow-hidden px-safe">
      {/* Background ambient glow */}
      <div className="fixed inset-0 z-0 pointer-events-none flex justify-center opacity-30 dark:opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 blur-[120px]" />
        <div className="absolute top-[20%] right-[-10%] w-[30%] h-[50%] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <RealtimeProvider workspaceId={currentWorkspace!.id} />
      {/* Capacitor webviews are <600px, so Sonner uses `mobileOffset` (NOT `offset`).
          The mobile top offset clears the iOS notch/Dynamic Island via env(), with a
          24px floor so Android (where env()=0) still clears the status bar. */}
      <Toaster
        position="top-center"
        offset={{ top: "calc(env(safe-area-inset-top) + 16px)" }}
        mobileOffset={{ top: "calc(max(env(safe-area-inset-top), 24px) + 8px)" }}
      />
      <FlashToasts />

      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 flex-shrink-0 z-10 border-r border-border/40 bg-background/50 backdrop-blur-xl">
         <Sidebar workspaces={workspaces} currentWorkspaceSlug={workspaceSlug} />
      </div>

      <div className="flex-1 z-10 flex flex-col h-screen overflow-y-auto pb-safe">
        {/* Mobile Header with Hamburger */}
        <header className="flex items-center justify-between border-b border-border/40 px-4 pb-3 safe-header md:hidden bg-background/80 backdrop-blur-md sticky top-0 z-20">
          <MobileSidebar workspaces={workspaces} currentWorkspaceSlug={workspaceSlug} />
          <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
            BillMate
          </span>
          <div className="flex items-center gap-1">
            {user && <NotificationBell workspaceId={currentWorkspace!.id} userId={user.id} initial={notifications || []} />}
            <ModeToggle />
          </div>
        </header>

        <main className="p-4 md:p-8 flex-1 w-full max-w-7xl mx-auto">
           <div className="hidden md:flex justify-between items-center gap-2 mb-6">
              <GlobalSearch workspaceSlug={workspaceSlug} />
              <div className="flex items-center gap-2">
                {user && <NotificationBell workspaceId={currentWorkspace!.id} userId={user.id} initial={notifications || []} />}
                <ModeToggle />
              </div>
           </div>
           <PageTransition>
             {children}
           </PageTransition>
        </main>
      </div>
    </div>
  )
}
