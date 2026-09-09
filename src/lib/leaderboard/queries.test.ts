import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createAdminClient, createClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { getLeaderboard } from './queries'

/**
 * Geprüft wird hier **nicht** die Rangfolge — die liegt in Migration 0015 und
 * ist dort gegen 100.000 gesäte Runden geprüft. Hier wird die Übersetzung
 * geprüft, und die drei Zusagen, die nur auf dieser Seite der Grenze gelten:
 *
 *   1. Ohne Sitzung wird **gar nicht** abgefragt (AC-13, AC-23) — die Reihenfolge
 *      ist der Punkt, nicht nur das Ergebnis.
 *   2. Die Profil-Kennung stammt aus `getUser()`, nie aus einem Argument.
 *   3. Ein Fehler kommt als Wert zurück und wird nicht geworfen (EC-6).
 */
function mockSession(userId: string | null) {
  createClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  })
}

function mockRpc(data: unknown, error: { message: string } | null = null) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  createAdminClient.mockReturnValue({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      return { data, error }
    },
  })
  return calls
}

beforeEach(() => vi.clearAllMocks())

describe('getLeaderboard', () => {
  it('bildet die Spalten der Datenbank auf die Anzeigefelder ab', async () => {
    mockSession('p-1')
    mockRpc([
      { rank: 1, trainer_name: 'Alpha', streak: 50, duration_ms: 60000, is_self: false },
      { rank: 8, trainer_name: 'Golf', streak: 8, duration_ms: 61000, is_self: true },
    ])

    expect(await getLeaderboard()).toEqual({
      status: 'ok',
      entries: [
        { rank: 1, trainerName: 'Alpha', streak: 50, durationMs: 60000, isSelf: false },
        { rank: 8, trainerName: 'Golf', streak: 8, durationMs: 61000, isSelf: true },
      ],
    })
  })

  it('ruft die Funktion mit der Kennung aus der Sitzung auf', async () => {
    mockSession('p-42')
    const calls = mockRpc([])

    await getLeaderboard()

    expect(calls).toEqual([{ fn: 'leaderboard_page', args: { p_profile: 'p-42' } }])
  })

  it('fragt ohne Sitzung gar nicht erst ab (AC-13, AC-23)', async () => {
    mockSession(null)
    const calls = mockRpc([])

    expect(await getLeaderboard()).toEqual({ status: 'unauthenticated' })
    // Der eigentliche Nachweis: Es entstehen keine fremden Trainernamen, die
    // versehentlich ausgeliefert werden könnten.
    expect(calls).toHaveLength(0)
  })

  it('gibt einen Datenbankfehler zurück, statt ihn zu werfen (EC-6)', async () => {
    mockSession('p-1')
    mockRpc(null, { message: 'connection refused' })

    // Kein `rejects` — würfe die Funktion, ersetzte die Fehlergrenze der Route
    // den ganzen Inhaltsbereich, und der Hinweis stünde nicht in der Karte.
    expect(await getLeaderboard()).toEqual({ status: 'error' })
  })

  it('behandelt eine leere Rangliste als gültiges Ergebnis, nicht als Fehler (AC-17)', async () => {
    mockSession('p-1')
    mockRpc(null)

    expect(await getLeaderboard()).toEqual({ status: 'ok', entries: [] })
  })
})
