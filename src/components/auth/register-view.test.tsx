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
