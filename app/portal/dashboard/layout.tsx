import { getPortalSession, signOutPortal } from '../actions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LogOut, Home, FileText, User, MessageSquare } from 'lucide-react'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession()
  
  if (!session) {
    redirect('/portal/invalid') // We'll create a simple invalid page
  }

  // Get workspace branding
  let adminSupabase
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    adminSupabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
  } else {
    adminSupabase = await createClient()
  }

  const { data: workspace } = await adminSupabase
    .from('workspaces')
    .select('name, logo_url')
    .eq('id', session.workspaceId)
    .single()

  const { data: client } = await adminSupabase
    .from('clients')
    .select('name')
    .eq('id', session.clientId)
    .single()

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {workspace?.logo_url ? (
              <img src={workspace.logo_url} alt={workspace.name} className="h-8" />
            ) : (
              <span className="text-xl font-bold text-primary">{workspace?.name || 'Client Portal'}</span>
            )}
          </div>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
              <Link href="/portal/dashboard" className="text-muted-foreground hover:text-foreground flex items-center gap-2">
                <Home className="h-4 w-4" /> Overview
              </Link>
              <Link href="/portal/dashboard/invoices" className="text-muted-foreground hover:text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" /> Invoices
              </Link>
              <Link href="/portal/dashboard/messages" className="text-muted-foreground hover:text-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Messages
              </Link>
              <Link href="/portal/dashboard/profile" className="text-muted-foreground hover:text-foreground flex items-center gap-2">
                <User className="h-4 w-4" /> Profile
              </Link>
            </nav>
            <div className="flex items-center gap-4 border-l pl-4">
              <span className="text-sm font-medium hidden sm:inline-block">{client?.name}</span>
              <form action={async () => {
                'use server'
                await signOutPortal()
                redirect('/portal/invalid')
              }}>
                <button type="submit" className="text-muted-foreground hover:text-destructive flex items-center gap-2">
                  <LogOut className="h-4 w-4" /> <span className="sr-only sm:not-sr-only text-sm">Sign Out</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="md:hidden border-b bg-background overflow-x-auto">
        <nav className="flex items-center gap-6 px-4 py-3 text-sm font-medium">
          <Link href="/portal/dashboard" className="whitespace-nowrap text-muted-foreground hover:text-foreground">Overview</Link>
          <Link href="/portal/dashboard/invoices" className="whitespace-nowrap text-muted-foreground hover:text-foreground">Invoices</Link>
          <Link href="/portal/dashboard/messages" className="whitespace-nowrap text-muted-foreground hover:text-foreground">Messages</Link>
          <Link href="/portal/dashboard/profile" className="whitespace-nowrap text-muted-foreground hover:text-foreground">Profile</Link>
        </nav>
      </div>

      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
