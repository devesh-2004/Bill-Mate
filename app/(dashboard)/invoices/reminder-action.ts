"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"
import { createClient } from "@/lib/supabase/server"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string)

export async function generatePaymentReminder(invoice: any, clientName: string) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy-key') {
     return { error: "AI Service unavailable: Invalid API Key." }
  }

  const daysOverdue = Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 3600 * 24))
  
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" })

  const prompt = `
    You are an assistant helping freelancers politely request overdue payments.
    
    Context:
    - Client Name: ${clientName}
    - Invoice Number: ${invoice.invoice_number}
    - Total Amount: ₹${invoice.total}
    - Due Date: ${new Date(invoice.due_date).toLocaleDateString()}
    - Days Overdue: ${daysOverdue > 0 ? daysOverdue : 0} days
    
    Task:
    Write a short, polite, professional, and non-aggressive email reminder. 
    It should assume the client simply forgot.
    
    Output:
    Subject: [Subject Line]
    
    [Body of the email]
  `

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    
    // Log usage to AI Logs (if table exists)
    const supabase = await createClient()
    await supabase.from("ai_logs").insert({
        invoice_id: invoice.id,
        prompt: "Payment Reminder Generation",
        response: text
    })

    return { text }
  } catch (error: any) {
    console.error("Gemini Error:", error)
     if (error.message?.includes("404") || error.message?.includes("not found")) {
        return { error: "Error: AI Model not found. Check API Key configuration." }
    }
    return { error: `AI Error: ${error.message || "Unknown error"}` }
  }
}

export async function markReminderSent(invoiceId: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from("invoices")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", invoiceId)
    
    if (error) return { error: error.message }
    return { success: true }
}
