import Razorpay from 'razorpay'
import { createHmac } from 'crypto'

let _razorpay: Razorpay | null = null

/**
 * Lazily-initialised Razorpay client. Throws clearly if credentials are absent
 * so misconfiguration surfaces at call time rather than at import time.
 */
export function getRazorpay(): Razorpay {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured.')
  }
  if (!_razorpay) {
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  }
  return _razorpay
}

/** Public key id — safe to expose to the browser for the Checkout modal. */
export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID
export const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET

/**
 * Verifies the signature returned by Razorpay Checkout on the client after a
 * successful payment: HMAC-SHA256(order_id + "|" + payment_id, key_secret).
 */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!process.env.RAZORPAY_KEY_SECRET) return false
  const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')
  return timingSafeEqualHex(expected, signature)
}

/**
 * Verifies a Razorpay webhook signature: HMAC-SHA256(rawBody, webhook_secret),
 * compared against the X-Razorpay-Signature header.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET || !signature) return false
  const expected = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')
  return timingSafeEqualHex(expected, signature)
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}
