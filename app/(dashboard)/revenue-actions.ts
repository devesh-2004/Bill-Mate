"use server"

import { createClient } from "@/lib/supabase/server"

export async function getMonthlyRevenue() {
  const supabase = await createClient()

  // Fetch ALL invoices to calculate both Paid (Revenue) and Overdue (Loss)
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("total, created_at, status")
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching revenue:", error)
    return []
  }

  // Group by Month
  const monthlyData = invoices.reduce((acc: any, curr: any) => {
    const date = new Date(curr.created_at)
    const month = date.toLocaleString('default', { month: 'short', year: 'numeric' })
    
    if (!acc[month]) {
      acc[month] = { revenue: 0, loss: 0 }
    }
    
    if (curr.status === "Paid") {
        acc[month].revenue += Number(curr.total)
    } else if (curr.status === "Overdue") {
        acc[month].loss += Number(curr.total)
    }
    
    return acc
  }, {})

  // Convert to array
  return Object.entries(monthlyData).map(([name, values]: [string, any]) => ({
    name,
    total: values.revenue, // For backward compatibility with existing RevenueChart
    loss: values.loss,
    profit: values.revenue // 'Profit' curve essentially tracks collected revenue
  }))
}
