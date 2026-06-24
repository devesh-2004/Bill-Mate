"use client"

import { useEffect, useState } from "react"
import { Fingerprint, ShieldCheck, ShieldAlert, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  isNative,
  biometricSupported,
  biometricEnabled,
  biometryLabel,
  setBiometricEnabled,
} from "@/lib/biometrics"

type Phase = "loading" | "web" | "unsupported" | "ready"

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/60 backdrop-blur-xl p-5">
      {children}
    </div>
  )
}

export function BiometricSettings() {
  const [phase, setPhase] = useState<Phase>("loading")
  const [enabled, setEnabled] = useState(true)
  const [label, setLabel] = useState("Biometrics")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!isNative()) {
        if (active) setPhase("web")
        return
      }
      const supported = await biometricSupported()
      if (!active) return
      if (!supported) {
        setPhase("unsupported")
        return
      }
      setLabel(await biometryLabel())
      setEnabled(await biometricEnabled())
      if (active) setPhase("ready")
    })()
    return () => {
      active = false
    }
  }, [])

  async function toggle() {
    setBusy(true)
    const next = !enabled
    await setBiometricEnabled(next)
    setEnabled(next)
    setBusy(false)
  }

  if (phase === "loading") {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Checking biometric capability…</p>
      </Card>
    )
  }

  if (phase === "web") {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <Smartphone className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">Biometric unlock</p>
            <p className="text-sm text-muted-foreground">
              Available in the BillMate mobile app (Face ID / Touch ID / Fingerprint).
            </p>
          </div>
        </div>
      </Card>
    )
  }

  if (phase === "unsupported") {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          <div>
            <p className="font-medium">Biometric unlock unavailable</p>
            <p className="text-sm text-muted-foreground">
              No biometrics are enrolled on this device. Add Face ID / Touch ID / a
              fingerprint in your device settings to enable app lock.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
            <Fingerprint className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <p className="font-medium">{label} unlock</p>
            <p className="text-sm text-muted-foreground">
              {enabled
                ? "Required each time you open BillMate."
                : `Disabled — the app opens without ${label}.`}
            </p>
          </div>
        </div>
        <Button variant={enabled ? "outline" : "default"} disabled={busy} onClick={toggle}>
          {busy ? "…" : enabled ? "Disable" : "Enable"}
        </Button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        Detected: {label}
      </div>
    </Card>
  )
}
