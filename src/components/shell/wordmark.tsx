import { cn } from '@/lib/utils'

/**
 * The Pokéball motif is drawn in CSS — gradient, centre line, circle — and is
 * deliberately not an official logo. docs/design-system.md: no official Pokémon
 * logos, lettering or artwork; this is a fan quiz and has to stay visibly so.
 */
export function BallMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-block size-7 shrink-0 rounded-full',
        'bg-[linear-gradient(180deg,hsl(var(--primary))_0_49%,hsl(var(--foreground))_49%_53%,hsl(var(--card))_53%_100%)]',
        'shadow-[0_4px_14px_-8px_rgb(23_28_44_/_0.4)]',
        className
      )}
    >
      <span className="absolute left-1/2 top-1/2 size-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-card" />
    </span>
  )
}

/**
 * Wortmarke: Ball-Motiv plus Schriftzug (spec.md AC-21).
 *
 * **Unter 400 px bleibt nur das Ball-Motiv** (spec.md AC-24, AC-43;
 * `docs/app-shell.md` → Layout-Regionen). Der Grund ist Platz, und er ist
 * nachgerechnet: Sobald die Kopfzeile den Bestenlisten-Zugang trägt, braucht sie
 * 375 px. Bei 320 px fehlen also 55, und reines Enger-Setzen von Polstern,
 * Abständen und Knöpfen bringt nur 52 — ohne jede Reserve. Der Schriftzug allein
 * bringt 75.
 *
 * **Warum die Marke weicht und kein Knopf.** Ein Schriftzug trägt keine Handlung.
 * „Bestenliste" und „Abmelden" behalten deshalb in jeder Stufe ihre Beschriftung;
 * ein unbeschrifteter Symbol-Knopf träfe ausgerechnet die Zielgruppe, die laut
 * `docs/PRD.md` auch Kinder einschließt. Es ist zudem dieselbe Reduktionslogik,
 * die die Kopfzeile schon für den Nutzer-Chip benutzt (unter 640 px nur die
 * Initiale), also kein neues Muster.
 *
 * Das Ball-Motiv bleibt dabei der Link auf die Startseite; die unsichtbare
 * Beschriftung dafür hängt am Link in `site-header.tsx`, nicht hier. Für einen
 * Nutzer mit Screenreader ändert sich durch die Reduktion nichts.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BallMark />
      {/* `hidden` entfernt das Element aus dem Layout — der Flex-Abstand zum
          Ball entfällt damit von selbst, es bleibt kein Loch stehen. */}
      <span className="text-[17px] font-extrabold tracking-[-0.02em] text-foreground max-[400px]:hidden">
        Pokémon{' '}
        <span className="font-extrabold tracking-[0.14em] text-[13px] text-muted-foreground">
          QUIZ
        </span>
      </span>
    </span>
  )
}
