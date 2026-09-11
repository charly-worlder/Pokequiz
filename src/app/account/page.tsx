import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AccountDataCard } from '@/components/account/account-data-card'
import { DangerZoneCard } from '@/components/account/danger-zone-card'
import { getAccountData } from '@/lib/account/queries'

/**
 * spec.md AC-4 — die Seite gehört in keinen Suchindex.
 *
 * Der **wirksame** Schutz ist die Umleitung weiter unten: Ein nicht angemeldeter
 * Aufruf sieht nie eine E-Mail-Adresse, ein Crawler also auch nicht. Diese
 * Anweisung ist die ausdrückliche Aussage dazu — sie kostet nichts und überlebt,
 * falls jemand später am Routen-Schutz baut. Dasselbe Muster wie bei
 * `/leaderboard` (PROJ-3, AC-23).
 */
export const metadata: Metadata = {
  title: 'Dein Konto',
  robots: { index: false, follow: false },
}

/**
 * Der Kontobereich (spec.md AC-2 bis AC-8, AC-19).
 *
 * Der Rahmen kommt unverändert aus dem Wurzel-Layout (`PageFrame`, PROJ-2) —
 * hier entsteht **keine** zweite Kopfzeile und keine eigene Navigation (AC-5).
 * Der Seitentitel steht im Inhaltsbereich, wie `docs/app-shell.md` →
 * Seiten-Muster es für jeden Screen festlegt.
 *
 * **Kein Ladezustand-Skelett und keine `loading.tsx`**, anders als bei der
 * Rangliste: Diese Seite liest drei kleine Zeilen der eigenen Sitzung, es gibt
 * kein externes Bild und keine Wartezeit, gegen die ein Skelett schützen müsste.
 */
export default async function AccountPage() {
  const result = await getAccountData()

  // Zweite, unabhängige Schranke neben `src/proxy.ts` (AC-4). `getAccountData()`
  // prüft die Sitzung, **bevor** es Daten holt.
  if (result.status === 'unauthenticated') redirect('/login')

  return (
    <div className="mx-auto w-full max-w-2xl px-[clamp(18px,4vw,44px)] py-[clamp(12px,1.8vw,22px)]">
      <header className="py-6">
        <h1 className="text-[clamp(28px,3.4vw,40px)] font-bold tracking-[-0.03em] text-balance">
          Dein Konto
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground text-pretty">
          Was über dich gespeichert ist — und der Weg, es loszuwerden.
        </p>
      </header>

      {result.status === 'error' ? (
        /*
          Der Fehler bleibt **innerhalb** des Inhaltsbereichs; Kopf- und Fußzeile
          stehen (docs/app-shell.md → Seiten-Muster). Der Gefahrenbereich wird
          dabei bewusst **nicht** angezeigt: Wer nicht sehen kann, was gespeichert
          ist, soll es nicht in diesem Moment löschen.
        */
        <div className="rounded-card border border-border bg-card p-6">
          <p className="font-medium">Deine Kontodaten konnten nicht geladen werden.</p>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Bitte lade die Seite neu. Dein Konto ist davon unberührt.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <AccountDataCard data={result.data} />
          <DangerZoneCard />
        </div>
      )}
    </div>
  )
}
