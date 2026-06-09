'use server'

import { createClient } from '@/lib/supabase/server'
import { findWorkspace } from '@/lib/workspace'
import { getRazorpay, RAZORPAY_KEY_ID, verifyPaymentSignature } from '@/lib/razorpay'
import { createNotification } from '@/lib/notifications'
import { revalidatePath } from 'next/cache'

/**
 * Creates a Razorpay Order for an invoice and returns the fields the client
 * needs to open the Checkout modal. Payment is confirmed via verifyInvoicePayment
 * (client callback) and/or the /api/razorpay/webhook (authoritative).
 */
export async function createRazorpayOrder(workspaceSlug: string, invoiceId: string) {
  const supabase = await createClient()
  const workspace = await findWorkspace(supabase, workspaceSlug)
  if (!workspace) return { error: 'No workspace found.' }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, clients(name, email, billing_email)')
    .eq('id', invoiceId)
    .eq('workspace_id', workspace.id)
    .single()
  if (!invoice) return { error: 'Invoice not found.' }
  if (invoice.status === 'Paid') return { error: 'Invoice is already paid.' }

  const amountPaise = Math.round(Number(invoice.total) * 100)
  if (amountPaise <= 0) return { error: 'Invoice total must be greater than zero.' }

  try {
    const razorpay = getRazorpay()
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: (invoice.currency || 'INR').toUpperCase(),
      receipt: `inv_${invoice.invoice_number}`.slice(0, 40),
      notes: {
        invoice_id: invoiceId,
        workspace_id: workspace.id,
        invoice_number: invoice.invoice_number,
      },
    })

    await supabase.from('invoices').update({ razorpay_order_id: order.id }).eq('id', invoiceId)

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
      invoiceNumber: invoice.invoice_number,
      prefill: {
        name: invoice.clients?.name || '',
        email: invoice.clients?.billing_email || invoice.clients?.email || '',
      },
    }
  } catch (e: any) {
    console.error('Razorpay order error:', e?.error?.description || e.message)
    return { error: e?.error?.description || e.message }
  }
}

/**
 * Verifies the Checkout callback signature and marks the invoice paid.
 * Idempotent with the webhook: both paths converge on the same payment record
 * (deduped by the unique razorpay_payment_id index).
 */
export async function verifyInvoicePayment(workspaceSlug: string, params: {
  invoiceId: string
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}) {
  const supabase = await createClient()
  const workspace = await findWorkspace(supabase, workspaceSlug)
  if (!workspace) return { error: 'No workspace found.' }

  const valid = verifyPaymentSignature(params.razorpay_order_id, params.razorpay_payment_id, params.razorpay_signature)
  if (!valid) return { error: 'Payment signature verification failed.' }

  const { data: invoice } = await supabase
    .from('invoices').select('id, invoice_number, total')
    .eq('id', params.invoiceId).eq('workspace_id', workspace.id).single()
  if (!invoice) return { error: 'Invoice not found.' }

  const amount = Number(invoice.total)

  await supabase.from('invoices').update({
    status: 'Paid', paid_at: new Date().toISOString(), amount_paid: amount,
  }).eq('id', invoice.id).eq('workspace_id', workspace.id)

  // Upsert-style: ignore duplicate if the webhook already inserted this payment.
  const { error: payErr } = await supabase.from('payments').insert({
    workspace_id: workspace.id,
    invoice_id: invoice.id,
    amount,
    payment_method: 'Razorpay',
    status: 'succeeded',
    razorpay_order_id: params.razorpay_order_id,
    razorpay_payment_id: params.razorpay_payment_id,
    reference_number: params.razorpay_payment_id,
  })
  if (payErr && payErr.code !== '23505') return { error: payErr.message }

  await supabase.from('activity_logs').insert({
    workspace_id: workspace.id,
    entity_type: 'payment',
    entity_id: invoice.id,
    action: 'payment_received',
    metadata: { amount, source: 'razorpay', payment_id: params.razorpay_payment_id },
  })
  await createNotification(supabase, {
    workspace_id: workspace.id,
    type: 'payment',
    title: 'Payment received',
    body: `Invoice ${invoice.invoice_number} was paid (${amount}).`,
    entity_type: 'invoice',
    entity_id: invoice.id,
  })

  revalidatePath(`/dashboard/${workspaceSlug}/invoices/${invoice.id}`)
  return { success: true }
}
