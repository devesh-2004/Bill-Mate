"use client"

import { PublicNavbar } from "@/components/public-navbar"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { ArrowUpRight, ArrowRight, Bell, Search, Plus, MoreHorizontal } from "lucide-react"
import Link from "next/link"

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background text-foreground bg-muted/20">
      <PublicNavbar />
      
      <main className="container mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
            <div className="text-center md:text-left">
                <h1 className="text-3xl font-bold tracking-tight mb-2">See BillMate in Action</h1>
                <p className="text-muted-foreground">This is a static preview. No signup required.</p>
            </div>
            <div className="flex gap-4">
                <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700" asChild>
                    <Link href="/login">Start Using BillMate <ArrowRight className="ml-2 h-4 w-4"/></Link>
                </Button>
            </div>
        </div>

        {/* STATIC DASHBOARD MOCK */}
        <div className="border rounded-xl shadow-2xl bg-background overflow-hidden opacity-95">
            {/* Fake Navbar */}
            <div className="border-b bg-card px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <span className="font-bold text-lg">BillMate</span>
                    <div className="hidden md:flex gap-4 text-sm text-muted-foreground">
                        <span className="text-foreground font-medium">Dashboard</span>
                        <span>Clients</span>
                        <span>Invoices</span>
                        <span>Reports</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                     <Button variant="outline" size="sm"><Search className="h-4 w-4" /></Button>
                     <Button variant="ghost" size="sm"><Bell className="h-4 w-4" /></Button>
                     <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">JD</div>
                </div>
            </div>

            <div className="p-8 grid gap-8 bg-slate-50/50 dark:bg-slate-950/20">
                
                {/* Stats Row */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <span className="text-muted-foreground font-bold">₹</span>
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold">₹45,231.89</div>
                        <p className="text-xs text-muted-foreground flex items-center text-green-600 mt-1">
                            <ArrowUpRight className="h-3 w-3 mr-1" /> +20.1% from last month
                        </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                        <span className="text-red-500 font-bold">!</span>
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold text-red-600">₹12,200.00</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            2 invoices overdue
                        </p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending</CardTitle>
                        <div className="h-4 w-4 rounded-full bg-yellow-400" />
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold">₹8,500.00</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Due this week
                        </p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
                        <UsersIcon />
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold">12</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            +2 new clients
                        </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Area */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Recent Sales</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="space-y-6">
                            {[
                                { name: "Acme Corp", email: "finance@acme.com", amount: "+₹1,999.00" },
                                { name: "Globex Inc", email: "billing@globex.com", amount: "+₹24,500.00" },
                                { name: "Soylent Corp", email: "pay@soylent.com", amount: "+₹5,000.00" },
                                { name: "Initech", email: "accounts@initech.com", amount: "+₹2,300.00" },
                                { name: "Umbrella Corp", email: "hazard@umbrella.com", amount: "+₹11,400.00" },
                            ].map((sale, i) => (
                                <div key={i} className="flex items-center px-4">
                                     <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center font-bold text-xs">{sale.name[0]}</div>
                                     <div className="ml-4 space-y-1">
                                         <p className="text-sm font-medium leading-none">{sale.name}</p>
                                         <p className="text-sm text-muted-foreground">{sale.email}</p>
                                     </div>
                                     <div className="ml-auto font-medium">{sale.amount}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                    </Card>
                    <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>AI Insights</CardTitle>
                        <CardDescription>
                        Payment predictions & reminders
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-sm border border-indigo-100 dark:border-indigo-800">
                                <p className="font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                                    🚀 Payment Prediction
                                </p>
                                <p className="mt-1 text-muted-foreground">
                                    Based on history, <strong>Globex Inc</strong> is likely to pay invoice #1024 3 days late.
                                </p>
                            </div>
                             <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-sm border border-yellow-100 dark:border-yellow-800">
                                <p className="font-semibold text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                                    ⚠️ Action Required
                                </p>
                                <p className="mt-1 text-muted-foreground">
                                    <strong>Soylent Corp</strong> invoice is 5 days overdue. Click to send automated reminder.
                                </p>
                                <Button size="sm" variant="outline" className="mt-2 h-7">Send Reminder</Button>
                            </div>
                        </div>
                    </CardContent>
                    </Card>
                </div>
            </div>
        </div>
      </main>
    </div>
  )
}

function UsersIcon() {
    return (
        <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        className="h-4 w-4 text-muted-foreground"
        >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    )
}
