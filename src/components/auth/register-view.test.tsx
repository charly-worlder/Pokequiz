import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RegisterView } from './register-view'

/**
 * spec.md AC-15 — der Hinweis am Trainername-Feld.
 *
 * Warum das ein Test und kein Sichtprüfung-Punkt ist: Der Hinweis ist die
 * einzige Stelle, an der ein Nutzer erfährt, dass sein Trainername öffentlich
 * und unveränderlich wird. Fällt er bei einem späteren Umbau der Registrierung
 * weg, sieht das Formular völlig normal aus — nichts bricht, niemandem fällt
 * etwas auf, und der Deploy-Blocker aus /dsgvo PROJ-3 ist stillschweigend
 * wieder offen. Genau dafür ist er hier festgenagelt.
 */

const { registerAction, runAuthAction } = vi.hoisted(() => ({
  registerAction: vi.fn(),
  runAuthAction: vi.fn(),
}))

vi.mock('@/lib/auth/actions', () => ({ registerAction }))
vi.mock('@/lib/auth/run-action', () => ({ runAuthAction }))

describe('RegisterView — Hinweis am Trainername-Feld (AC-15)', () => {
  it('zeigt beide Hälften des Hinweises: sichtbar für andere und nicht änderbar', () => {
    render(<RegisterView onSwitchToLogin={() => {}} />)

    const hint = screen.getByText(
      /Dein Trainername ist für alle Spieler auf der Bestenliste sichtbar und kann später nicht mehr geändert werden\./,
    )

    expect(hint).toBeInTheDocument()
  })

  it('ordnet den Hinweis dem Trainername-Feld zu, sodass Screenreader ihn vorlesen', () => {
    render(<RegisterView onSwitchToLogin={() => {}} />)

    const input = screen.getByLabelText('Trainername')
    const describedBy = input.getAttribute('aria-describedby')

    expect(describedBy).toBeTruthy()

    // Der Hinweis muss unter einer der in aria-describedby genannten IDs
    // tatsächlich auffindbar sein — die Zuordnung ist der Punkt, nicht nur
    // die Existenz des Attributs.
    const describedText = describedBy!
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')

    expect(describedText).toContain('für alle Spieler auf der Bestenliste sichtbar')
    expect(describedText).toContain('kann später nicht mehr geändert werden')
  })

  it('verlangt keine Bestätigung: es gibt keine Checkbox im Formular', () => {
    render(<RegisterView onSwitchToLogin={() => {}} />)

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})

/**
 * spec.md AC-14 — der Datenschutz-Hinweis steht immer, der Link erst, wenn die
 * Seite existiert.
 *
 * Vorher zeigte er auf `/privacy` und damit auf eine 404 (BUG-10). Der alte
 * Wortlaut von AC-14 verlangte einen sichtbaren Link, ohne je zu verlangen,
 * dass er irgendwohin führt — der Code erfüllte ihn buchstabengetreu und
 * verfehlte die Absicht.
 *
 * **Am 2026-09-10 hat sich der Test umgedreht**, wie es hier angekündigt war:
 * PROJ-4 hat `/privacy` gebaut, also muss der Link jetzt da sein — und er muss
 * auch **dorthin** zeigen. Beide Hälften werden geprüft, weil genau die zweite
 * bei BUG-10 gefehlt hat.
 */
describe('RegisterView — Datenschutz-Hinweis (AC-14)', () => {
  it('zeigt den Hinweis auf die Datenschutzerklärung', () => {
    render(<RegisterView onSwitchToLogin={() => {}} />)

    expect(screen.getByText(/Datenschutzerklärung/)).toBeInTheDocument()
  })

  it('verlinkt ihn auf /privacy, seit die Seite existiert', () => {
    render(<RegisterView onSwitchToLogin={() => {}} />)

    const link = screen.getByRole('link', { name: 'Datenschutzerklärung' })
    expect(link).toHaveAttribute('href', '/privacy')
  })
})
