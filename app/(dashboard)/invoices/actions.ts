'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().min(1),
  price: z.coerce.number().min(0),
})

const invoiceSchema = z.object({
  client_id: z.string().uuid(),
  invoice_number: z.string().min(1),
  status: z.enum(['Paid', 'Pending', 'Overdue']),
  due_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date",
  }),
  currency: z.string().default('USD'),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
})

export async function createInvoiceAction(items: any[], prevState: any, formData: FormData) {
  const supabase = await createClient()
  
  const rawData = {
    client_id: formData.get('client_id') as string,
    invoice_number: formData.get('invoice_number') as string,
    status: formData.get('status') as string,
    due_date: formData.get('due_date') as string,
    currency: formData.get('currency') as string,
    tax_rate: formData.get('tax_rate') as string,
  }

  const itemsJson = formData.get('items_json') as string
  let parsedItems = []
  try {
     parsedItems = JSON.parse(itemsJson)
  } catch (e) {
     return { error: "Invalid items data" }
  }

  const validated = invoiceSchema.safeParse(rawData)
  if (!validated.success) {
      return { error: 'Invalid inputs', errors: validated.error.flatten().fieldErrors }
  }

  const taxRate = Number(rawData.tax_rate) || 0
  const subtotal = parsedItems.reduce((acc: number, item: any) => acc + (Number(item.quantity) * Number(item.price)), 0)
  const tax = subtotal * (taxRate / 100)
  const total = subtotal + tax

  // 1. Create Invoice
  const { data: invoice, error: invoiceError } = await supabase.from('invoices').insert({
    ...rawData,
    subtotal,
    tax,
    total
  }).select().single()

  if (invoiceError) {
    return { error: invoiceError.message }
  }

  // 2. Create Items
  const itemsToInsert = parsedItems.map((item: any) => ({
    invoice_id: invoice.id,
    description: item.description,
    quantity: Number(item.quantity),
    price: Number(item.price)
  }))

  const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert)

  if (itemsError) {
    return { error: "Invoice created but items failed: " + itemsError.message }
  }

  // Activity Log
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
      await supabase.from('activity_logs').insert({
          user_id: user.id,
          entity_type: 'invoice',
          entity_id: invoice.id,
          action: 'created',
          metadata: { invoice_number: invoice.invoice_number, total }
      })
  }

  revalidatePath('/invoices')
  redirect('/invoices')
}

export async function updateInvoiceAction(id: string, items: any[], prevState: any, formData: FormData) {
    const supabase = await createClient()
    
    const rawData = {
        client_id: formData.get('client_id') as string,
        invoice_number: formData.get('invoice_number') as string,
        status: formData.get('status') as string,
        due_date: formData.get('due_date') as string,
        currency: formData.get('currency') as string,
        tax_rate: formData.get('tax_rate') as string,
    }

    const itemsJson = formData.get('items_json') as string
    let parsedItems = []
    try {
        parsedItems = JSON.parse(itemsJson)
    } catch (e) {
        return { error: "Invalid items data" }
    }

    const validated = invoiceSchema.safeParse(rawData)
    if (!validated.success) {
        return { error: 'Invalid inputs', errors: validated.error.flatten().fieldErrors }
    }

    const taxRate = Number(rawData.tax_rate) || 0
    const subtotal = parsedItems.reduce((acc: number, item: any) => acc + (Number(item.quantity) * Number(item.price)), 0)
    const tax = subtotal * (taxRate / 100)
    const total = subtotal + tax

    // Update Invoice
    const { error: invoiceError } = await supabase.from('invoices').update({
        ...rawData,
        subtotal,
        tax,
        total
    }).eq('id', id)

    if (invoiceError) return { error: invoiceError.message }

    // Replace Items
    await supabase.from('invoice_items').delete().eq('invoice_id', id)
    
    const itemsToInsert = parsedItems.map((item: any) => ({
        invoice_id: id,
        description: item.description,
        quantity: Number(item.quantity),
        price: Number(item.price)
    }))
    
    const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert)
    if (itemsError) return { error: itemsError.message }
    
    // Activity Log
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        await supabase.from('activity_logs').insert({
            user_id: user.id,
            entity_type: 'invoice',
            entity_id: id,
            action: 'updated',
            metadata: { 
                invoice_number: rawData.invoice_number, 
                status: rawData.status,
                total 
            }
        })
    }
    
    revalidatePath('/invoices')
    redirect('/invoices')
}

export async function deleteInvoiceAction(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) return { error: error.message }

    // Activity Log
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        await supabase.from('activity_logs').insert({
            user_id: user.id,
            entity_type: 'invoice',
            entity_id: id,
            action: 'deleted',
            metadata: { id }
        })
    }

    revalidatePath('/invoices')
}
