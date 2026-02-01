'use server'

import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

export async function generateInvoiceSummary(invoiceDetails: any) {
  if (!process.env.GEMINI_API_KEY) {
    return { error: "Gemini API Key not configured" }
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" })

    const prompt = `
      System: You are an assistant helping freelancers manage invoices.
      Context: The following invoice details are provided:
      Client: ${invoiceDetails.clientName}
      Amount: ₹${invoiceDetails.total}
      Due Date: ${invoiceDetails.dueDate}
      Status: ${invoiceDetails.status}
      Items: ${invoiceDetails.items.map((i: any) => `${i.description} (₹${i.price})`).join(", ")}

      Task: Generate a short, professional summary of this invoice for the freelancer. 
      Also provide a polite payment reminder message that can be sent to the client.
      
      Output format:
      Summary: [Summary text]
      Reminder: [Reminder text]
    `

    const result = await model.generateContent(prompt)
    const response = result.response;
    const text = response.text();
    
    return { text }
  } catch (error: any) {
    console.error("Gemini API Error:", error)
    return { error: "Failed to generate summary: " + error.message }
  }
}
