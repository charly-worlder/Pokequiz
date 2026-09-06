import 'server-only'
import { createResponseNeutralClient } from '@/lib/supabase/server'
import { RESET_CONFIRMATION_MESSAGE, type ActionState } from '@/lib/auth/error-mapping'

/**
 * Die **eine** Stelle, an der die Antwort auf eine Passwort-Reset-Anfrage entsteht
 * (spec.md AC-10, EC-3).
 *
 * **Warum es diese Datei gibt — BUG-87.** Der erste Anlauf hat nur den
 * *Rückgabewert* vereinheitlicht: `mapPasswordResetRequestError` gab für jeden
 * Fehler dieselbe Bestätigung zurück, und zwei Tests bewachten das. Die
 * **HTTP-Antwort** war trotzdem unterscheidbar, weil sie aus mehr besteht als
 * diesem Wert. Liefert Supabase einen 429 — was nur passiert, wenn tatsächlich
 * eine Mail hinausginge, also nur bei einem existierenden Konto —, löscht
 * `@supabase/ssr` die PKCE-`code-verifier`-Cookies, und dieser Schreibvorgang
 * lief über den Cookie-Adapter in **dieselbe Antwort**. Gemessen: 30 von 30
 * Adressen korrekt bestimmt, 4,13 Adressen pro Sekunde — schneller als das
 * Orakel, das der Fix beseitigen sollte.
 *
 * **Deshalb wird hier die ganze Antwort normalisiert, nicht ein Kanal.** Eine
 * HTTP-Antwort kann auf drei Wegen verraten, was intern geschah, und alle drei
 * sind hier geschlossen:
 *
 * 1. **Rückgabewert** — immer `RESET_REQUEST_RESPONSE`, dasselbe Objekt, egal was
 *    passiert ist.
 * 2. **Geworfener Fehler** → anderer Status-Code. Wird verschluckt; ein Fehler
 *    beim Versand ist für den Anfragenden nicht von einem Erfolg zu unterscheiden.
 * 3. **Cookies** — der Client kann keine schreiben (`createResponseNeutralClient`).
 *
 * **Der Preis, benannt:** Ein echter Ausfall des Mailversands sieht für den Nutzer
 * aus wie ein Erfolg. Das ist auf diesem Pfad unvermeidlich — jede
 * Unterscheidbarkeit ist zugleich ein Existenz-Orakel, weil ein Versand nur für
 * existierende Konten überhaupt versucht wird. Die App-eigene Drosselung meldet
 * sich davor und ist gefahrlos, weil sie **jede** Adresse zählt (AC-17, AC-19).
 *
 * **Bewacht wird das an der ausgehenden Antwort**, nicht an dieser Funktion:
 * `tests/PROJ-1-reset-response.spec.ts` vergleicht Status und **alle**
 * `Set-Cookie`-Kopfzeilen zwischen existierender und erfundener Adresse. Ein Test
 * auf diese Funktion allein hätte BUG-87 nicht gefunden — genau das war der
 * Fehler beim ersten Anlauf.
 */
export const RESET_REQUEST_RESPONSE: ActionState = { message: RESET_CONFIRMATION_MESSAGE }

export async function requestPasswordResetIdentically(
  email: string,
  redirectTo: string
): Promise<ActionState> {
  try {
    const supabase = await createResponseNeutralClient()
    await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  } catch {
    // Absichtlich verschluckt: siehe Punkt 2 oben. Ein Fehler darf sich hier
    // nicht als abweichende Antwort zeigen.
  }

  return RESET_REQUEST_RESPONSE
}
