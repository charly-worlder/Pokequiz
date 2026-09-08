import { LeaderboardSkeleton } from '@/components/leaderboard/leaderboard-skeleton'

/**
 * spec.md AC-16 — was zu sehen ist, während die Seite lädt.
 *
 * Next zeigt diese Datei automatisch, solange die Server Component in
 * `page.tsx` auf ihre Daten wartet. Der Rahmen aus dem Wurzel-Layout (Kopfzeile,
 * Fußzeile) steht dabei schon — hier kommt nur der Inhaltsbereich hinein, und
 * zwar in derselben Breite und mit demselben Seitenkopf wie die fertige Seite.
 * Genau deshalb springt beim Eintreffen der Daten nichts.
 */
export default function LeaderboardLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-[clamp(18px,4vw,44px)] py-[clamp(12px,1.8vw,22px)]">
      <header className="py-6">
        <h1 className="text-[clamp(28px,3.4vw,40px)] font-bold tracking-[-0.03em] text-balance">
          Weltrangliste
        </h1>
      </header>

      <section className="rounded-[var(--radius-card-value)] border border-border bg-card px-2 py-5 shadow-[var(--shadow-md)] sm:px-3 sm:py-6">
        <LeaderboardSkeleton />
      </section>
    </div>
  )
}
