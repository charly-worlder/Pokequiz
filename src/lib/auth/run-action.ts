import { runClientAction } from '@/lib/actions/run-action'
import { NETWORK_ERROR_MESSAGE, type ActionState } from './error-mapping'

/**
 * Der Auth-Zuschnitt von `runClientAction`: ein Transport-Fehler wird zu einem
 * normalen ActionState mit der Netzwerk-Meldung.
 *
 * Der generische Kern liegt seit dem 2026-09-04 unter `src/lib/actions/` —
 * PROJ-2 hat denselben Fehler ein zweites Mal gebaut, weil der Schutz hier in
 * einem Feature-Ordner lag (qa-report.md PROJ-2, BUG-7). Verhalten unverändert;
 * `run-action.test.ts` gilt weiter.
 */
export async function runAuthAction(call: () => Promise<ActionState>): Promise<ActionState> {
  return runClientAction(call, { error: NETWORK_ERROR_MESSAGE })
}
