import { cn } from '@/lib/utils'
import { formatLeaderboardDuration } from '@/lib/leaderboard/format'

/**
 * Eine Zeile der Weltrangliste (spec.md AC-1, AC-8, AC-10, AC-18; EC-9).
 *
 * **Das Spaltenraster steht hier und nur hier.** `own-rank-row.tsx` baut die
 * abgesetzte eigene Zeile aus genau dieser Komponente, statt das Raster ein
 * zweites Mal zu beschreiben — sonst stünden Platz, Serie und Zeit der eigenen
 * Zeile um ein paar Pixel neben denen der Liste, und das fällt genau dem
 * Spieler auf, der seinen Rang verfolgt.
 *
 * **Warum die drei Zahlenspalten feste Breiten haben und nur der Name nachgibt**
 * (AC-18, EC-9): Ein Trainername darf 20 Zeichen lang sein (Migration 0001). Auf
 * einem 375-px-Bildschirm passt das nicht neben drei Zahlen. Bräche die Zeile
 * um, verlöre die Liste ihre Spalten; scrollte sie waagerecht, wären Serie und
 * Zeit außer Sicht. Also kürzt der Name — er ist das einzige Feld, dessen
 * Verkürzung nichts Zählbares verbirgt, und der vollständige Name hängt als
 * `title` daran.
 *
 * `tabular` (aus `globals.css`, `font-variant-numeric: tabular-nums`) auf allen
 * drei Zahlen — sonst stehen die Spalten schon zwischen zwei Zeilen versetzt.
 */
export function LeaderboardRow({
  rank,
  trainerName,
  streak,
  durationMs,
  isSelf,
}: {
  rank: number
  trainerName: string
  streak: number
  durationMs: number
  isSelf: boolean
}) {
  return (
    <li
      className={cn(
        'grid grid-cols-[2.25rem_minmax(0,1fr)_auto_auto] items-center gap-x-3 rounded-[var(--radius)] px-3 py-3',
        'sm:gap-x-4 sm:px-4',
        // AC-10 — die eigene Zeile ist immer hervorgehoben, in der Liste wie in
        // der abgesetzten Zeile darunter.
        isSelf && 'bg-primary/8 ring-1 ring-primary/25'
      )}
    >
      <span
        className={cn(
          'tabular text-[15px] font-bold tracking-[-0.02em]',
          // Gold ist im Design-System die Belohnungsfarbe und ausdrücklich für
          // „Rang 1" vorgesehen.
          rank === 1 ? 'text-accent' : 'text-muted-foreground'
        )}
      >
        {rank}
      </span>

      <span className="flex min-w-0 items-center gap-2">
        <span
          // `min-w-0` am Elternteil plus `truncate` hier — ohne das Erste kürzt
          // ein Grid-Kind nicht, sondern sprengt seine Spalte.
          className="truncate text-[15px] font-semibold text-foreground"
          title={trainerName}
        >
          {trainerName}
        </span>
        {isSelf && (
          <span className="shrink-0 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:hsl(var(--ring))]">
            Du
          </span>
        )}
      </span>

      <span className="tabular text-right text-[15px] font-bold tracking-[-0.02em] text-foreground">
        {streak}
      </span>

      <span className="tabular w-[5.5rem] text-right text-[15px] text-muted-foreground">
        {formatLeaderboardDuration(durationMs)}
      </span>
    </li>
  )
}

/**
 * Die Spaltenüberschriften. Eigene Komponente, damit sie dasselbe Raster
 * benutzen wie die Zeilen — eine zweite Rasterbeschreibung wäre die nächste
 * Stelle, an der die Spalten auseinanderlaufen.
 *
 * **Warum die Namensspalte unter 400 px „Name" heißt** (gefunden am 2026-09-08
 * bei 320 px): Dort ist die Spalte nur rund 45 px breit, „TRAINER" braucht mit
 * der Laufweite des Design-Systems aber etwa 57. Die Überschrift lief in den
 * Spaltenabstand hinein und berührte „SERIE" — auf dem Bildschirm stand
 * „TRAINERSERIE".
 *
 * **Erwogen und verworfen:** die Zeitspalte schmaler zu machen, um Platz
 * abzugeben. Sie ist nicht großzügig — die breiteste darstellbare Zeit
 * („100:00,0") füllt ihre 88 px exakt aus, gemessen; sie zu kürzen hieße, Daten
 * abzuschneiden statt einer Beschriftung. Ebenfalls verworfen: die Laufweite zu
 * verringern — das brachte 8 px und ließ die Überschrift immer noch abgeschnitten
 * dastehen.
 *
 * „Name" ist kürzer, sagt dasselbe und passt ohne Kürzung. `truncate` bleibt
 * zusätzlich stehen: Es behebt nicht diesen Fall, sondern die Fehlerklasse — eine
 * andere Schrift oder ein Zoomfaktor verschiebt die Rechnung, und dann soll die
 * Überschrift abgeschnitten werden statt in die Nachbarspalte zu laufen.
 *
 * Die Datenzeilen waren nie betroffen — dort kürzt der Name ohnehin (EC-9).
 * Die Zeile ist `aria-hidden`, für einen Screenreader ändert sich also nichts.
 */
export function LeaderboardHeaderRow() {
  return (
    <li
      aria-hidden
      className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto_auto] items-center gap-x-3 px-3 pb-1 sm:gap-x-4 sm:px-4"
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        #
      </span>
      <span className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span className="max-[400px]:hidden">Trainer</span>
        <span className="hidden max-[400px]:inline">Name</span>
      </span>
      <span className="text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Serie
      </span>
      <span className="w-[5.5rem] text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Zeit
      </span>
    </li>
  )
}
