import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SiteFooter } from './site-footer'

/**
 * Die beiden Rechts-Links in der Fußzeile (PROJ-2, spec.md AC-23).
 *
 * **Warum es diesen Test gibt.** Die Regel „kein Link auf eine Seite, die es
 * nicht gibt" hat dieses Projekt dreimal gebrochen (Fußzeile, Kopfzeile,
 * Ergebnis-Screen — siehe `src/lib/site-pages.ts`), und die Fußzeile hat sie
 * anschließend so gründlich befolgt, dass sie **gar keine** Links mehr zeigte:
 * `LEGAL_PAGES` blieb bis zum 2026-09-10 leer, obwohl die Fußzeile laut
 * `docs/app-shell.md` genau dafür existiert. Ein Impressum, das von keiner Seite
 * aus erreichbar ist, ist nach DDG § 5 selbst ein Mangel — der Fehler in dieser
 * Richtung fällt nur niemandem auf, weil nichts kaputtgeht.
 *
 * Deshalb prüft der Test **beide Hälften**: dass die Links da sind und wohin sie
 * zeigen. Rot gesehen am 2026-09-10, indem `LEGAL_PAGES` wieder geleert wurde —
 * dann fällt er mit „Unable to find role=link" statt still durchzulaufen.
 *
 * Was er ausdrücklich **nicht** leistet: Er sagt nichts darüber, ob die beiden
 * Seiten existieren oder was auf ihnen steht. Sie stehen bewusst außerhalb des
 * Spec-Zyklus (`features/INDEX.md` → „Zuschnitt von PROJ-4"); ihr Inhalt bleibt
 * Handarbeit.
 */
describe('SiteFooter — die Rechts-Links (AC-23)', () => {
  it('führt zur Datenschutzerklärung', () => {
    render(<SiteFooter />)

    expect(screen.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/privacy')
  })

  it('führt zum Impressum', () => {
    render(<SiteFooter />)

    expect(screen.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/imprint')
  })

  it('fasst beide unter einer benannten Navigation zusammen', () => {
    render(<SiteFooter />)

    const nav = screen.getByRole('navigation', { name: 'Rechtliches' })
    expect(nav).toBeInTheDocument()
  })
})
