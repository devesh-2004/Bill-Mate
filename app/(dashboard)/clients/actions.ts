'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
})

export async function createClientAction(prevState: any, formData: FormData) {
  const supabase = await createClient()
  
  const rawData = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string,
    address: formData.get('address') as string,
  }

  const validated = clientSchema.safeParse(rawData)

  if (!validated.success) {
    return { error: 'Invalid inputs', errors: validated.error.flatten().fieldErrors }
  }

  const { error } = await supabase.from('clients').insert(rawData)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clients')
  redirect('/clients')
}

export async function updateClientAction(id: string, prevState: any, formData: FormData) {
  const supabase = await createClient()
  
  const rawData = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string,
    address: formData.get('address') as string,
  }

  const validated = clientSchema.safeParse(rawData)

  if (!validated.success) {
    return { error: 'Invalid inputs', errors: validated.error.flatten().fieldErrors }
  }

  const { error } = await supabase.from('clients').update(rawData).eq('id', id)

  if (error) {
     return { error: error.message }
  }

  revalidatePath('/clients')
  redirect('/clients')
}

export async function deleteClientAction(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('clients').delete().eq('id', id)
    
    if (error) {
        return { error: error.message }
    }
    
    revalidatePath('/clients')
}

export async function getClientRiskStats(clientId: string) {
  const supabase = await createClient()
  
  // Fetch paid invoices for this client to calculate risk
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('due_date, paid_at')
    .eq('client_id', clientId)
    .eq('status', 'Paid')
    .not('paid_at', 'is', null)

  if (error) {
    console.error("Error fetching risk stats:", error)
    return null
  }

  if (!invoices || invoices.length === 0) {
    return {
      riskLevel: 'Unknown',
      avgDelay: 0,
      totalInvoices: 0,
      lateRate: 0
    }
  }

  let totalDelay = 0
  let lateCount = 0

  invoices.forEach(inv => {
    const due = new Date(inv.due_date).getTime()
    const paid = new Date(inv.paid_at).getTime()
    const diffDays = (paid - due) / (1000 * 3600 * 24)
    
    // Only count positive delay (late payment)
    if (diffDays > 0) {
        totalDelay += diffDays
        lateCount++
    }
  })

  const avgDelay = totalDelay / invoices.length
  const lateRate = (lateCount / invoices.length) * 100

  let riskLevel = 'Low'
  if (avgDelay > 7) riskLevel = 'High'
  else if (avgDelay > 2) riskLevel = 'Medium'

  return {
    riskLevel,
    avgDelay: Math.round(avgDelay * 10) / 10,
    totalInvoices: invoices.length,
    lateRate: Math.round(lateRate)
  }
}
