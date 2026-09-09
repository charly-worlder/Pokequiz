'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'

/**
 * spec.md EC-6 — der Fehler erscheint **innerhalb** der Karte, nie ganzseitig;
 * Kopf- und Fußzeile bleiben stehen (`docs/app-shell.md` → Fehlerzustand).
 *
 * **Warum das die einzige clientseitige Komponente dieses Features ist.** Die
 * ganze Rangliste rendert auf dem Server. Nur „Erneut versuchen" braucht einen
 * Klick — und `router.refresh()` lässt genau die Serverseite neu laufen, ohne
 * die Seite komplett neu zu laden. Ein voller Reload täte es auch, würfe aber
 * die Scrollposition weg und ließe die Kopfzeile flackern.
 *
 * Der Versuch ist **unbegrenzt** oft möglich: Ein Datenbank- oder Netzwerkfehler
 * ist von außen verursacht und kann beim nächsten Mal weg sein. Eine Obergrenze
 * hätte hier nichts zu schützen.
 */
export function LeaderboardErrorCard() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [refreshing, setRefreshing] = useState(false)

  function retry() {
    setRefreshing(true)
    startTransition(() => {
      router.refresh()
      setRefreshing(false)
    })
  }

  const busy = pending || refreshing

  return (
    <div
      role="alert"
      className="animate-[in_0.4s_ease-out] flex flex-col items-center gap-5 py-10 text-center"
    >
      <div className="space-y-2">
        <h2 className="text-[21px] font-bold tracking-[-0.02em]">
          Die Rangliste lädt gerade nicht
        </h2>
        <p className="mx-auto max-w-[40ch] text-[15px] text-muted-foreground text-pretty">
          Die Bestenliste konnte nicht abgerufen werden. An deinen gespeicherten Runden ändert das
          nichts — sie sind da und zählen weiter.
        </p>
      </div>

      <Button onClick={retry} disabled={busy} className="min-h-11">
        {busy ? 'Wird versucht …' : 'Erneut versuchen'}
      </Button>
    </div>
  )
}
