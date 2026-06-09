import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { ensureRecurringScheduler, ensureOverdueScheduler, recurringQueue, overdueQueue } from './lib/queue'
import { sendEmail } from './lib/email'
import { sendSms } from './lib/sms'

dotenv.config({ path: '.env.local' })

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function advanceDate(from: Date, frequency: string, interval: number): Date {
  const d = new Date(from)
  switch (frequency) {
    case 'weekly': d.setDate(d.getDate() + 7 * interval); break
    case 'monthly': d.setMonth(d.getMonth() + interval); break
    case 'quarterly': d.setMonth(d.getMonth() + 3 * interval); break
    case 'yearly': d.setFullYear(d.getFullYear() + interval); break
    default: d.setMonth(d.getMonth() + interval)
  }
  return d
}

async function notify(workspaceId: string, payload: {
  type: string; title: string; body?: string; link?: string; entity_type?: string; entity_id?: string
}) {
  await supabase.from('notifications').insert({
    workspace_id: workspaceId,
    user_id: null, // broadcast to all members
    ...payload,
  })
}

/** Generates one invoice from a recurring schedule and advances the schedule. */
async function generateFromSchedule(schedule: any) {
  const issueDate = new Date()
  const dueDate = new Date(issueDate)
  dueDate.setDate(dueDate.getDate() + (schedule.due_days ?? 14))

  const items: any[] = Array.isArray(schedule.line_items) ? schedule.line_items : []
  const subtotal = items.reduce((acc, it) => acc + Number(it.quantity || 0) * Number(it.price || 0), 0)
  const taxRate = Number(schedule.tax_rate || 0)
  const discount = Number(schedule.discount || 0)
  const tax = subtotal * (taxRate / 100)
  const total = Math.max(0, subtotal + tax - discount)

  // Unique invoice number scoped to the workspace.
  const seq = (schedule.occurrences_generated || 0) + 1
  const invoiceNumber = `REC-${schedule.id.slice(0, 8).toUpperCase()}-${String(seq).padStart(4, '0')}`

  const { data: invoice, error } = await supabase.from('invoices').insert({
    workspace_id: schedule.workspace_id,
    client_id: schedule.client_id,
    recurring_invoice_id: schedule.id,
    invoice_number: invoiceNumber,
    status: schedule.auto_send ? 'Pending' : 'Draft',
    subtotal, tax, discount, total,
    currency: schedule.currency || 'USD',
    tax_rate: taxRate,
    notes: schedule.notes,
    terms: schedule.terms,
    issue_date: issueDate.toISOString().slice(0, 10),
    due_date: dueDate.toISOString().slice(0, 10),
  }).select().single()

  if (error || !invoice) {
    console.error(`Failed to generate invoice for schedule ${schedule.id}:`, error?.message)
    return
  }

  if (items.length) {
    await supabase.from('invoice_items').insert(items.map((it) => ({
      invoice_id: invoice.id,
      description: it.description,
      quantity: Number(it.quantity || 1),
      price: Number(it.price || 0),
    })))
  }

  // Advance the schedule.
  const nextRun = advanceDate(new Date(schedule.next_run_at), schedule.frequency, schedule.interval_count || 1)
  const occurrences = seq
  const reachedMax = schedule.max_occurrences && occurrences >= schedule.max_occurrences
  const reachedEnd = schedule.end_date && nextRun > new Date(schedule.end_date)

  await supabase.from('recurring_invoices').update({
    last_run_at: new Date().toISOString(),
    next_run_at: nextRun.toISOString(),
    occurrences_generated: occurrences,
    status: reachedMax || reachedEnd ? 'cancelled' : 'active',
  }).eq('id', schedule.id)

  // Audit + notify (Activity log created for every generated invoice).
  await supabase.from('activity_logs').insert({
    workspace_id: schedule.workspace_id,
    entity_type: 'invoice',
    entity_id: invoice.id,
    action: 'recurring_invoice_generated',
    metadata: { invoice_number: invoiceNumber, recurring_invoice_id: schedule.id, total },
  })
  await notify(schedule.workspace_id, {
    type: 'invoice',
    title: 'Recurring invoice generated',
    body: `${invoiceNumber} for ${total} ${schedule.currency || 'USD'} was created automatically.`,
    entity_type: 'invoice',
    entity_id: invoice.id,
  })

  console.log(`Generated ${invoiceNumber} from schedule ${schedule.id}`)
}

// ----------------------------------------------------------------------------
// Worker: invoice reminders
// ----------------------------------------------------------------------------

const reminderWorker = new Worker('invoice-reminders', async job => {
  if (job.name === 'send-reminder') {
    const { invoiceId } = job.data
    console.log(`Processing reminder for invoice ${invoiceId}`)

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, clients(*)')
      .eq('id', invoiceId)
      .single()

    if (error || !invoice) {
        console.error(`Failed to fetch invoice ${invoiceId}:`, error)
        return
    }
    if (invoice.status === 'Paid') {
        console.log(`Invoice ${invoiceId} is already paid. Skipping reminder.`)
        return
    }

    console.log(`Sending email to ${invoice.clients?.email}...`)
    await supabase.from('invoices')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', invoiceId)

    await supabase.from('activity_logs').insert({
        workspace_id: invoice.workspace_id,
        entity_type: 'invoice',
        entity_id: invoiceId,
        action: 'automated_reminder_sent',
        metadata: { success: true }
    })
    await notify(invoice.workspace_id, {
      type: 'invoice',
      title: 'Reminder sent',
      body: `A payment reminder was sent for invoice ${invoice.invoice_number}.`,
      entity_type: 'invoice',
      entity_id: invoiceId,
    })

    console.log(`Completed reminder for ${invoiceId}`)
  }
}, { connection })

// ----------------------------------------------------------------------------
// Worker: recurring invoices
// ----------------------------------------------------------------------------

const recurringWorker = new Worker('recurring-invoices', async job => {
  if (job.name === 'scan-due') {
    const nowIso = new Date().toISOString()
    const { data: due, error } = await supabase
      .from('recurring_invoices')
      .select('*')
      .eq('status', 'active')
      .lte('next_run_at', nowIso)
      .limit(200)

    if (error) {
      console.error('Failed to scan recurring invoices:', error.message)
      return
    }
    console.log(`Recurring scan: ${due?.length || 0} schedule(s) due.`)
    for (const schedule of due || []) {
      try {
        await generateFromSchedule(schedule)
      } catch (e: any) {
        console.error(`Error generating schedule ${schedule.id}:`, e.message)
      }
    }
  }
}, { connection })

// ----------------------------------------------------------------------------
// Worker: overdue invoices — SMS + email the customer when past due date
// ----------------------------------------------------------------------------

const overdueWorker = new Worker('overdue-invoices', async job => {
  if (job.name !== 'scan-overdue') return

  const today = new Date().toISOString().slice(0, 10)
  // Invoices past due, not paid/cancelled, not yet notified.
  const { data: due, error } = await supabase
    .from('invoices')
    .select('*, clients(name, email, phone)')
    .in('status', ['Pending', 'Overdue'])
    .lt('due_date', today)
    .is('overdue_notified_at', null)
    .limit(200)

  if (error) {
    console.error('Overdue scan failed:', error.message)
    return
  }
  console.log(`Overdue scan: ${due?.length || 0} invoice(s) to notify.`)

  for (const inv of due || []) {
    const client = inv.clients
    // Resolve the org name so the message reads as "from the organization".
    const { data: ws } = await supabase.from('workspaces').select('name').eq('id', inv.workspace_id).single()
    const orgName = ws?.name || 'BillMate'
    const amount = `${inv.currency || ''} ${Number(inv.total).toFixed(2)}`.trim()

    // 1. Flip to Overdue + stamp notified (stamp first so a mid-loop crash
    //    doesn't cause duplicate sends on the next scan).
    await supabase.from('invoices')
      .update({ status: 'Overdue', overdue_notified_at: new Date().toISOString() })
      .eq('id', inv.id)

    // 2. Email the customer.
    let emailRes: any = { skipped: true }
    if (client?.email) {
      emailRes = await sendEmail({
        to: client.email,
        fromName: orgName,
        subject: `Invoice ${inv.invoice_number} is overdue`,
        text:
          `Dear ${client.name || 'Customer'},\n\n` +
          `This is a reminder that invoice ${inv.invoice_number} for ${amount} was due on ` +
          `${inv.due_date} and is now overdue. Please arrange payment at your earliest convenience.\n\n` +
          `Thank you,\n${orgName}`,
      })
    }

    // 3. SMS the customer.
    let smsRes: any = { skipped: true }
    if (client?.phone) {
      smsRes = await sendSms({
        to: client.phone,
        body: `${orgName}: Invoice ${inv.invoice_number} (${amount}) was due on ${inv.due_date} and is overdue. Please pay soon.`,
      })
    }

    // 4. Audit + in-app notification.
    await supabase.from('activity_logs').insert({
      workspace_id: inv.workspace_id,
      entity_type: 'invoice',
      entity_id: inv.id,
      action: 'overdue_notification_sent',
      metadata: { email: emailRes, sms: smsRes, to_email: client?.email || null, to_phone: client?.phone || null },
    })
    await notify(inv.workspace_id, {
      type: 'invoice',
      title: 'Overdue reminder sent',
      body: `${inv.invoice_number} is overdue — notified ${client?.name || 'the client'}` +
            `${client?.email ? ' by email' : ''}${client?.phone ? ' & SMS' : ''}.`,
      entity_type: 'invoice',
      entity_id: inv.id,
    })

    console.log(`Overdue notice sent for ${inv.invoice_number} (email=${!!client?.email}, sms=${!!client?.phone})`)
  }
}, { connection })

reminderWorker.on('completed', job => console.log(`Reminder job ${job.id} completed!`))
reminderWorker.on('failed', (job, err) => console.error(`Reminder job ${job?.id} failed: ${err.message}`))
recurringWorker.on('failed', (job, err) => console.error(`Recurring job ${job?.id} failed: ${err.message}`))
overdueWorker.on('failed', (job, err) => console.error(`Overdue job ${job?.id} failed: ${err.message}`))

// Register the hourly repeatable schedulers on startup.
ensureRecurringScheduler()
  .then(() => console.log("Recurring scheduler registered (hourly scan)."))
  .catch(err => console.error('Failed to register recurring scheduler:', err.message))
ensureOverdueScheduler()
  .then(() => console.log("Overdue scheduler registered (hourly scan)."))
  .catch(err => console.error('Failed to register overdue scheduler:', err.message))

// Also run one scan immediately on startup so changes are picked up without
// waiting for the next hourly tick (useful for testing).
recurringQueue.add('scan-due', {}, { removeOnComplete: true }).catch(() => {})
overdueQueue.add('scan-overdue', {}, { removeOnComplete: true }).catch(() => {})

// Surface provider configuration so it's obvious whether sends are real.
const emailReady = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
const smsReady = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM)
console.log(`Email (SMTP): ${emailReady ? 'configured ✅' : 'NOT configured — will simulate ⚠️ (set SMTP_*)'}`)
console.log(`SMS (Twilio): ${smsReady ? 'configured ✅' : 'NOT configured — will simulate ⚠️ (set TWILIO_*)'}`)
console.log("Worker started. Listening on 'invoice-reminders', 'recurring-invoices' and 'overdue-invoices' queues...")
