"use client"

import { useEffect, useState } from "react"
import { Fingerprint } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  isNative,
  biometricAvailable,
  biometricEnabled,
  biometryLabel,
  enableBiometric,
  disableBiometric,
} from "@/lib/biometrics"

// Enable / Disable biometric unlock. Renders ONLY inside the native app on a
// device with biometrics enrolled; on Web (or unsupported devices) it renders
// nothing, so the settings page is unchanged on the web.
export function BiometricSettings({ username }: { username: string }) {
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [label, setLabel] = useState("Biometrics")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!isNative()) return
      const avail = await biometricAvailable()
      if (!active) return
      setSupported(avail)
      if (avail) {
        setLabel(await biometryLabel())
        setEnabled(await biometricEnabled())
      }
    })()
    return () => {
      active = false
    }
  }, [])

  if (!isNative() || !supported) return null

  async function toggle() {
    setBusy(true)
    setMsg(null)
    if (enabled) {
      await disableBiometric()
      setEnabled(false)
      setMsg(`${label} unlock disabled.`)
    } else {
      const r = await enableBiometric(username)
      if (r.ok) {
        setEnabled(true)
        setMsg(`${label} unlock enabled.`)
      } else {
        setMsg(r.error || "Could not enable biometrics.")
      }
    }
    setBusy(false)
  }

  return (
    <div className="rounded-xl border border-border/40 bg-background/60 backdrop-blur-xl p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
            <Fingerprint className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <p className="font-medium">{label} unlock</p>
            <p className="text-sm text-muted-foreground">
              Require {label} each time you open BillMate.
            </p>
          </div>
        </div>
        <Button
          variant={enabled ? "outline" : "default"}
          disabled={busy}
          onClick={toggle}
        >
          {busy ? "…" : enabled ? "Disable" : "Enable"}
        </Button>
      </div>
      {msg && <p className="mt-3 text-sm text-muted-foreground">{msg}</p>}
    </div>
  )
}
