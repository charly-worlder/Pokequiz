import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const { actionState } = vi.hoisted(() => ({ actionState: { current: {} as Record<string, unknown> } }))

// `useActionState` wird ersetzt, damit der Dialog mit einem gegebenen
// Ergebniszustand gerendert werden kann — die Action selbst ist in
// `src/lib/account/delete-action.test.ts` geprüft.
vi.mock('react', async () => {
  const react = await vi.importActual<typeof import('react')>('react')
  return {
    ...react,
    useActionState: () => [actionState.current, vi.fn(), false],
  }
})
vi.mock('@/lib/account/delete-action', () => ({ deleteAccountAction: vi.fn() }))

import { DeleteAccountDialog } from './delete-account-dialog'

function open() {
  render(<DeleteAccountDialog />)
  fireEvent.click(screen.getByRole('button', { name: 'Konto löschen' }))
}

beforeEach(() => {
  actionState.current = {}
  vi.clearAllMocks()
})

describe('DeleteAccountDialog', () => {
  it('verlangt das Passwort und benennt die Folge (AC-9, AC-20)', () => {
    open()

    const field = screen.getByLabelText(/Passwort/)
    expect(field).toHaveAttribute('type', 'password')
    expect(field).toBeRequired()

    const warning = screen.getByText(/nicht rückgängig machen/)
    expect(warning).toBeInTheDocument()
    expect(screen.getByText(/Weltrangliste/)).toBeInTheDocument()
  })

  it('schließt folgenlos über Abbrechen und über Escape (AC-14)', () => {
    open()

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByText(/nicht rückgängig machen/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Konto löschen' }))
    expect(screen.getByText(/nicht rückgängig machen/)).toBeInTheDocument()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(screen.queryByText(/nicht rückgängig machen/)).not.toBeInTheDocument()
  })

  it('zeigt ein falsches Passwort am Feld (AC-11)', () => {
    actionState.current = { fieldErrors: { password: 'Das Passwort ist falsch.' } }
    open()

    expect(screen.getByText('Das Passwort ist falsch.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Passwort/)).toHaveAttribute('aria-invalid', 'true')
  })

  /**
   * **Der wichtigste Test dieser Datei.** Ein technischer Fehlschlag darf nicht
   * wie ein falsches Passwort aussehen — sonst tippt der Nutzer sein richtiges
   * Passwort neu ein und hält sich für vergesslich. Die Meldung muss also
   * ausdrücklich sagen, dass es **nicht** am Passwort lag, und sie darf nicht am
   * Feld hängen.
   */
  it('unterscheidet den technischen Fehler vom falschen Passwort (EC-3)', () => {
    actionState.current = {
      error:
        'Das hat gerade nicht geklappt — technisch, nicht wegen deines Passworts. Dein Konto ist unverändert.',
    }
    open()

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/nicht wegen deines Passworts/)
    expect(alert).toHaveTextContent(/unverändert/)
    expect(screen.getByLabelText(/Passwort/)).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('zeigt die Drosselungsmeldung (EC-7)', () => {
    actionState.current = { error: 'Zu viele Versuche für diese E-Mail-Adresse.' }
    open()

    expect(screen.getByRole('alert')).toHaveTextContent(/Zu viele Versuche/)
  })

  /**
   * Der Bestätigungsknopf darf **nicht** der eingebaute `AlertDialogAction`
   * sein: Der schließt den Dialog beim Klick, auch mit `asChild`. Bei falschem
   * Passwort verschwände die Meldung im selben Moment, in dem sie erscheint.
   * Beim Bau war genau das einmal drin — dieser Test hält es fest.
   */
  it('behält den Dialog beim Absenden offen', () => {
    actionState.current = { fieldErrors: { password: 'Das Passwort ist falsch.' } }
    open()

    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))

    expect(screen.getByText('Das Passwort ist falsch.')).toBeInTheDocument()
    expect(screen.getByText(/nicht rückgängig machen/)).toBeInTheDocument()
  })
})
