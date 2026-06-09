import { NextResponse } from 'next/server'
import { verifyWebhookSignature, RAZORPAY_WEBHOOK_SECRET } from '@/lib/razorpay'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notifications'

// Razorpay needs the raw request body to verify the signature.
export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!RAZORPAY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 500 })
  }

  const body = await req.text()
  const signature = req.headers.get('x-razorpay-signature') || ''
  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  let event: any
  try { event = JSON.parse(body) } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const supabase = createAdminClient()

  // Razorpay does not send a stable event id, so we derive one from the payment
  // entity to dedupe retries: "<event>:<payment_id>".
  const payment = event?.payload?.payment?.entity
  const eventId = `${event?.event || 'unknown'}:${payment?.id || event?.created_at || ''}`

  const { error: dupeError } = await supabase
    .from('razorpay_events')
    .insert({ id: eventId, type: event?.event, payload: event })
  if (dupeError) {
    if (dupeError.code === '23505') return NextResponse.json({ received: true, duplicate: true })
    console.error('Failed to record razorpay event:', dupeError.message)
  }

  try {
    // Both events signify a successful collection; reconcile the same way.
    if ((event.event === 'payment.captured' || event.event === 'order.paid') && payment) {
      const orderId = payment.order_id
      if (!orderId) return NextResponse.json({ received: true })

      // Locate the invoice via the order id we stored at checkout, or via notes.
      let invoiceId: string | undefined
      let workspaceId: string | undefined

      const { data: invoice } = await supabase
        .from('invoices').select('id, workspace_id, invoice_number')
        .eq('razorpay_order_id', orderId).maybeSingle()

      if (invoice) {
        invoiceId = invoice.id; workspaceId = invoice.workspace_id
      } else {
        // Fall back to order notes (set when the order was created).
        invoiceId = payment.notes?.invoice_id
        workspaceId = payment.notes?.workspace_id
      }
      if (!invoiceId || !workspaceId) return NextResponse.json({ received: true })

      const amount = (payment.amount ?? 0) / 100

      await supabase.from('invoices').update({
        status: 'Paid', paid_at: new Date().toISOString(), amount_paid: amount,
      }).eq('id', invoiceId).eq('workspace_id', workspaceId)

      const { error: payErr } = await supabase.from('payments').insert({
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        amount,
        payment_method: 'Razorpay',
        status: 'succeeded',
        razorpay_order_id: orderId,
        razorpay_payment_id: payment.id,
        reference_number: payment.id,
      })
      // Ignore duplicate payment (client callback may have inserted it first).
      if (payErr && payErr.code !== '23505') console.error('payment insert:', payErr.message)

      await supabase.from('activity_logs').insert({
        workspace_id: workspaceId,
        entity_type: 'payment',
        entity_id: invoiceId,
        action: 'payment_received',
        metadata: { amount, source: 'razorpay', payment_id: payment.id },
      })
      await createNotification(supabase, {
        workspace_id: workspaceId,
        type: 'payment',
        title: 'Payment received',
        body: `Invoice ${invoice?.invoice_number || ''} was paid (${amount}).`,
        entity_type: 'invoice',
        entity_id: invoiceId,
      })
    }
  } catch (err: any) {
    console.error('Razorpay webhook handler error:', err.message)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
