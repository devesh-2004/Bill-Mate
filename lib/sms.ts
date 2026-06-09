/**
 * SMS sending via Twilio. Configure with env vars; if absent the call is
 * simulated (logged) so the worker never crashes in dev.
 *
 *   TWILIO_ACCOUNT_SID=ACxxxx
 *   TWILIO_AUTH_TOKEN=xxxx
 *   TWILIO_FROM=+1xxxxxxxxxx       (your Twilio number)
 *
 * Numbers should be E.164 (e.g. +14155552671). A best-effort normaliser is
 * applied; configure DEFAULT_SMS_COUNTRY_CODE (e.g. +91) for local numbers.
 */
export interface SmsInput {
  to: string
  body: string
}

function normalize(num: string): string | null {
  const trimmed = (num || '').trim()
  if (!trimmed) return null
  if (trimmed.startsWith('+')) return trimmed.replace(/[^\d+]/g, '')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null
  const cc = process.env.DEFAULT_SMS_COUNTRY_CODE || ''
  return cc ? `${cc}${digits}` : `+${digits}`
}

export async function sendSms(input: SmsInput): Promise<{ sent?: boolean; simulated?: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM
  const to = normalize(input.to)

  if (!to) return { error: 'Missing/invalid destination number' }

  if (!sid || !token || !from) {
    console.log(`[sms:simulated] to=${to} body="${input.body}" (set TWILIO_* to send for real)`)
    return { simulated: true }
  }

  try {
    const twilio = (await import('twilio')).default
    const client = twilio(sid, token)
    await client.messages.create({ from, to, body: input.body })
    return { sent: true }
  } catch (e: any) {
    console.error('sendSms failed:', e.message)
    return { error: e.message }
  }
}
