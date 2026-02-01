"use client"

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function ProfitLossChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
      return (
          <Card>
              <CardHeader>
                  <CardTitle>Profit vs Loss</CardTitle>
                  <CardDescription>No data available yet.</CardDescription>
              </CardHeader>
          </Card>
      )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profit Curve</CardTitle>
        <CardDescription>Revenue (Paid) vs Potential Loss (Overdue)</CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis 
                dataKey="name" 
                stroke="#888888" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
              />
              <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `₹${value}`}
              />
              <Tooltip 
                 contentStyle={{ borderRadius: '8px' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="profit" 
                name="Profit (Paid)"
                stroke="#10b981" 
                strokeWidth={2}
                activeDot={{ r: 8 }}
              />
               <Line 
                type="monotone" 
                dataKey="loss" 
                name="Loss (Overdue)"
                stroke="#ef4444" 
                strokeWidth={2} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
