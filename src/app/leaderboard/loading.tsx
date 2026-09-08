import { LeaderboardSkeleton } from '@/components/leaderboard/leaderboard-skeleton'
import { LeaderboardPrivacyNote } from '@/components/leaderboard/privacy-note'

/**
 * spec.md AC-16 — was zu sehen ist, während die Seite lädt.
 *
 * Next zeigt diese Datei automatisch, solange die Server Component in `page.tsx`
 * auf ihre Daten wartet. Der Rahmen aus dem Wurzel-Layout (Kopfzeile, Fußzeile)
 * steht dabei schon; hier kommt nur der Inhaltsbereich hinein.
 *
 * **AC-16 Satz 2 verlangt mehr, als „ein Skelett zeigen".** Er verlangt, dass das
 * Layout beim Eintreffen der Daten nicht springt — und dafür muss dieser
 * Ladezustand **strukturgleich** zur fertigen Seite sein, nicht nur ähnlich. Der
 * QA-Lauf vom 2026-09-08 hat drei Unterschiede gefunden, die genau das verletzt
 * haben: Der Untertitel unter der Überschrift fehlte, die Spaltenüberschriften-
 * Zeile fehlte, und der Datenschutz-Satz hatte keine Entsprechung. Alle drei sind
 * **statischer Text** — sie brauchen keine Daten und hatten nie einen Grund zu
 * fehlen.
 *
 * Sie stehen jetzt hier, und zwar als **dieselben Komponenten** wie in
 * `page.tsx`, nicht als Kopien: Eine Kopie wäre die nächste Stelle, an der die
 * beiden auseinanderlaufen. Skelettflächen bleiben nur dort, wo tatsächlich Daten
 * erwartet werden — in den Zeilen.
 */
export default function LeaderboardLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-[clamp(18px,4vw,44px)] py-[clamp(12px,1.8vw,22px)]">
      <header className="py-6">
        <h1 className="text-[clamp(28px,3.4vw,40px)] font-bold tracking-[-0.03em] text-balance">
          Weltrangliste
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground text-pretty">
          Die fünf besten Läufe aller Spieler. Sortiert nach Serie, bei Gleichstand entscheidet die
          Zeit.
        </p>
      </header>

      <section className="rounded-[var(--radius-card-value)] border border-border bg-card px-2 py-5 shadow-[var(--shadow-md)] sm:px-3 sm:py-6">
        <LeaderboardSkeleton />
      </section>

      <LeaderboardPrivacyNote />

      {/*
        Der „Runde starten"-Knopf der fertigen Seite. Er ist auch hier statisch
        und hält damit die Höhe, statt beim Eintreffen der Daten aufzutauchen.
        Bewusst ohne `Link`: Während geladen wird, führt er noch nirgendwohin,
        und ein Knopf, der beim Laden schon klickbar aussieht, ist ein Versprechen
        auf eine Handlung, die es noch nicht gibt.
      */}
      <div className="flex justify-center py-8" aria-hidden>
        <div className="min-h-12 rounded-[var(--radius)] bg-muted px-8 py-3 text-[17px] font-semibold text-transparent">
          Runde starten
        </div>
      </div>
    </div>
  )
}
