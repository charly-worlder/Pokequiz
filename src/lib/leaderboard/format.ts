/**
 * Darstellung der beiden Zahlen, die die Rangliste selbst berechnet.
 *
 * Bewusst eine eigene Datei und **nicht** die Formatierung aus
 * `src/components/quiz/status-bar.tsx`: Dort steht `m:ss` ohne Zehntel, hier
 * verlangt spec.md AC-1 ausdrücklich `mm:ss,s`. Der Grund ist kein Geschmack —
 * die Zeit ist auf der Rangliste der Tie-Breaker und muss die Unterscheidung
 * zeigen, die sie trifft. Derselbe Lauf steht dadurch im Ergebnis-Screen als
 * `1:23` und hier als `01:23,4`; das ist als Open Question in `spec.md`
 * festgehalten, damit es eine Entscheidung bleibt und kein Versehen wird.
 */

/**
 * Millisekunden → `mm:ss,s` (AC-1).
 *
 * Minuten und Sekunden zweistellig, ein Zehntel nach dem **Komma** — deutsches
 * Dezimalzeichen, das Produkt spricht durchgehend Deutsch.
 *
 * Gerundet wird auf das nächste Zehntel, nicht abgeschnitten: Abschneiden zeigte
 * eine Zeit, die besser ist als die gelaufene. Sortiert wird ohnehin auf
 * Millisekunden (die Datenbank tut das), zwei gleich dargestellte Zeiten haben
 * also trotzdem eine feste Reihenfolge.
 *
 * Über 99 Minuten wächst das Feld auf drei Stellen, statt zu überlaufen. Eine
 * Runde dauert das nicht — aber eine abgeschnittene Zahl wäre schlimmer als eine
 * breite.
 */
export function formatLeaderboardDuration(ms: number): string {
  const tenths = Math.round(Math.max(0, ms) / 100)

  const minutes = Math.floor(tenths / 600)
  const seconds = Math.floor((tenths % 600) / 10)
  const tenth = tenths % 10

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${tenth}`
}

/** Ab hier zählt die Liste — Plätze 1 bis 5 (AC-1, AC-7). */
export const TOP_RANKS = 5

/**
 * Wie viele Plätze fehlen bis in die Top-5 (AC-7, EC-2).
 *
 * Platz 6 ergibt 1, Platz 12 ergibt 7. Für einen Platz innerhalb der Top-5 gibt
 * es nichts aufzuholen — dann ist das Ergebnis 0, und die Anzeige zeigt die
 * Zeile aus AC-7 gar nicht erst (AC-8).
 */
export function ranksToTopFive(rank: number): number {
  return Math.max(0, rank - TOP_RANKS)
}
