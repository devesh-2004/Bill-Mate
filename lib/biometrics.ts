// Biometric unlock helper. No-op on Web — the plugin is loaded via dynamic
// import() ONLY on Capacitor native, so the web bundle and SSR never touch
// native code. Supabase auth is NOT modified: the session persists as normal;
// biometrics only gate access to the UI on launch.
import { Capacitor } from "@capacitor/core"

// Keychain (iOS) / Keystore (Android) entry holding the user's explicit choice.
const PREF_SERVER = "com.devesh.billmate.biometric"

export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

// Loaded only inside the native webview, on demand.
async function plugin() {
  return await import("@capgo/capacitor-native-biometric")
}

/** Biometric hardware present AND enrolled on this device. */
export async function biometricSupported(): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { NativeBiometric } = await plugin()
    const r = await NativeBiometric.isAvailable()
    return !!r.isAvailable
  } catch {
    return false
  }
}

/** Face ID / Touch ID / Fingerprint label for the UI. */
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
      case BiometryType.FACE_AUTHENTICATION:
        return "Face Unlock"
      case BiometryType.IRIS_AUTHENTICATION:
        return "Iris"
      default:
        return "Biometrics"
    }
  } catch {
    return "Biometrics"
  }
}

/**
 * ON BY DEFAULT on native when hardware is available. Only an explicit "off"
 * choice (stored in the Keychain/Keystore) disables it.
 */
export async function biometricEnabled(): Promise<boolean> {
  if (!(await biometricSupported())) return false
  try {
    const { NativeBiometric } = await plugin()
    const pref = await NativeBiometric.getCredentials({ server: PREF_SERVER })
    return pref?.password !== "off"
  } catch {
    return true // no explicit choice stored yet → default ON
  }
}

/** Persist the user's choice in hardware-backed secure storage. */
export async function setBiometricEnabled(on: boolean): Promise<void> {
  if (!isNative()) return
  try {
    const { NativeBiometric } = await plugin()
    try {
      await NativeBiometric.deleteCredentials({ server: PREF_SERVER })
    } catch {
      /* nothing stored yet */
    }
    await NativeBiometric.setCredentials({
      username: "billmate",
      password: on ? "on" : "off",
      server: PREF_SERVER,
    })
  } catch {
    /* ignore */
  }
}

/** Prompt Face ID / Touch ID / Fingerprint. Resolves ok on Web (no gate). */
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
