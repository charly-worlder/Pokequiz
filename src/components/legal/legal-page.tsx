import type { ReactNode } from 'react'

/**
 * Der gemeinsame Rahmen der beiden Rechtstexte (`/privacy`, `/imprint`).
 *
 * **Diese beiden Seiten haben bewusst keinen Spec-Zyklus** — festgehalten in
 * `features/INDEX.md` → „Zuschnitt von PROJ-4". Sie sind statisch, öffentlich,
 * ohne Anmeldung und ohne Datenbankzugriff; es gibt hier nichts, was ein
 * AC → Task → Test-Zyklus absichern würde. Der Preis steht in derselben Zeile:
 * Ihre Übereinstimmung mit dem, was PROJ-4 tatsächlich baut, ist **Handarbeit**
 * und beim nächsten `/audit` zu prüfen.
 *
 * Der Rahmen kommt unverändert aus dem Wurzel-Layout (`PageFrame`, PROJ-2) —
 * hier entsteht **keine** zweite Kopfzeile und keine eigene Navigation. Der
 * Seitentitel steht im Inhaltsbereich (`docs/app-shell.md` → Seiten-Muster).
 */
export function LegalPage({
  title,
  lead,
  children,
}: {
  title: string
  lead: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-[clamp(18px,4vw,44px)] py-[clamp(12px,1.8vw,22px)]">
      <header className="py-6">
        <h1 className="text-[clamp(28px,3.4vw,40px)] font-bold tracking-[-0.03em] text-balance">
          {title}
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground text-pretty">{lead}</p>
      </header>

      <div className="space-y-6">{children}</div>
    </div>
  )
}

/**
 * Der Hinweis, dass diese Seite Platzhalter trägt.
 *
 * **Er steht ganz oben und ist nicht dezent** — bewusst. Ein unvollständiges
 * Impressum ist nach DDG abmahnfähig und eine Datenschutzerklärung mit
 * Platzhaltern erfüllt Art. 13 DSGVO nicht; wer diese Seite im Betrieb sieht,
 * soll das sofort erkennen und nicht erst beim dritten Absatz. Entscheidung vom
 * 2026-09-09: Die Anschrift bleibt ungenannt, solange die App nicht live geht
 * (`features/INDEX.md` → Deploy-Blocker).
 */
export function PlaceholderNotice() {
  return (
    <div
      role="note"
      className="rounded-card border-2 border-accent bg-accent/15 p-5 text-[15px]"
    >
      <p className="font-semibold">Diese Seite ist noch nicht vollständig.</p>
      <p className="mt-1 text-pretty">
        Die <Placeholder>gelb markierten Stellen</Placeholder> sind Platzhalter. Die
        Anwendung ist nicht öffentlich in Betrieb; die fehlenden Angaben werden vor
        einem Livegang eingesetzt.
      </p>
    </div>
  )
}

/** Eine einzelne, sichtbar markierte Leerstelle im Fließtext. */
export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded bg-accent/40 px-1 py-0.5 text-accent-foreground">{children}</mark>
  )
}

/** Ein Abschnitt als Karte — dieselbe Fläche wie überall sonst in der App. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-card p-6">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-pretty">{children}</div>
    </section>
  )
}
