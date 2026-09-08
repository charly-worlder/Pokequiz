import { Skeleton } from '@/components/ui/skeleton'

/**
 * spec.md AC-16 — Skelettzeilen in der Höhe der erwarteten Zeilen, **nie ein
 * alleinstehender Spinner** (`docs/app-shell.md` → Ladezustand).
 *
 * Fünf Zeilen plus eine abgesetzte sechste: Fünf ist die volle Liste und damit
 * der häufigste Fall, die sechste ist der Platz der eigenen Zeile. Ein zu kurzes
 * Skelett lässt das Layout beim Eintreffen der Daten genauso springen wie ein zu
 * langes — der Sinn der Sache ist, dass sich nichts bewegt.
 *
 * Die Zeilenhöhe ist bewusst dieselbe wie in `leaderboard-row.tsx`
 * (`py-3` plus die Höhe einer 15-px-Zeile). Ändert sich die dort, gehört sie
 * hier mitgeändert — deshalb steht der Hinweis hier und nicht nur im Design.
 */
function SkeletonRow() {
  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto_auto] items-center gap-x-3 px-3 py-3 sm:gap-x-4 sm:px-4">
      <Skeleton className="h-[15px] w-4" />
      <Skeleton className="h-[15px] w-32 max-w-full" />
      <Skeleton className="h-[15px] w-8" />
      <Skeleton className="h-[15px] w-[5.5rem]" />
    </li>
  )
}

export function LeaderboardSkeleton() {
  return (
    // `aria-busy` statt eines sichtbaren Textes: Wer mit einem Screenreader
    // liest, bekommt gesagt, dass hier geladen wird — die Skelettflächen selbst
    // sagen ihm nichts.
    <div aria-busy="true" aria-label="Weltrangliste wird geladen">
      <ul>
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </ul>
      <div className="mt-4 border-t border-border pt-4">
        <ul>
          <SkeletonRow />
        </ul>
      </div>
    </div>
  )
}
