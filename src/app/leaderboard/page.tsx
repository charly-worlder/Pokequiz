import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { LeaderboardCard } from '@/components/leaderboard/leaderboard-card'
import { getLeaderboard } from '@/lib/leaderboard/queries'

/**
 * spec.md AC-23 — die Seite gehört in keinen Suchindex.
 *
 * Der **wirksame** Schutz ist die Umleitung weiter unten: Ein nicht angemeldeter
 * Aufruf sieht nie einen Trainernamen, ein Crawler also auch nicht. Diese
 * Anweisung ist die ausdrückliche Aussage dazu — sie kostet nichts und überlebt,
 * falls jemand später am Routen-Schutz baut.
 */
export const metadata: Metadata = {
  title: 'Weltrangliste',
  robots: { index: false, follow: false },
}

/**
 * Die Weltrangliste (spec.md AC-11 bis AC-15, AC-23; EC-8).
 *
 * **Kein Zwischenspeicher, ausdrücklich** (AC-11): kein `use cache`, kein
 * `unstable_cache`, kein `revalidate`, kein `force-static`. Die Seite ist ohnehin
 * pro Anfrage gerendert, weil `getLeaderboard()` die Sitzung aus den Cookies
 * liest — aber eine später hinzugefügte Zeile würde das lautlos umkehren, und der
 * Schaden fiele erst dem Spieler auf, der nach seiner Rekordrunde eine Liste ohne
 * sich selbst sieht.
 *
 * Der Rahmen kommt unverändert aus dem Wurzel-Layout (`PageFrame`, PROJ-2) — hier
 * entsteht **keine** zweite Kopfzeile und keine eigene Navigation (AC-15). Der
 * Seitentitel steht im Inhaltsbereich, wie es `docs/app-shell.md` →
 * Seiten-Muster für jeden Screen festlegt.
 */
export default async function LeaderboardPage() {
  const result = await getLeaderboard()

  // Die zweite, unabhängige Schranke neben `src/proxy.ts` (AC-13, EC-8).
  // `getLeaderboard()` prüft die Sitzung, **bevor** es Daten holt — es sind also
  // gar keine fremden Trainernamen im Spiel, wenn es hierher kommt.
  if (result.status === 'unauthenticated') redirect('/login')

  /**
   * Trägt die Karte den Knopf schon selbst?
   *
   * Der Leerzustand aus AC-17 enthält „Runde starten" als Primär-Button — dort
   * ist er die einzige sinnvolle Handlung und gehört mitten in die leere Fläche.
   * Stünde der Knopf unten trotzdem noch einmal, sähe der Spieler zwei
   * identische Primär-Aktionen untereinander. AC-14 ist in diesem Fall durch den
   * Knopf der Karte erfüllt: Verlangt ist, dass die Aktion **auf der Seite**
   * steht, nicht dass sie an einer bestimmten Stelle steht.
   */
  const cardCarriesTheAction = result.status === 'ok' && result.entries.length === 0

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

      <LeaderboardCard result={result} />

      {/*
        AC-14 — „Runde starten" ist die Primär-Aktion der Seite, unabhängig davon,
        ob der Spieler aus einer Runde kam oder direkt hierher navigiert ist. Das
        wichtigste Erfolgskriterium des PRD ist die zweite Runde; die Rangliste
        beantwortet „wo stehe ich", und die Antwort darauf muss unter der Liste
        stehen, nicht zwei Klicks entfernt.

        Der Knopf verlinkt auf `/` und startet die Runde nicht selbst: Der
        Rundenstart ist ein serverseitiger Vorgang mit eigenem Zustand und gehört
        PROJ-2. Ihn von hier aus fernzusteuern hieße, in ein fremdes Feature
        hineinzuschreiben.
      */}
      {!cardCarriesTheAction && (
        <div className="flex justify-center py-8">
          <Button asChild size="lg" className="min-h-12 px-8 text-[17px]">
            <Link href="/">Runde starten</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
