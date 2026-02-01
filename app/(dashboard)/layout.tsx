import { Sidebar } from "@/components/sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "@/components/mode-toggle"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="hidden md:block w-64 flex-shrink-0">
         <Sidebar />
      </div>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b px-6 py-4 md:hidden">
            <span className="font-bold">BillMate</span>
            {/* Mobile menu trigger would go here */}
        </header>
        <main className="p-6">
           <div className="flex justify-end mb-4">
              <ModeToggle />
           </div>
           {children}
        </main>
      </div>
    </div>
  )
}
