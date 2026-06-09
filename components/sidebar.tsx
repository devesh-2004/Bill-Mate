"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, FileText, LogOut, Repeat, Receipt, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { WorkspaceSwitcher } from "./workspace-switcher"

export function Sidebar({ className, workspaces = [], currentWorkspaceSlug }: { className?: string, workspaces?: any[], currentWorkspaceSlug?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  // Base path for the current workspace
  const basePath = currentWorkspaceSlug ? `/dashboard/${currentWorkspaceSlug}` : '/dashboard'

  const dynamicSidebarItems = [
    { title: "Dashboard", href: basePath, icon: LayoutDashboard },
    { title: "Clients", href: `${basePath}/clients`, icon: Users },
    { title: "Invoices", href: `${basePath}/invoices`, icon: FileText },
    { title: "Recurring", href: `${basePath}/recurring`, icon: Repeat },
    { title: "Expenses", href: `${basePath}/expenses`, icon: Receipt },
    { title: "Forecast", href: `${basePath}/forecast`, icon: Sparkles },
    { title: "Team", href: `${basePath}/settings/team`, icon: Users },
  ]

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className={cn("pb-12 min-h-screen border-none bg-transparent flex flex-col", className)}>
      <div className="space-y-6 py-6 flex-1 px-4">
        <div className="mb-8">
           <WorkspaceSwitcher workspaces={workspaces} currentWorkspaceSlug={currentWorkspaceSlug} />
        </div>
        <div className="flex-1">
          <div className="space-y-2">
            {dynamicSidebarItems.map((item) => {
              // Exact match for dashboard, prefix match for others to keep active state on sub-pages
              const isActive = item.href === basePath 
                 ? pathname === basePath 
                 : pathname.startsWith(item.href)

              return (
                <Button
                  key={item.href}
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start transition-all duration-200 group relative overflow-hidden",
                    isActive 
                      ? "bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300" 
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                  )}
                  asChild
                >
                  <Link href={item.href}>
                    {isActive && (
                       <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                    )}
                    <item.icon className={cn("mr-3 h-4 w-4 transition-colors", isActive ? "text-indigo-500" : "group-hover:text-foreground")} />
                    <span className="font-medium">{item.title}</span>
                  </Link>
                </Button>
              )
            })}
          </div>
        </div>
        <div className="mt-auto pt-8">
             <Button 
                variant="ghost" 
                className="w-full justify-start text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors" 
                onClick={handleSignOut}
             >
                <LogOut className="mr-3 h-4 w-4" />
                <span className="font-medium">Sign Out</span>
             </Button>
        </div>
      </div>
    </div>
  )
}
