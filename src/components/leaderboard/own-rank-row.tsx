import { LeaderboardRow } from './leaderboard-row'
import { ranksToTopFive } from '@/lib/leaderboard/format'
import type { LeaderboardEntry } from '@/lib/leaderboard/queries'

/**
 * Die eigene Zeile unterhalb der Liste (spec.md AC-7, AC-10; EC-2).
 *
 * Erscheint **nur**, wenn der Spieler nicht in der Top-5 steht — steht er drin,
 * ist seine Zeile dort hervorgehoben und hier gibt es nichts zu zeigen (AC-8).
 * Die Entscheidung darüber trifft die Karte, nicht diese Komponente.
 *
 * **Warum sie `LeaderboardRow` benutzt statt eine eigene Zeile zu bauen:** Sonst
 * stünden Platz, Serie und Zeit hier um ein paar Pixel neben den Spalten der
 * Liste darüber. Das ist genau die Art Abweichung, die niemandem auffällt, der
 * sie gebaut hat, und jedem, der seinen eigenen Rang mit dem fünften vergleicht.
 *
 * Die Trennung nach oben (Abstand plus Linie) ist inhaltlich nötig: Ohne sie
 * liest sich die Zeile wie Platz 6 der Liste, und die Liste hat genau fünf.
 */
export function OwnRankRow({ entry }: { entry: LeaderboardEntry }) {
  const missing = ranksToTopFive(entry.rank)

  return (
    <div className="mt-4 border-t border-border pt-4">
      <ul>
        <LeaderboardRow
          rank={entry.rank}
          trainerName={entry.trainerName}
          streak={entry.streak}
          durationMs={entry.durationMs}
          isSelf
        />
      </ul>

      <p className="px-3 pt-2 text-[13px] text-muted-foreground sm:px-4">
        {/* EC-2 nennt den Wortlaut für Platz 6: „Platz 6 — noch 1 bis Top 5." */}
        Platz <span className="tabular font-semibold text-foreground">{entry.rank}</span> — noch{' '}
        <span className="tabular font-semibold text-foreground">{missing}</span>{' '}
        {missing === 1 ? 'Platz' : 'Plätze'} bis Top 5
      </p>
    </div>
  )
}
