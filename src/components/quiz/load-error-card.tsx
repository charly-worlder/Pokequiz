'use client'

import { Button } from '@/components/ui/button'

/**
 * spec.md AC-16 — shown *inside* the quiz card, never as a full-page error, so
 * the running streak is not visually thrown away (docs/app-shell.md →
 * Seiten-Muster → Fehlerzustand).
 *
 * The streak stays untouched and the displayed clock stands still while this is
 * visible (quiz-screen owns both). „Erneut versuchen" is unlimited (AC-17);
 * „Runde beenden" scores the round as it stands (AC-18).
 *
 * **Warum diese Karte drei Sorten kennt (BUG-121, BUG-134, BUG-135).** Sie war
 * für genau einen Fall gebaut — „die nächste Frage lädt nicht" — und wurde
 * nach und nach für zwei weitere benutzt, ohne es zu sagen: für eine Runde, die
 * anderswo weiterlief, und für einen Start, der gar nicht zustande kam. In
 * beiden führten ihre zwei Knöpfe in dieselbe Karte zurück; der einzige Ausweg
 * war Neuladen. Jetzt entscheidet die Sorte über Überschrift **und** Ausweg.
 */
export type LoadErrorKind =
  /** Ein Bild kam nicht — die Runde läuft weiter und ist fortsetzbar (AC-16, AC-17). */
  | 'question'
  /** Die Runde lief anderswo weiter und ist gegenstandslos (EC-15, AC-36). */
  | 'stale-round'
  /** Es gibt keine Runde: der Start selbst ist gescheitert (BUG-134). */
  | 'no-round'

export function LoadErrorCard({
  kind,
  streak,
  retrying,
  timeKeepsRunning,
  onRetry,
  onEndRound,
  onStartNewRound,
}: {
  kind: LoadErrorKind
  streak: number
  retrying: boolean
  /**
   * Läuft die **servergemessene** Zeit gerade weiter (spec.md AC-34)?
   *
   * Sie tut das genau dann, wenn serverseitig noch eine Frage offen ist — also
   * wenn das Bild der **angezeigten** Frage nicht kam. Liegt keine Frage offen
   * (die nächste ließ sich nicht laden), zählt der Server nichts.
   *
   * Die Karte behauptete bis zum 2026-09-07 in beiden Fällen, die Uhr stehe
   * still (BUG-113). Das stimmte nur im zweiten. Die angezeigte Uhr pausiert
   * ohnehin immer — hier geht es um die Zeit, die am Ende gewertet wird.
   */
  timeKeepsRunning: boolean
  onRetry: () => void
  onEndRound: () => void
  /** Der Ausweg aus einem Endzustand: eine frische Runde (EC-15, BUG-135). */
  onStartNewRound: () => void
}) {
  return (
    <div
      role="alert"
      className="animate-[in_0.4s_ease-out] flex flex-col items-center gap-5 rounded-[var(--radius-card-value)] border border-border bg-card px-6 py-10 text-center"
    >
      <div className="space-y-2">
        <h2 className="text-[21px] font-bold tracking-[-0.02em]">
          {kind === 'stale-round'
            ? 'Diese Runde ist nicht mehr offen'
            : kind === 'no-round'
              ? 'Die Runde konnte nicht gestartet werden'
              : // BUG-121 — die Überschrift sagt jetzt dasselbe wie der Text
                // darunter: Eine Frage, die schon auf dem Bildschirm steht, ist
                // nicht „die nächste".
                timeKeepsRunning
                ? 'Das Bild dieser Frage lädt nicht'
                : 'Die nächste Frage lädt gerade nicht'}
        </h2>
        <p className="mx-auto max-w-[40ch] text-[15px] text-muted-foreground text-pretty">
          {kind === 'stale-round' ? (
            <>
              Diese Runde lief auf einem anderen Gerät oder in einem anderen Tab weiter. Ihr Stand
              zählt hier nicht mehr.
            </>
          ) : kind === 'no-round' ? (
            <>Die Pokémon-Datenquelle antwortet gerade nicht. Es wurde noch keine Runde gestartet.</>
          ) : timeKeepsRunning ? (
            <>
              Das Bild dieser Frage lädt nicht. Deine Serie von{' '}
              <span className="tabular font-semibold text-foreground">{streak}</span> bleibt
              erhalten — die Frage ist aber weiter offen, ihre Zeit läuft also mit.
            </>
          ) : (
            <>
              Die Pokémon-Datenquelle antwortet nicht. Deine Serie von{' '}
              <span className="tabular font-semibold text-foreground">{streak}</span> bleibt
              erhalten, und die Uhr steht so lange still.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {kind === 'stale-round' ? (
          // Nur ein Weg, und er führt aus dem Zustand heraus. „Erneut versuchen"
          // hätte hier nichts zu versuchen: Die Runde gibt es nicht mehr.
          <Button onClick={onStartNewRound} className="min-h-11">
            Neue Runde starten
          </Button>
        ) : (
          <>
            <Button onClick={onRetry} disabled={retrying} className="min-h-11">
              {retrying ? 'Wird versucht …' : 'Erneut versuchen'}
            </Button>
            {/* Zu beenden gibt es nur etwas, wenn eine Runde läuft. */}
            {kind === 'question' && (
              <Button variant="outline" onClick={onEndRound} className="min-h-11">
                Runde beenden
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
