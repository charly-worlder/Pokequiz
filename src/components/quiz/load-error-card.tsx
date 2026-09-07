'use client'

import { Button } from '@/components/ui/button'

/**
 * spec.md AC-16 — shown *inside* the quiz card, never as a full-page error, so
 * the running streak is not visually thrown away (docs/app-shell.md →
 * Seiten-Muster → Fehlerzustand).
 *
 * The streak stays untouched and the clock stands still while this is visible
 * (quiz-screen owns both). „Erneut versuchen" is unlimited (AC-17); „Runde
 * beenden" scores the round as it stands (AC-18).
 */
export function LoadErrorCard({
  streak,
  retrying,
  message,
  onRetry,
  onEndRound,
}: {
  streak: number
  retrying: boolean
  /**
   * Abweichender Grund, falls die Frage nicht am Laden liegt — etwa eine Runde,
   * die in einem anderen Tab weiterlief (spec.md EC-15). Ohne Angabe steht hier
   * der Ausfall der Datenquelle (AC-16).
   */
  message?: string | null
  onRetry: () => void
  onEndRound: () => void
}) {
  return (
    <div
      role="alert"
      className="animate-[in_0.4s_ease-out] flex flex-col items-center gap-5 rounded-[var(--radius-card-value)] border border-border bg-card px-6 py-10 text-center"
    >
      <div className="space-y-2">
        <h2 className="text-[21px] font-bold tracking-[-0.02em]">
          {message ? 'Diese Runde ist nicht mehr offen' : 'Die nächste Frage lädt gerade nicht'}
        </h2>
        <p className="mx-auto max-w-[40ch] text-[15px] text-muted-foreground text-pretty">
          {message ?? (
            <>
              Die Pokémon-Datenquelle antwortet nicht. Deine Serie von{' '}
              <span className="tabular font-semibold text-foreground">{streak}</span> bleibt
              erhalten, und die Uhr steht so lange still.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onRetry} disabled={retrying} className="min-h-11">
          {retrying ? 'Wird versucht …' : 'Erneut versuchen'}
        </Button>
        <Button variant="outline" onClick={onEndRound} className="min-h-11">
          Runde beenden
        </Button>
      </div>
    </div>
  )
}
