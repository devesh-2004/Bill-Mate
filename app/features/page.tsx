"use client"

import { PublicNavbar } from "@/components/public-navbar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, Zap, Shield, BarChart3, Globe, History } from "lucide-react"
import { motion } from "framer-motion"

export default function FeaturesPage() {
  const features = [
    {
      icon: FileText,
      title: "Smart Invoice Generation",
      description: "Auto-calculated totals, taxes, and professional PDF generation tailored to your brand.",
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/20"
    },
    {
      icon: Zap,
      title: "AI Payment Reminders",
      description: "Gemini-powered polite reminders sent with one click. Get paid faster without the awkwardness.",
      color: "text-yellow-500",
      bg: "bg-yellow-50 dark:bg-yellow-950/20"
    },
    {
      icon: BarChart3,
      title: "Client Risk Insights",
      description: "Track payment history and see risk badges (Low, Medium, High) before you start working.",
      color: "text-red-500",
      bg: "bg-red-50 dark:bg-red-950/20"
    },
    {
      icon: Globe,
      title: "Multi-Currency & Tax",
      description: "Support for global clients with custom currency symbols (₹, $, £, etc.) and tax rates.",
      color: "text-green-500",
      bg: "bg-green-50 dark:bg-green-950/20"
    },
    {
      icon: History,
      title: "Activity Timeline",
      description: "Full audit log of every action taken on an invoice. Know exactly who did what and when.",
      color: "text-purple-500",
      bg: "bg-purple-50 dark:bg-purple-950/20"
    },
    {
      icon: Shield,
      title: "Secure by Design",
      description: "Built on Supabase with Row Level Security (RLS) to ensure your data is always private.",
      color: "text-indigo-500",
      bg: "bg-indigo-50 dark:bg-indigo-950/20"
    }
  ]

  return (
    <div className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/50 via-background to-background dark:from-indigo-950/20 dark:via-background dark:to-background">
      <PublicNavbar />
      
      <main className="container mx-auto px-6 py-16">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <Badge variant="outline" className="mb-2">Powerful Features</Badge>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                Everything You Need to <span className="text-indigo-600">Get Paid Faster</span>
            </h1>
            <p className="text-xl text-muted-foreground">
                BillMate gives you the tools to manage clients, issue invoices, and track revenue—all in one place.
            </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
                <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                >
                    <Card className="h-full border-muted/60 shadow-sm hover:shadow-md transition-all hover:border-indigo-200 dark:hover:border-indigo-800">
                        <CardHeader>
                            <div className={`w-12 h-12 rounded-lg ${feature.bg} flex items-center justify-center mb-4`}>
                                <feature.icon className={`h-6 w-6 ${feature.color}`} />
                            </div>
                            <CardTitle className="text-xl">{feature.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription className="text-base">
                                {feature.description}
                            </CardDescription>
                        </CardContent>
                    </Card>
                </motion.div>
            ))}
        </div>
      </main>
    </div>
  )
}
