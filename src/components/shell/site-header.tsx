import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logoutAction } from '@/lib/auth/actions'
import { LEADERBOARD_PAGE_EXISTS } from '@/lib/site-pages'
import { Button } from '@/components/ui/button'
import { Wordmark } from './wordmark'

/**
 * The app's only navigation (docs/app-shell.md). Rendered by the root layout on
 * every route, so no feature builds a second header. Reads the session itself —
 * PROJ-1 does not render a header, it only provides logoutAction.
 *
 * spec.md AC-21 (signed in), AC-22 (signed out), AC-24 (mobile: no burger).
 */

// spec.md AC-21 — der Zugang zur Bestenliste erscheint erst, wenn es die Seite
// gibt (BUG-23). Der Schalter liegt in `@/lib/site-pages`, weil der
// Ergebnis-Screen dieselbe Bedingung braucht (AC-7) und zwei getrennte Schalter
// genau die Sorte Duplikat sind, bei der einer vergessen wird.
export async function SiteHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let trainerName: string | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('trainer_name')
      .eq('id', user.id)
      .maybeSingle()
    trainerName = data?.trainer_name ?? null
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      {/*
        spec.md AC-43 — ab 320 px scrollt keine Seite waagerecht.
        Unter 400 px greifen engere Maße. Sie sind der **Puffer**, nicht die
        Hauptmaßnahme: Sie bringen zusammen 52 px, gebraucht werden 55 — die
        eigentliche Ersparnis kommt aus der Wortmarke (`wordmark.tsx`).

        Bewusst nur die Kopfzeile: Der Inhaltsbereich der Seiten behält sein
        `clamp(18px,4vw,44px)`, sonst klebten Quizbild und Ranglisten-Karte auf
        schmalen Geräten am Rand.
      */}
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-[clamp(18px,4vw,44px)] max-[400px]:gap-2 max-[400px]:px-[10px]">
        <Link
          href="/"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="Pokémon Quiz — Startseite"
        >
          <Wordmark />
        </Link>

        {user ? (
          <div className="flex items-center gap-2 sm:gap-3 max-[400px]:gap-1.5">
            {LEADERBOARD_PAGE_EXISTS && (
              // `px-2` und 13px unter 400 px: die beiden Untergrenzen aus
              // design.md werden dabei eingehalten — gespart wird ausschließlich
              // waagerecht, die Höhe (36 px) bleibt unangetastet, und 13 px ist
              // die kleinste Größe, die docs/design-system.md für Text zulässt.
              <Button asChild variant="ghost" size="sm" className="max-[400px]:px-2 max-[400px]:text-[13px]">
                <Link href="/leaderboard">Bestenliste</Link>
              </Button>
            )}

            {/* AC-24: below 640px the chip shrinks to the initial — never a
                burger menu, because two items fit in the header either way. */}
            <span className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-1 sm:pr-3">
              <span
                aria-hidden
                className="grid size-7 place-items-center rounded-full bg-secondary text-[13px] font-bold text-secondary-foreground"
              >
                {(trainerName ?? '?').charAt(0).toUpperCase()}
              </span>
              <span className="hidden text-[13px] font-semibold text-foreground sm:inline">
                {trainerName ?? 'Trainer'}
              </span>
            </span>

            <form action={logoutAction}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="max-[400px]:px-2 max-[400px]:text-[13px]"
              >
                Abmelden
              </Button>
            </form>
          </div>
        ) : (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[12px]">
            Deutsche Namen · Serie · Weltrangliste
          </p>
        )}
      </div>
    </header>
  )
}
