import { Queue } from 'bullmq'
import IORedis from 'ioredis'

// Redis connection configuration
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
})

// Queues
export const reminderQueue = new Queue('invoice-reminders', { connection })
export const recurringQueue = new Queue('recurring-invoices', { connection })
export const overdueQueue = new Queue('overdue-invoices', { connection })

export async function scheduleReminder(invoiceId: string, delayMs: number) {
  await reminderQueue.add('send-reminder', { invoiceId }, { delay: delayMs })
}

/**
 * Registers the repeatable scheduler that scans for due recurring invoices.
 * Idempotent: BullMQ dedupes repeatable jobs by name + cron pattern.
 * Call once at worker startup.
 */
export async function ensureRecurringScheduler() {
  await recurringQueue.add(
    'scan-due',
    {},
    {
      repeat: { pattern: '0 * * * *' }, // hourly
      jobId: 'recurring-scan',
      removeOnComplete: true,
      removeOnFail: 100,
    }
  )
}

/**
 * Registers the repeatable scan that finds invoices past their due date and
 * sends the customer an SMS + email reminder. Runs hourly.
 */
export async function ensureOverdueScheduler() {
  await overdueQueue.add(
    'scan-overdue',
    {},
    {
      repeat: { pattern: '0 * * * *' }, // hourly
      jobId: 'overdue-scan',
      removeOnComplete: true,
      removeOnFail: 100,
    }
  )
}
