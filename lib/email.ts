/**
 * Email sending via SMTP (e.g. the organization's Gmail using an App Password).
 * Configure with env vars; if they're absent the call is simulated (logged) so
 * the worker never crashes in dev.
 *
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=org@gmail.com
 *   SMTP_PASS=<gmail app password>
 *   SMTP_FROM=org@gmail.com        (optional, defaults to SMTP_USER)
 */
export interface EmailInput {
  to: string
  subject: string
  text: string
  html?: string
  /** Display name for the From header, e.g. the workspace/org name. */
  fromName?: string
}

export async function sendEmail(input: EmailInput): Promise<{ sent?: boolean; simulated?: boolean; error?: string }> {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user

  if (!host || !user || !pass) {
    console.log(`[email:simulated] to=${input.to} subject="${input.subject}" (set SMTP_* to send for real)`)
    return { simulated: true }
  }

  try {
    const nodemailer = (await import('nodemailer')).default
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    })
    await transporter.sendMail({
      from: input.fromName ? `"${input.fromName}" <${from}>` : from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    })
    return { sent: true }
  } catch (e: any) {
    console.error('sendEmail failed:', e.message)
    return { error: e.message }
  }
}
