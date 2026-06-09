"use server"

import { generateFinancialInsightsText } from "@/lib/ai"

export async function generateFinancialInsights(revenueData: any[], stats: any) {
  const result = await generateFinancialInsightsText(revenueData, stats)
  return result.text || result.error || "No insights generated."
}
