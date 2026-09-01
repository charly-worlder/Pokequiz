import { unstable_rethrow } from 'next/navigation'
import { NETWORK_ERROR_MESSAGE, type ActionState } from './error-mapping'

/**
 * Ruft eine Server Action aus einer Client-Komponente auf und macht aus einem
 * *Transport*-Fehler einen normalen ActionState.
 *
 * Die Actions selbst bilden Supabases Fehler bereits auf ActionState ab. Was
 * sie nicht melden können, ist ein Aufruf, der nie ankommt — eine abgerissene
 * Verbindung, bevor die Antwort da ist. Ohne diesen Fänger entkam diese
 * Rejection der Transition und riss die ganze Seite mit (BUG-1, spec.md EC-6).
 *
 * `unstable_rethrow` wirft Next.js' eigene Kontrollfluss-Signale zuerst weiter
 * — sonst würde das `redirect()` einer erfolgreichen Action hier verschluckt
 * statt zu navigieren.
 */
export async function runAuthAction(call: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await call()
  } catch (error) {
    unstable_rethrow(error)
    return { error: NETWORK_ERROR_MESSAGE }
  }
}
