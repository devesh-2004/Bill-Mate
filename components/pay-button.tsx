"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CreditCard } from "lucide-react"
import { createRazorpayOrder, verifyInvoicePayment } from "@/app/dashboard/[workspaceSlug]/invoices/razorpay-actions"

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js"

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false)
    if ((window as any).Razorpay) return resolve(true)
    const script = document.createElement("script")
    script.src = CHECKOUT_SRC
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export function PayButton({ workspaceSlug, invoiceId }: { workspaceSlug: string; invoiceId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function pay() {
    setPending(true); setError("")

    const ok = await loadRazorpay()
    if (!ok) { setError("Could not load Razorpay. Check your connection."); setPending(false); return }

    const order = await createRazorpayOrder(workspaceSlug, invoiceId)
    if ("error" in order || !order.orderId) {
      setError((order as any).error || "Could not start payment."); setPending(false); return
    }

    const rzp = new (window as any).Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "BillMate",
      description: `Invoice ${order.invoiceNumber}`,
      order_id: order.orderId,
      prefill: order.prefill,
      theme: { color: "#6366f1" },
      handler: async (resp: any) => {
        const res = await verifyInvoicePayment(workspaceSlug, {
          invoiceId,
          razorpay_order_id: resp.razorpay_order_id,
          razorpay_payment_id: resp.razorpay_payment_id,
          razorpay_signature: resp.razorpay_signature,
        })
        if (res?.error) { setError(res.error); return }
        router.refresh()
      },
      modal: { ondismiss: () => setPending(false) },
    })
    rzp.on("payment.failed", (resp: any) => {
      setError(resp?.error?.description || "Payment failed.")
      setPending(false)
    })
    rzp.open()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={pay} disabled={pending}>
        <CreditCard className="mr-2 h-4 w-4" /> {pending ? "Processing…" : "Pay with Razorpay"}
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
