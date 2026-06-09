"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
}

export default function DashboardStats({ stats }: { stats: any }) {
  const statCards = [
    {
      title: "Total Revenue",
      value: `₹${stats.totalRevenue.toFixed(2)}`,
      subtext: "From paid invoices",
      icon: DollarSign,
      trend: null,
      isPositive: true,
      glow: "shadow-[0_0_20px_rgba(99,102,241,0.15)]",
      iconBg: "bg-indigo-500/10 text-indigo-500",
    },
    {
      title: "Pending Payments",
      value: `₹${stats.pendingAmount.toFixed(2)}`,
      subtext: `${stats.pendingCount} pending invoice${stats.pendingCount !== 1 ? 's' : ''}`,
      icon: Clock,
      trend: null,
      isPositive: true,
      glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]",
      iconBg: "bg-amber-500/10 text-amber-500",
    },
    {
      title: "Overdue Amount",
      value: `₹${stats.overdueAmount.toFixed(2)}`,
      subtext: `${stats.overdueCount} overdue invoice${stats.overdueCount !== 1 ? 's' : ''}`,
      icon: AlertTriangle,
      trend: null,
      isPositive: false,
      glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]",
      iconBg: "bg-red-500/10 text-red-500",
    },
    {
      title: "Active Clients",
      value: String(stats.clientCount ?? 0), // FIX: Use real count from DB
      subtext: "In this workspace",
      icon: Activity,
      trend: null,
      isPositive: true,
      glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
      iconBg: "bg-emerald-500/10 text-emerald-500",
    }
  ]

  return (
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
      >
        {statCards.map((stat, i) => (
          <motion.div key={i} variants={item as any} className="h-full">
            <Card className={cn(
              "relative overflow-hidden h-full border-border/40 bg-background/60 backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:bg-background/80",
              stat.glow
            )}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
              
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <div className={cn("p-2 rounded-xl", stat.iconBg)}>
                   <stat.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-3xl font-bold tracking-tight mb-1">{stat.value}</div>
                <div className="flex items-center gap-2 mt-2">
                   {stat.trend && (
                     <span className={cn(
                       "flex items-center text-xs font-medium px-2 py-0.5 rounded-full",
                       stat.isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                     )}>
                       {stat.isPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                       {stat.trend}
                     </span>
                   )}
                   <span className="text-xs text-muted-foreground">
                     {stat.subtext}
                   </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
  )
}
