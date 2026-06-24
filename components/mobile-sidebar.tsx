"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, FileText, LogOut, Menu, X, Repeat, Receipt, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { WorkspaceSwitcher } from "./workspace-switcher"

export function MobileSidebar({ workspaces = [], currentWorkspaceSlug }: { workspaces?: any[], currentWorkspaceSlug?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

  const basePath = currentWorkspaceSlug ? `/dashboard/${currentWorkspaceSlug}` : '/dashboard'

  const sidebarItems = [
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 p-0 border-r border-border/40 bg-background/95 backdrop-blur-xl"
        showCloseButton={false}
      >
        <div className="flex flex-col h-full safe-panel-top safe-panel-bottom px-4 space-y-6">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
              BillMate
            </span>
            <SheetClose asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>

          <WorkspaceSwitcher workspaces={workspaces} currentWorkspaceSlug={currentWorkspaceSlug} />

          <nav className="flex-1 space-y-1">
            {sidebarItems.map((item) => {
              const isActive = item.href === basePath
                ? pathname === basePath
                : pathname.startsWith(item.href)

              return (
                <SheetClose asChild key={item.href}>
                  <Link href={item.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start transition-all duration-200 group relative overflow-hidden",
                        isActive
                          ? "bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20"
                          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full" />
                      )}
                      <item.icon className={cn("mr-3 h-4 w-4", isActive ? "text-indigo-500" : "")} />
                      <span className="font-medium">{item.title}</span>
                    </Button>
                  </Link>
                </SheetClose>
              )
            })}
          </nav>

          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
            onClick={handleSignOut}
          >
            <LogOut className="mr-3 h-4 w-4" />
            <span className="font-medium">Sign Out</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
