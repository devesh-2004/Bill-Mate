"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string)

export async function generateFinancialInsights(revenueData: any[], stats: any) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy-key') {
     return "AI Insights unavailable: invalid API Key."
  }

  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" })

  const prompt = `
    Analyze the following financial data for a freelancer/small business:
    
    Current Stats:
    - Total Revenue: ₹${stats.totalRevenue}
    - Pending Invoices: ₹${stats.pendingAmount} (${stats.pendingCount} count)
    - Overdue Invoices: ₹${stats.overdueAmount} (${stats.overdueCount} count)
    
    Monthly Revenue Trend:
    ${JSON.stringify(revenueData)}
    
    Please provide a concise financial insight report (max 150 words). 
    Cover:
    1. Revenue Trend (Growing/Declining?)
    2. Cash Flow Health (High pending/overdue?)
    3. One actionable tip to improve cash flow.
    
    Keep the tone professional yet encouraging.
  `

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    return text
  } catch (error: any) {
    console.error("Gemini Error:", error)
    
    // Check for common 404 model error which usually means API Key is limited or wrong project type
    if (error.message?.includes("404") || error.message?.includes("not found")) {
        return "Error: Model not found. Please ensure your API Key is from Google AI Studio (aistudio.google.com) and NOT Vertex AI/GCP, or that the 'Generative Language API' is enabled in your console."
    }
    
    return `Error: ${error.message || "Unknown error occurred"}`
  }
}
