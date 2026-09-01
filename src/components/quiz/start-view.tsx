'use client'

import { Button } from '@/components/ui/button'
import { BallMark } from '@/components/shell/wordmark'
import { formatDuration } from './status-bar'
import type { PersonalBest } from '@/lib/quiz/run-actions'

/**
 * spec.md AC-1 — the start screen: wordmark motif, one sentence of rules,
 * „Runde starten" as the primary action, and the personal best when there is
 * one. The button locks itself the moment it is pressed (spec.md EC-9).
 */
export function StartView({
  personalBest,
  starting,
  onStart,
}: {
  personalBest: PersonalBest | null
  starting: boolean
  onStart: () => void
}) {
  return (
    <div className="animate-[in_0.4s_ease-out] flex flex-col items-center gap-6 py-10 text-center">
      <BallMark className="size-16 animate-[float_4.5s_ease-in-out_infinite]" />

      <div className="space-y-3">
        <h1 className="text-[clamp(28px,3.4vw,40px)] font-bold tracking-[-0.03em] text-balance">
          Erkennst du sie am Bild?
        </h1>
        <p className="mx-auto max-w-[42ch] text-[17px] text-muted-foreground text-pretty">
          Wähle den richtigen <strong className="font-semibold text-foreground">deutschen</strong>{' '}
          Namen aus vier Optionen. Jede richtige Antwort verlängert deine Serie — ein Fehler beendet
          den Lauf.
        </p>
      </div>

      {personalBest && (
        <div className="rounded-[var(--radius-card-value)] border border-border bg-card px-6 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Deine Bestleistung
          </p>
          <p className="tabular mt-1 text-[21px] font-bold tracking-[-0.02em] text-foreground">
            Serie {personalBest.streak}
            <span className="mx-2 text-muted-foreground">·</span>
            {formatDuration(personalBest.durationMs)}
          </p>
        </div>
      )}

      <Button size="lg" onClick={onStart} disabled={starting} className="min-h-12 px-8 text-[17px]">
        {starting ? 'Runde wird vorbereitet …' : 'Runde starten'}
      </Button>
    </div>
  )
}
