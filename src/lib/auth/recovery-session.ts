import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Ist die aktuelle Sitzung aus einem **Passwort-Reset-Link** entstanden — und
 * nicht aus einem gewöhnlichen Login? (BUG-91, `design.md` → Behaviors & Access:
 * „nur mit gültiger Recovery-Sitzung".)
 *
 * **Warum es diese Prüfung braucht.** `getUser()` beantwortet nur, *ob* jemand
 * angemeldet ist, nicht *wie*. Bis zum 2026-09-06 war das die einzige Hürde vor
 * `updateUser({ password })`, und die Folge wurde zur Laufzeit gemessen: Mit einer
 * gewöhnlichen Login-Sitzung ließ sich das Passwort setzen, ohne das alte zu
 * kennen — danach war das alte ungültig und das neue gültig. Wer ein angemeldetes
 * Gerät erreicht, übernahm damit das Konto endgültig, und die Sitzung lebt laut
 * AC-5 bis zum aktiven Abmelden (`Max-Age=34560000`).
 *
 * **Woran es erkennbar ist.** Am `amr`-Anspruch des JWT, gegen die lokale Instanz
 * gemessen: `signInWithPassword` ergibt `amr: [{ method: 'password' }]`,
 * `verifyOtp({ type: 'recovery' })` ergibt `amr: [{ method: 'otp' }]`. Der
 * Anspruch steht **im signierten Token** und ist damit nicht fälschbar — ein
 * selbstgesetztes Merker-Cookie wäre ausgerechnet auf dem geteilten Gerät
 * manipulierbar, gegen das dieser Schutz gerichtet ist.
 *
 * **Die Grenze, ausgeschrieben:** `otp` deckt bei Supabase auch Magic Link und
 * E-Mail-OTP ab. Diese App hat beides nicht — `spec.md` kennt ausschließlich
 * Passwort-Login (AC-4) und Passwort-Reset (AC-10 ff.). Käme je einer dieser Wege
 * dazu, muss diese Prüfung enger werden; dann trägt `otp` allein nicht mehr.
 */
export async function hasRecoverySession(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.auth.getClaims()

  // `amr` ist je nach Ausgabe des Auth-Dienstes eine Liste aus Objekten oder aus
  // blanken Zeichenketten — der Typ von `supabase-js` lässt beides zu. Beide
  // Formen werden auf den Methodennamen heruntergebrochen, statt sich auf eine
  // festzulegen.
  const methods = (data?.claims?.amr ?? []).map((entry) =>
    typeof entry === 'string' ? entry : entry.method
  )

  return methods.includes('otp')
}
