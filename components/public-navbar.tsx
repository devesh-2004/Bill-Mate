"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function PublicNavbar() {
    const pathname = usePathname()

    return (
        <nav className="flex items-center justify-between px-6 py-4 border-b bg-background/50 backdrop-blur-md sticky top-0 z-50 h-[60px]">
            <div className="flex items-center gap-2">
                <Link href="/" className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">B</div>
                    <span className="text-xl font-bold tracking-tight">BillMate</span>
                </Link>
            </div>
            
            <div className="hidden md:flex gap-8 text-sm font-medium text-muted-foreground">
                <Link 
                    href="/features" 
                    className={cn(
                        "hover:text-foreground transition-colors", 
                        pathname === "/features" && "text-foreground font-semibold"
                    )}
                >
                    Features
                </Link>
                <Link 
                    href="/how-it-works" 
                    className={cn(
                        "hover:text-foreground transition-colors", 
                        pathname === "/how-it-works" && "text-foreground font-semibold"
                    )}
                >
                    How It Works
                </Link>
            </div>


        </nav>
    )
}
