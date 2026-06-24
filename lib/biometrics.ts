// Biometric unlock helper. Everything here is a no-op on Web — the plugin is
// only loaded (via dynamic import) on Capacitor native, so the web bundle and
// SSR are never touched by native code. Supabase auth is NOT modified: the
// Supabase session persists as normal and biometrics only gate access to the UI.
import { Capacitor } from "@capacitor/core"

// Keychain (iOS) / Keystore (Android) entry that marks biometrics as enabled.
const SERVER = "com.devesh.billmate.biometric"

export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

// Loaded only in the native webview, on demand.
async function plugin() {
  const mod = await import("@capgo/capacitor-native-biometric")
  return mod
}

/** Is biometric hardware present and enrolled on this device? */
export async function biometricAvailable(): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { NativeBiometric } = await plugin()
    const r = await NativeBiometric.isAvailable()
    return !!r.isAvailable
  } catch {
    return false
  }
}

/** Has the user opted in (a credential exists in secure storage)? */
export async function biometricEnabled(): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { NativeBiometric } = await plugin()
    const creds = await NativeBiometric.getCredentials({ server: SERVER })
    return !!creds?.username
  } catch {
    return false
  }
}

/** Human label for buttons: Face ID / Touch ID / Fingerprint. */
export async function biometryLabel(): Promise<string> {
  if (!isNative()) return "Biometrics"
  try {
    const { NativeBiometric, BiometryType } = await plugin()
    const r = await NativeBiometric.isAvailable()
    switch (r.biometryType) {
      case BiometryType.FACE_ID:
        return "Face ID"
      case BiometryType.TOUCH_ID:
        return "Touch ID"
      case BiometryType.FINGERPRINT:
        return "Fingerprint"
      default:
        return "Biometrics"
    }
  } catch {
    return "Biometrics"
  }
}

/** Enable: confirm presence, then store a device-bound secret in the Keychain/Keystore. */
export async function enableBiometric(username: string): Promise<{ ok: boolean; error?: string }> {
  if (!isNative()) return { ok: false, error: "Biometrics are only available in the mobile app." }
  try {
    const { NativeBiometric } = await plugin()
    const avail = await NativeBiometric.isAvailable()
    if (!avail.isAvailable) return { ok: false, error: "No biometrics are set up on this device." }
    // Verify the user is present before turning it on.
    await NativeBiometric.verifyIdentity({ reason: "Enable biometric unlock for BillMate", title: "Enable Biometrics" })
    // Store an opaque, device-bound secret in hardware-backed secure storage.
    const token = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
    await NativeBiometric.setCredentials({ username, password: token, server: SERVER })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || "Biometric verification failed." }
  }
}

/** Disable: remove the credential from secure storage. */
export async function disableBiometric(): Promise<void> {
  if (!isNative()) return
  try {
    const { NativeBiometric } = await plugin()
    await NativeBiometric.deleteCredentials({ server: SERVER })
  } catch {
    /* nothing stored — already disabled */
  }
}

/** Prompt for Face ID / Touch ID / Fingerprint. On Web this resolves ok (no gate). */
export async function verifyBiometric(): Promise<{ ok: boolean; error?: string }> {
  if (!isNative()) return { ok: true }
  try {
    const { NativeBiometric } = await plugin()
    await NativeBiometric.verifyIdentity({
      reason: "Unlock BillMate",
      title: "BillMate",
      subtitle: "Verify your identity",
      description: "",
    })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || "Verification failed." }
  }
}
