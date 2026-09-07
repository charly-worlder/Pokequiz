'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LEADERBOARD_PAGE_EXISTS } from '@/lib/site-pages'
import { formatDuration } from './status-bar'

/**
 * spec.md AC-7 — Serie, Zeit, „Nochmal spielen" (primär) und „Zur Bestenliste".
 * AC-8 — der Bestleistungs-Hinweis mit `pop`.
 * EC-2 — ein geleerter Pool endet mit einer Gewinner-Meldung statt einer Niederlage.
 *
 * **Die angezeigte Zeit ist die servergemessene** (AC-34), nicht der Stand der
 * Anzeigeuhr aus der laufenden Runde. Die beiden dürfen um die Netzlatenz
 * auseinanderliegen (EC-13); maßgeblich und gespeichert ist diese hier.
 *
 * **Kein Speichern-Zustand mehr, seit dem 2026-09-06.** Die Runde ist
 * geschrieben, bevor dieser Bildschirm überhaupt erscheint (AC-35) — ein
 * Ergebnis, das hier steht, ist gespeichert. Ging die Antwort des Servers
 * unterwegs verloren, holt `quiz-screen` das Ergebnis über die Runden-Kennung
 * nach (EC-3); erst dann kommt es hier an.
 */
export function ResultView({
  streak,
  durationMs,
  poolCleared,
  isPersonalBest,
  onPlayAgain,
}: {
  streak: number
  durationMs: number
  poolCleared: boolean
  isPersonalBest: boolean
  onPlayAgain: () => void
}) {
  return (
    <div className="animate-[in_0.4s_ease-out] flex flex-col items-center gap-6 py-10 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {poolCleared ? 'Alle Pokémon geschafft' : 'Runde beendet'}
      </p>

      {poolCleared && (
        <p className="max-w-[42ch] text-[18px] font-semibold text-pretty text-foreground">
          Du hast jedes Pokémon aus dem Pool richtig erkannt. Mehr geht nicht.
        </p>
      )}

      <div>
        <p
          className="tabular text-[clamp(64px,9vw,104px)] font-bold leading-none tracking-[-0.05em] text-primary"
          aria-live="polite"
        >
          {streak}
        </p>
        <p className="mt-2 text-[15px] text-muted-foreground">
          richtige Antworten in <span className="tabular font-semibold text-foreground">{formatDuration(durationMs)}</span>
        </p>
      </div>

      {isPersonalBest && (
        <p className="animate-[pop_0.28s_ease-out] rounded-full border border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.15)] px-5 py-2 text-[15px] font-bold text-foreground">
          Neue persönliche Bestleistung
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" onClick={onPlayAgain} className="min-h-12 px-8 text-[17px]">
          Nochmal spielen
        </Button>
        {/* AC-7: die sekundäre Aktion erscheint erst, wenn PROJ-3 die Seite
            gebaut hat — bis dahin wäre sie ein toter Link. */}
        {LEADERBOARD_PAGE_EXISTS && (
          <Button asChild variant="outline" size="lg" className="min-h-12">
            <Link href="/leaderboard">Zur Bestenliste</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
