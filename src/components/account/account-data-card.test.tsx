import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AccountDataCard } from './account-data-card'
import type { AccountData } from '@/lib/account/queries'

const BASE: AccountData = {
  email: 'sehr.lange.adresse.eines.trainers@beispiel-domain.example.de',
  trainerName: 'Ash',
  createdAt: '2026-08-30T10:00:00Z',
  roundsPlayed: 47,
  bestRun: { streak: 23, durationMs: 107_300 },
}

describe('AccountDataCard', () => {
  it('zeigt alle fünf Werte (AC-2)', () => {
    render(<AccountDataCard data={BASE} />)

    expect(screen.getByText(BASE.email)).toBeInTheDocument()
    expect(screen.getByText('Ash')).toBeInTheDocument()
    expect(screen.getByText('30.08.2026')).toBeInTheDocument()
    expect(screen.getByText('47')).toBeInTheDocument()
    expect(screen.getByText(/Serie 23/)).toBeInTheDocument()
    expect(screen.getByText(/01:47,3/)).toBeInTheDocument()
  })

  /**
   * **Der Feldlisten-Test — er prüft den Typ, nicht die Optik und nicht die Datenbank.**
   *
   * AC-19 sagt seit dem 2026-09-10 **nicht** mehr zu, dass die Seite alles zeigt.
   * Was hier festgehalten wird, ist die Feldmenge von `AccountData`: Wächst der
   * Typ, wird der Test rot und zwingt zur Entscheidung, ob das neue Feld
   * angezeigt gehört. Ein Feld, das nur in der **Datenbank** dazukommt, sieht er
   * per Konstruktion nicht. Der Test
   * hält deshalb die Feldmenge von `AccountData` fest: Wächst der Typ, wird er
   * rot und zwingt zur Entscheidung, ob das neue Feld angezeigt gehört.
   */
  it('zeigt jedes Feld, das AccountData führt (AC-19)', () => {
    render(<AccountDataCard data={BASE} />)

    const shown = ['E-Mail', 'Trainername', 'Dabei seit', 'Runden gespielt', 'Bester Lauf']
    for (const label of shown) expect(screen.getByText(label)).toBeInTheDocument()

    // Wächst `AccountData`, muss diese Liste mitwachsen — sonst behauptet der
    // Satz unten etwas, das nicht mehr stimmt.
    expect(Object.keys(BASE).sort()).toEqual(
      ['bestRun', 'createdAt', 'email', 'roundsPlayed', 'trainerName'].sort()
    )
    expect(shown).toHaveLength(Object.keys(BASE).length)

    /*
      AC-19 im Wortlaut seit dem 2026-09-10. Geprüft werden **beide Hälften**
      der Aussage, nicht nur ihr Anfang: die Aufzählung der fünf Werte **und**
      der Hinweis, dass daneben noch etwas existiert. Die alte Fassung prüfte
      einen Satz, der schlicht nicht zutraf („das ist alles") — ein Test, der
      eine falsche Zusage bewacht, ist schlimmer als keiner.
    */
    expect(screen.getByText(/Das sind deine gespeicherten Kontodaten/)).toBeInTheDocument()
    expect(
      screen.getByText(/Technische Zeitstempel und Sicherheitszähler kommen zusätzlich dazu/)
    ).toBeInTheDocument()
  })

  it('nennt fehlende Bestleistung beim Namen, statt eine Null zu zeigen (AC-6)', () => {
    render(<AccountDataCard data={{ ...BASE, roundsPlayed: 3, bestRun: null }} />)

    expect(screen.getByText('Noch keine gewertete Runde')).toBeInTheDocument()
    expect(screen.queryByText(/Serie 0/)).not.toBeInTheDocument()
  })

  it('bietet nichts zum Ändern an (AC-3)', () => {
    const { container } = render(<AccountDataCard data={BASE} />)

    expect(container.querySelectorAll('input')).toHaveLength(0)
    expect(container.querySelectorAll('textarea')).toHaveLength(0)
    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(container.querySelectorAll('form')).toHaveLength(0)
  })

  it('lässt lange Werte umbrechen, statt die Karte zu sprengen (AC-7)', () => {
    render(<AccountDataCard data={BASE} />)

    // `break-words` ist die Maßnahme gegen den waagerechten Überlauf bei 320 px.
    // Der Browser-Beleg dafür steht in `tests/PROJ-4-account-narrow.spec.ts`;
    // hier wird festgehalten, dass die Klasse nicht stillschweigend verschwindet.
    const value = screen.getByText(BASE.email)
    expect(value.className).toContain('break-words')
  })
})
