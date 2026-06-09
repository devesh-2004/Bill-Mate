"use client"

import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function RevenueChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
      return (
          <Card className="border-border/40 bg-background/60 backdrop-blur-xl h-full">
              <CardHeader>
                  <CardTitle>Revenue Overview</CardTitle>
                  <CardDescription>No data available yet.</CardDescription>
              </CardHeader>
          </Card>
      )
  }

  return (
    <Card className="border-border/40 bg-background/60 backdrop-blur-xl h-full flex flex-col transition-all duration-300 hover:shadow-[0_0_30px_rgba(99,102,241,0.05)]">
      <CardHeader>
        <CardTitle className="text-xl font-bold tracking-tight">Revenue Overview</CardTitle>
        <CardDescription>Monthly revenue breakdown across all clients</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-4 min-h-[300px]">
        <div className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="name" 
                stroke="#888888" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                dy={10}
              />
              <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `₹${value}`}
                dx={-10}
              />
              <Tooltip 
                 cursor={{stroke: 'rgba(99,102,241,0.2)', strokeWidth: 2}}
                 contentStyle={{ 
                    backgroundColor: 'rgba(10, 10, 10, 0.8)', 
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)'
                 }}
                 itemStyle={{ color: '#fff', fontWeight: 'bold' }}
              />
              <Area 
                type="monotone" 
                dataKey="total" 
                stroke="#6366f1" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorTotal)" 
                activeDot={{ r: 6, strokeWidth: 0, fill: '#818cf8', className: "shadow-[0_0_20px_#818cf8]" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
