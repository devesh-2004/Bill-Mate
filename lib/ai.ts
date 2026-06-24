import { GoogleGenerativeAI } from "@google/generative-ai"

// Try the configured model first, then fall back to widely-available models so
// a single unsupported model name doesn't break every AI feature. Override the
// primary with GEMINI_MODEL in .env.local.
// gemini-1.5-flash is RETIRED (404 on v1beta) — removed. gemini-flash-latest is
// an alias that always resolves to a current flash model, so the chain won't rot
// as versions rotate.
const MODELS = Array.from(new Set([
  process.env.GEMINI_MODEL || "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
]))

function getClient() {
  const key = process.env.GEMINI_API_KEY
  if (!key || key === 'dummy-key') {
    throw new Error("Invalid or missing Gemini API Key. Set GEMINI_API_KEY in .env.local.")
  }
  return new GoogleGenerativeAI(key)
}

/**
 * Generates text from a prompt, trying each model in turn. Throws only if every
 * model fails (with the last error message, which includes the model name).
 */
async function generateText(prompt: string): Promise<string> {
  const genAI = getClient()
  let lastErr: any
  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent(prompt)
      return result.response.text()
    } catch (e: any) {
      lastErr = e
      const msg = e?.message || ''
      console.error(`Gemini model "${modelName}" failed: ${msg}`)
      // A quota / rate-limit error is the real blocker. Surface it immediately
      // instead of falling through to other models, otherwise a later model's
      // unrelated error masks the true cause (this is exactly why a retired
      // model's 404 was being shown instead of the underlying 429).
      if (/\b429\b|quota|RESOURCE_EXHAUSTED|rate limit/i.test(msg)) {
        throw new Error("Gemini API quota exceeded (HTTP 429). The GEMINI_API_KEY project has no remaining quota — enable billing / a paid tier on that project, or use a key with available quota.")
      }
    }
  }
  throw new Error(`Gemini request failed (tried ${MODELS.join(', ')}): ${lastErr?.message || 'unknown error'}`)
}

export async function generateInvoiceSummaryText(invoiceDetails: any) {
  try {
    const prompt = `
      System: You are an assistant helping freelancers manage invoices.
      Context: The following invoice details are provided:
      Client: ${invoiceDetails.clientName}
      Amount: ${invoiceDetails.total}
      Due Date: ${invoiceDetails.dueDate}
      Status: ${invoiceDetails.status}
      Items: ${invoiceDetails.items?.map((i: any) => `${i.description} (${i.price})`).join(", ")}

      Task: Generate a short, professional summary of this invoice for the freelancer. 
      Also provide a polite payment reminder message that can be sent to the client.
      
      Output format:
      Summary: [Summary text]
      Reminder: [Reminder text]
    `
    const text = await generateText(prompt)
    return { text }
  } catch (error: any) {
    console.error("Gemini API Error:", error)
    return { error: "Failed to generate summary: " + error.message }
  }
}

export async function generateFinancialInsightsText(revenueData: any[], stats: any) {
  try {
    const prompt = `
      Analyze the following financial data for a freelancer/small business:
      
      Current Stats:
      - Total Revenue: ${stats.totalRevenue}
      - Pending Invoices: ${stats.pendingAmount} (${stats.pendingCount} count)
      - Overdue Invoices: ${stats.overdueAmount} (${stats.overdueCount} count)
      
      Monthly Revenue Trend:
      ${JSON.stringify(revenueData)}
      
      Please provide a concise financial insight report (max 150 words). 
      Cover:
      1. Revenue Trend (Growing/Declining?)
      2. Cash Flow Health (High pending/overdue?)
      3. One actionable tip to improve cash flow.
      
      Keep the tone professional yet encouraging.
    `
    const text = await generateText(prompt)
    return { text }
  } catch (error: any) {
    console.error("Gemini Error:", error)
    return { error: `AI Error: ${error.message}` }
  }
}

export interface ForecastResult {
  cashFlowPrediction?: string
  riskScore?: number
  riskLevel?: 'low' | 'medium' | 'high'
  recommendations?: string[]
  error?: string
}

/**
 * Financial forecasting. Gemini analyses overdue/pending invoices and monthly
 * revenue and returns a structured cash-flow prediction, risk score, and
 * recommendations. Output is coerced to JSON for reliable persistence.
 */
export async function generateForecastText(input: {
  overdueAmount: number
  overdueCount: number
  pendingAmount: number
  pendingCount: number
  monthlyRevenue: { month: string; revenue: number }[]
  currency?: string
}): Promise<ForecastResult> {
  try {
    const prompt = `
      You are a financial analyst for a small business. Analyse the data and
      respond with ONLY a valid JSON object (no markdown, no code fences).

      Data (currency ${input.currency || 'USD'}):
      - Overdue invoices: ${input.overdueAmount} across ${input.overdueCount} invoices
      - Pending invoices: ${input.pendingAmount} across ${input.pendingCount} invoices
      - Monthly revenue trend: ${JSON.stringify(input.monthlyRevenue)}

      Required JSON shape:
      {
        "cashFlowPrediction": "<2-3 sentence forecast of next 1-3 months cash flow>",
        "riskScore": <integer 0-100, higher = more financial risk>,
        "riskLevel": "<low | medium | high>",
        "recommendations": ["<actionable tip>", "<actionable tip>", "<actionable tip>"]
      }
    `
    const raw = await generateText(prompt)
    // Robustly extract the JSON object even if the model adds prose/code fences.
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : cleaned)
    return {
      cashFlowPrediction: String(parsed.cashFlowPrediction || ''),
      riskScore: Number(parsed.riskScore ?? 50),
      riskLevel: ['low', 'medium', 'high'].includes(parsed.riskLevel) ? parsed.riskLevel : 'medium',
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String) : [],
    }
  } catch (error: any) {
    console.error('Gemini Forecast Error:', error)
    return { error: `AI Error: ${error.message}` }
  }
}

export async function generatePaymentReminderText(invoice: any, clientName: string) {
  try {
    const daysOverdue = Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 3600 * 24))
    
    const prompt = `
      You are an assistant helping freelancers politely request overdue payments.
      
      Context:
      - Client Name: ${clientName}
      - Invoice Number: ${invoice.invoice_number}
      - Total Amount: ${invoice.total}
      - Due Date: ${new Date(invoice.due_date).toLocaleDateString()}
      - Days Overdue: ${daysOverdue > 0 ? daysOverdue : 0} days
      
      Task:
      Write a short, polite, professional, and non-aggressive email reminder. 
      It should assume the client simply forgot.
      
      Output:
      Subject: [Subject Line]
      
      [Body of the email]
    `
    const text = await generateText(prompt)
    return { text }
  } catch (error: any) {
    console.error("Gemini Error:", error)
    return { error: `AI Error: ${error.message}` }
  }
}
