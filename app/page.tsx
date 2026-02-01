"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, CheckCircle, Zap, Shield, BarChart3, LayoutDashboard, FileText, ArrowUpRight } from "lucide-react"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { PublicNavbar } from "@/components/public-navbar"

export default function LandingPage() {
  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/50 via-background to-background dark:from-indigo-950/20 dark:via-background dark:to-background">
      <PublicNavbar />


      <main className="flex-1 grid grid-rows-[1fr_auto] lg:grid-cols-2 lg:grid-rows-1 gap-0 p-6 max-w-7xl mx-auto w-full h-[calc(100vh-60px)]">
         
         {/* LEFT CONTENT */}
         <div className="flex flex-col justify-center gap-6 lg:pr-12 h-full">
            <div className="space-y-4">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Badge variant="outline" className="mb-4 bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
                        ✨ New: Smart Risk Insights & Branding
                    </Badge>
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight text-foreground">
                        Smart Invoicing for <span className="text-indigo-600 dark:text-indigo-400">Freelancers</span>
                    </h1>
                    <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mt-4">
                        Create invoices, track payments, and get paid faster — without spreadsheets or stress. Integrated with AI reminders.
                    </p>
                </motion.div>
                
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="flex gap-4 pt-4"
                >
                    <Button size="lg" className="h-12 px-8 text-base bg-indigo-600 hover:bg-indigo-700" asChild>
                        <Link href="/login">Get Started <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                    <Button size="lg" variant="outline" className="h-12 px-8 text-base shadow-sm" asChild>
                        <Link href="/demo">View Demo</Link>
                    </Button>
                </motion.div>
            </div>

            {/* PROBLEM / SOLUTION STRIP - Integrated into left side bottom */}
            <div className="grid grid-cols-3 gap-4 mt-8 lg:mt-12">
               {[
                   { icon: FileText, label: "Smart Invoices", desc: "Auto-generated PDFs" },
                   { icon: Zap, label: "AI Reminders", desc: "Chasing payments done for you" },
                   { icon: BarChart3, label: "Insights", desc: "Track revenue & risk" }
               ].map((item, i) => (
                   <motion.div 
                     key={i}
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     transition={{ delay: 0.4 + i*0.1 }}
                     className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border rounded-xl p-3 flex flex-col gap-2 hover:bg-white dark:hover:bg-card transition-colors shadow-sm"
                   >
                       <item.icon className="h-5 w-5 text-indigo-500" />
                       <div>
                           <div className="font-semibold text-sm">{item.label}</div>
                           <div className="text-xs text-muted-foreground leading-tight">{item.desc}</div>
                       </div>
                   </motion.div>
               ))}
            </div>
         </div>

         {/* RIGHT VISUAL */}
         <div className="hidden lg:flex items-center justify-center relative h-full w-full pl-8">
             <div className="absolute inset-0 bg-gradient-to-tr from-indigo-100/50 to-purple-100/50 dark:from-indigo-900/10 dark:to-purple-900/10 rounded-3xl -z-10 blur-3xl transform translate-x-10 translate-y-10" />
             
             <motion.div 
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, type: "spring" }}
                className="relative w-full max-w-lg"
             >
                 {/* Main Dashboard Preview Card */}
                 <div className="bg-background border rounded-2xl shadow-2xl overflow-hidden glass-panel">
                     <div className="p-4 border-b bg-muted/30 flex items-center gap-2">
                         <div className="h-3 w-3 rounded-full bg-red-400" />
                         <div className="h-3 w-3 rounded-full bg-yellow-400" />
                         <div className="h-3 w-3 rounded-full bg-green-400" />
                         <div className="ml-auto text-xs text-muted-foreground bg-white/50 px-2 py-0.5 rounded-full border">dashboard.billmate.io</div>
                     </div>
                     <div className="p-6 space-y-6">
                         <div className="flex justify-between items-end">
                             <div>
                                 <div className="text-sm text-muted-foreground">Total Revenue</div>
                                 <div className="text-3xl font-bold flex items-center gap-2">
                                     ₹1,24,500 
                                     <span className="text-xs font-normal text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full flex items-center">
                                         <ArrowUpRight className="h-3 w-3 mr-0.5" /> +12%
                                     </span>
                                 </div>
                             </div>
                             <Button size="sm" className="bg-indigo-600">New Invoice</Button>
                         </div>
                         
                         <div className="space-y-3">
                             {[
                                 { client: "Acme Corp", amount: "₹45,000", status: "Paid", color: "bg-green-500" },
                                 { client: "Globex Inc", amount: "₹12,200", status: "Overdue", color: "bg-red-500" },
                                 { client: "Soylent Corp", amount: "₹8,500", status: "Pending", color: "bg-yellow-500" }
                             ].map((inv, k) => (
                                 <div key={k} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-md transition-shadow">
                                     <div className="flex items-center gap-3">
                                         <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600">
                                             {inv.client[0]}
                                         </div>
                                         <div className="text-sm font-medium">{inv.client}</div>
                                     </div>
                                     <div className="flex items-center gap-4">
                                         <span className="text-sm font-bold">{inv.amount}</span>
                                         <span className={`text-[10px] px-2 py-0.5 rounded-full text-white ${inv.color}`}>{inv.status}</span>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     </div>
                 </div>

                 {/* Floating Elements */}
                 <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="absolute -right-8 top-20 bg-white dark:bg-card p-4 rounded-xl shadow-xl border w-48 z-10"
                 >
                     <div className="flex items-center gap-3 mb-2">
                         <div className="p-1.5 bg-green-100 rounded-lg">
                             <CheckCircle className="h-4 w-4 text-green-600" />
                         </div>
                         <div className="text-xs font-semibold">Payment Received</div>
                     </div>
                     <div className="text-sm text-muted-foreground">Invoice #1024 paid by Acme Corp</div>
                 </motion.div>

                 <motion.div 
                    animate={{ y: [0, 10, 0] }}
                    transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
                    className="absolute -left-8 bottom-32 bg-white dark:bg-card p-4 rounded-xl shadow-xl border w-56 z-10"
                 >
                     <div className="flex items-center gap-3 mb-2">
                         <div className="p-1.5 bg-indigo-100 rounded-lg">
                             <Zap className="h-4 w-4 text-indigo-600" />
                         </div>
                         <div className="text-xs font-semibold">AI Assistant</div>
                     </div>
                     <div className="text-xs text-muted-foreground">"I've drafted a reminder for Globex Inc (3 days overdue)."</div>
                     <div className="mt-2 text-xs text-indigo-600 font-medium cursor-pointer">Review Draft →</div>
                 </motion.div>

             </motion.div>
         </div>

      </main>
    </div>
  )
}
