import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getLeaderboard, redirect } = vi.hoisted(() => ({
  getLeaderboard: vi.fn(),
  redirect: vi.fn(),
}))
vi.mock('@/lib/leaderboard/queries', () => ({ getLeaderboard }))
vi.mock('next/navigation', () => ({ redirect }))

import LeaderboardPage from './page'

/**
 * Die **zweite** Schranke der Ranglisten-Seite (spec.md AC-13, EC-8).
 *
 * **Warum dieser Test existiert, obwohl es schon einen E2E-Test dafür gibt.**
 * Beim Bau am 2026-09-08 wurde `PROJ-3-leaderboard-page-guard.spec.ts` gegen
 * eine Mutation geprüft: Die Umleitung in `page.tsx` wurde entfernt — und der
 * E2E-Test blieb **grün**. Der Grund ist kein Fehler im Test, sondern die
 * Architektur: `src/proxy.ts` fängt die ausgeloggte Anfrage ab, bevor die Seite
 * überhaupt läuft. Der E2E-Test belegt also die erste Schranke, nie die zweite.
 *
 * `.claude/rules/security.md` verlangt aber ausdrücklich zwei unabhängige
 * Prüfungen, „because sooner or later one of them gets bypassed" — und
 * `design.md` sagt zu, dass es sie gibt. Eine Zusage, die kein Test rot machen
 * kann, ist in diesem Projekt schon mehrfach still verfallen (BUG-91: „Rot-
 * Nachweis auf beiden Ebenen — Entscheidung und Verdrahtung"). Deshalb hier,
 * eine Ebene tiefer und ohne Proxy: Die Seite selbst muss umleiten.
 */
beforeEach(() => vi.clearAllMocks())

describe('LeaderboardPage', () => {
  it('leitet ohne Sitzung auf /login, unabhängig vom Routen-Schutz (AC-13, EC-8)', async () => {
    getLeaderboard.mockResolvedValue({ status: 'unauthenticated' })

    await LeaderboardPage()

    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('leitet bei vorhandener Sitzung nicht um', async () => {
    getLeaderboard.mockResolvedValue({ status: 'ok', entries: [] })

    await LeaderboardPage()

    expect(redirect).not.toHaveBeenCalled()
  })

  it('leitet bei einem Datenbankfehler nicht um, sondern rendert (EC-6)', async () => {
    // Ein Fehler ist kein Zugangsproblem. Würde er auf /login führen, sähe der
    // angemeldete Spieler bei einem Ausfall der Datenbank wie ausgeloggt aus.
    getLeaderboard.mockResolvedValue({ status: 'error' })

    await LeaderboardPage()

    expect(redirect).not.toHaveBeenCalled()
  })
})
