"use client"

import { PublicNavbar } from "@/components/public-navbar"
import { Users, FilePlus, Send, CheckCircle } from "lucide-react"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"

export default function HowItWorksPage() {
  const steps = [
    {
      icon: Users,
      title: "Add Clients",
      description: "Store your client details safely. Add them once and reuse them for every project.",
      color: "text-blue-500",
      bg: "bg-blue-100 dark:bg-blue-900/30"
    },
    {
      icon: FilePlus,
      title: "Create Invoice",
      description: "Add items, set custom tax rates, select currency, and let BillMate calculate the totals.",
      color: "text-indigo-500",
      bg: "bg-indigo-100 dark:bg-indigo-900/30"
    },
    {
      icon: Send,
      title: "Send or Download",
      description: "Generate a professional PDF invoice instantly to download or email directly to your client.",
      color: "text-purple-500",
      bg: "bg-purple-100 dark:bg-purple-900/30"
    },
    {
      icon: CheckCircle,
      title: "Track & Get Paid",
      description: "Monitor status (Paid/Overdue). Let AI send polite reminders so you don't have to chase payments.",
      color: "text-green-500",
      bg: "bg-green-100 dark:bg-green-900/30"
    }
  ]

  return (
    <div className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/50 via-background to-background dark:from-indigo-950/20 dark:via-background dark:to-background">
      <PublicNavbar />
      
      <main className="container mx-auto px-6 py-16">
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                How <span className="text-indigo-600">BillMate</span> Works
            </h1>
            <p className="text-xl text-muted-foreground">
                From adding a client to getting paid, the process is simple and streamlined.
            </p>
        </div>

        <div className="relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden lg:block absolute top-[60px] left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-200 to-transparent dark:via-indigo-800 -z-10" />

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                {steps.map((step, i) => (
                    <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.2 }}
                        className="relative bg-background md:bg-transparent"
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className={`w-20 h-20 rounded-full ${step.bg} flex items-center justify-center mb-6 shadow-sm border-4 border-background z-10`}>
                                <step.icon className={`h-8 w-8 ${step.color}`} />
                            </div>
                            <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                {step.description}
                            </p>
                            
                            <div className="mt-4 font-bold text-6xl text-muted/10 absolute top-10 right-0 -z-10 select-none">
                                {i + 1}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
      </main>
    </div>
  )
}
