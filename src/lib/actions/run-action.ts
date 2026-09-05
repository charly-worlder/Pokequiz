import { unstable_rethrow } from 'next/navigation'

/**
 * Ruft eine Server Action aus einer Client-Komponente auf und macht aus einem
 * *Transport*-Fehler einen normalen Rückgabewert.
 *
 * Die Actions selbst bilden ihre eigenen Fehler bereits auf einen Rückgabewert
 * ab. Was sie nicht melden können, ist ein Aufruf, der nie ankommt — eine
 * abgerissene Verbindung, bevor die Antwort da ist. Ohne diesen Fänger entkommt
 * die Rejection dem Aufrufer: In PROJ-1 riss sie die ganze Seite mit (BUG-1),
 * im Quiz blieb der Ergebnis-Screen auf „gespeichert" stehen, obwohl nichts
 * gespeichert wurde (PROJ-2, BUG-7 → EC-3).
 *
 * `unstable_rethrow` wirft Next.js' eigene Kontrollfluss-Signale zuerst weiter
 * — sonst würde das `redirect()` einer erfolgreichen Action hier verschluckt
 * statt zu navigieren.
 *
 * **Diese Datei ist bewusst feature-neutral.** Der Vorgänger lag unter
 * `src/lib/auth/` und wurde deshalb nur von PROJ-1 benutzt; PROJ-2 baute
 * denselben Fehler ein zweites Mal, weil niemand über die Feature-Grenze sah
 * (qa-report.md PROJ-2, BUG-7). Jeder neue Client-Aufruf einer Server Action
 * gehört hier hindurch.
 */
export async function runClientAction<T>(call: () => Promise<T>, onTransportError: T): Promise<T> {
  try {
    return await call()
  } catch (error) {
    unstable_rethrow(error)
    return onTransportError
  }
}
