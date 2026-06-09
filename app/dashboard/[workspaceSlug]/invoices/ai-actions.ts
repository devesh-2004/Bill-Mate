'use server'

import { generateInvoiceSummaryText } from "@/lib/ai"

export async function generateInvoiceSummary(invoiceDetails: any) {
  return await generateInvoiceSummaryText(invoiceDetails)
}
