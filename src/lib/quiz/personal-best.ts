import type { PersonalBest } from './run-actions'

/**
 * spec.md AC-8 — „besser" heißt: höhere Serie, bei Gleichstand kürzere Zeit.
 *
 * **Bewusst keine Server-Action-Datei.** Alles, was aus einer solchen exportiert
 * wird, muss eine asynchrone Funktion sein und wird zu einem öffentlichen
 * Endpunkt; ein reiner Vergleich ist beides nicht. Er liegt hier, weil das
 * Rundenende seit BUG-119 an zwei Stellen entstehen kann — beim Urteil
 * (`run-actions.ts`) und beim erschöpften Vorrat (`question-action.ts`).
 */
export function isBetterThan(
  streak: number,
  durationMs: number,
  previous: PersonalBest | null
): boolean {
  if (!previous) return true
  if (streak > previous.streak) return true
  return streak === previous.streak && durationMs < previous.durationMs
}
