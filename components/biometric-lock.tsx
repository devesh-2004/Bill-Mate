"use client"

import { useEffect, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { Fingerprint } from "lucide-react"
import { Button } from "@/components/ui/button"
import { biometricEnabled, verifyBiometric } from "@/lib/biometrics"

// Full-screen gate shown on native app launch when biometrics are enabled.
// - Web: renders nothing (Capacitor.isNativePlatform() === false) → app unchanged.
// - Native + not enabled: renders nothing → normal flow.
// - Native + enabled: covers the dashboard until Face ID / Touch ID / Fingerprint
//   succeeds; failure shows a retry button (fallback).
export function BiometricLock() {
  // null = still checking (native), false = unlocked / not applicable, true = locked
  const [locked, setLocked] = useState<boolean | null>(
    typeof window !== "undefined" && Capacitor.isNativePlatform() ? null : false
  )
  const [error, setError] = useState<string | null>(null)

  async function attempt() {
    setError(null)
    const r = await verifyBiometric()
    if (r.ok) setLocked(false)
    else setError(r.error || "Verification failed.")
  }

  useEffect(() => {
    let active = true
    if (!Capacitor.isNativePlatform()) {
      setLocked(false)
      return
    }
    ;(async () => {
      const enabled = await biometricEnabled()
      if (!active) return
      if (!enabled) {
        setLocked(false)
        return
      }
      setLocked(true)
      const r = await verifyBiometric() // auto-prompt on launch
      if (!active) return
      if (r.ok) setLocked(false)
      else setError(r.error || "Verification failed.")
    })()
    return () => {
      active = false
    }
  }, [])

  if (locked === false) return null

  // While checking on native, cover the screen to avoid a flash of the dashboard.
  if (locked === null) {
    return <div className="fixed inset-0 z-[100000] bg-background" />
  }

  return (
    <div className="fixed inset-0 z-[100000] flex flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10">
        <Fingerprint className="h-10 w-10 text-indigo-500" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold text-foreground">BillMate is locked</p>
        <p className="text-sm text-muted-foreground">Verify your identity to continue.</p>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button onClick={attempt} className="bg-indigo-500 hover:bg-indigo-600 text-white">
        Unlock
      </Button>
    </div>
  )
}
