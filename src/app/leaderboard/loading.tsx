import { Skeleton } from '@/components/ui/skeleton'
import { LeaderboardSkeleton } from '@/components/leaderboard/leaderboard-skeleton'

/**
 * spec.md AC-16 — was zu sehen ist, während die Seite lädt.
 *
 * Next zeigt diese Datei automatisch, solange die Server Component in `page.tsx`
 * auf ihre Daten wartet. Der Rahmen aus dem Wurzel-Layout (Kopfzeile, Fußzeile)
 * steht dabei schon; hier kommt nur der Inhaltsbereich hinein.
 *
 * **Die Regel, die hier zweimal gelernt wurde.** AC-16 Satz 2 verlangt, dass das
 * Layout beim Eintreffen der Daten nicht springt — dafür muss dieser Ladezustand
 * die **Höhen** der fertigen Seite halten. Der erste Anlauf hat daraus
 * geschlossen, er solle den fertigen **Text** zeigen, weil der statisch ist und
 * keine Daten braucht. Das war falsch, und der QA-Lauf hat es gemessen: Im
 * Streaming-Fenster stehen Fallback und Inhalt **gleichzeitig** im DOM, der
 * Datenschutz-Satz erschien dadurch in 3 von 10 Aufrufen doppelt, und der Test
 * für AC-24 wurde rot („resolved to 2 elements").
 *
 * Richtig ist: **Höhe halten, Text nicht wiederholen.** Ein Ladezustand zeigt
 * Platzhalter. Nur die Überschrift bleibt echter Text — sie gehört zum Rahmen
 * der Seite und stand hier schon immer.
 */
export default function LeaderboardLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-[clamp(18px,4vw,44px)] py-[clamp(12px,1.8vw,22px)]">
      <header className="py-6">
        <h1 className="text-[clamp(28px,3.4vw,40px)] font-bold tracking-[-0.03em] text-balance">
          Weltrangliste
        </h1>
        {/* Platzhalter für den Untertitel — zwei Zeilen, wie er auf schmalen
            Bildschirmen umbricht. */}
        <div className="mt-2 space-y-1.5" aria-hidden>
          <Skeleton className="h-[15px] w-full max-w-[34rem]" />
          <Skeleton className="h-[15px] w-2/3 max-w-[22rem]" />
        </div>
      </header>

      <section className="rounded-[var(--radius-card-value)] border border-border bg-card px-2 py-5 shadow-[var(--shadow-md)] sm:px-3 sm:py-6">
        <LeaderboardSkeleton />
      </section>

      {/* Platzhalter für den Datenschutz-Satz aus AC-24. Er steht auf der
          fertigen Seite (`privacy-note.tsx`) und umfasst dort zwei bis drei
          Zeilen; hier hält er nur seine Höhe. */}
      <div className="space-y-1.5 px-3 pt-5 sm:px-4" aria-hidden>
        <Skeleton className="h-[13px] w-full" />
        <Skeleton className="h-[13px] w-11/12" />
      </div>

      {/* Der „Runde starten"-Knopf der fertigen Seite: hält die Höhe, statt beim
          Eintreffen der Daten aufzutauchen. Bewusst ohne Beschriftung und ohne
          Ziel — was noch nirgendwohin führt, soll auch nicht klickbar aussehen. */}
      <div className="flex justify-center py-8" aria-hidden>
        <Skeleton className="h-12 w-48 rounded-[var(--radius)]" />
      </div>
    </div>
  )
}
