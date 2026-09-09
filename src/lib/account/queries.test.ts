import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { getAccountData } from './queries'

/**
 * Geprüft werden die Zusagen, die auf **dieser** Seite der Datenbankgrenze
 * liegen — die Filterregeln selbst prüft `tests/PROJ-4-deletion-cascade.spec.ts`
 * gegen echte Zeilen:
 *
 *   1. Ohne Sitzung wird **gar nicht** abgefragt (AC-4) — die Reihenfolge ist
 *      der Punkt, nicht nur das Ergebnis.
 *   2. Die Rundenzahl zählt **alle** Runden, der beste Lauf nur Serie ≥ 1
 *      (AC-2, AC-6) — der Unterschied ist beabsichtigt und leicht zu verlieren.
 *   3. Ein Fehler kommt als Wert zurück, nicht als Wurf, und macht die Anzeige
 *      **nicht** still falsch (AC-19).
 *   4. Es wird kein Administrationszugang benutzt — die Datei importiert ihn
 *      nicht einmal.
 */

type QueryResult = { data?: unknown; error?: { message: string } | null; count?: number | null }

/**
 * Bildet die Kette `.from(...).select(...)...` nach und schreibt mit, welche
 * Tabelle mit welchen Einschränkungen abgefragt wurde. Jede Kettenmethode gibt
 * denselben Bauzustand zurück; erst `maybeSingle()` bzw. das Erwarten des
 * `select`-Ergebnisses liefert Daten.
 */
function mockDb(results: { profiles: QueryResult; runsCount: QueryResult; runsBest: QueryResult }) {
  const seen: { table: string; filters: string[] }[] = []

  createClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'p-1', email: 'a@b.de' } } }) },
    from(table: string) {
      const entry = { table, filters: [] as string[] }
      seen.push(entry)

      // **Nach Gestalt der Abfrage, nicht nach Aufrufreihenfolge.** Der erste
      // Anlauf wählte nach Reihenfolge und schlug fehl: `maybeSingle()` wird
      // beim Aufbau des `Promise.all`-Arrays synchron aufgerufen, das `await`
      // auf die Zählabfrage erst danach — die Reihenfolge dreht sich also um.
      const result = () => {
        if (table === 'profiles') return results.profiles
        return entry.filters.includes('head-count') ? results.runsCount : results.runsBest
      }

      const builder: Record<string, unknown> = {
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) entry.filters.push('head-count')
          return builder
        },
        eq: (col: string, val: unknown) => {
          entry.filters.push(`eq:${col}=${String(val)}`)
          return builder
        },
        gte: (col: string, val: unknown) => {
          entry.filters.push(`gte:${col}=${String(val)}`)
          return builder
        },
        order: (col: string, o?: { ascending?: boolean }) => {
          entry.filters.push(`order:${col}:${o?.ascending ? 'asc' : 'desc'}`)
          return builder
        },
        limit: (n: number) => {
          entry.filters.push(`limit:${n}`)
          return builder
        },
        maybeSingle: async () => result(),
        then: (resolve: (v: QueryResult) => unknown) => resolve(result()),
      }
      return builder
    },
  })

  return seen
}

const profileOk = { data: { trainer_name: 'Ash', created_at: '2026-08-30T10:00:00Z' }, error: null }

beforeEach(() => vi.clearAllMocks())

describe('getAccountData', () => {
  it('gibt die fünf Werte zurück', async () => {
    mockDb({
      profiles: profileOk,
      runsCount: { data: null, error: null, count: 47 },
      runsBest: { data: { streak: 23, duration_ms: 107300 }, error: null },
    })

    expect(await getAccountData()).toEqual({
      status: 'ok',
      data: {
        email: 'a@b.de',
        trainerName: 'Ash',
        createdAt: '2026-08-30T10:00:00Z',
        roundsPlayed: 47,
        bestRun: { streak: 23, durationMs: 107300 },
      },
    })
  })

  it('zählt alle Runden, sucht den besten Lauf aber nur ab Serie 1', async () => {
    const seen = mockDb({
      profiles: profileOk,
      runsCount: { data: null, error: null, count: 9 },
      runsBest: { data: null, error: null },
    })

    await getAccountData()

    const [countQuery, bestQuery] = seen.filter((q) => q.table === 'runs')

    // Die Zählung kennt **keine** Serien-Einschränkung: Eine Nullrunde liegt als
    // Zeile in der Datenbank und gehört damit in die Auskunft nach Art. 15.
    expect(countQuery.filters).toContain('head-count')
    expect(countQuery.filters.some((f) => f.startsWith('gte:streak'))).toBe(false)

    // Der beste Lauf dagegen beginnt bei Serie 1 und sortiert wie die Rangliste.
    expect(bestQuery.filters).toContain('gte:streak=1')
    expect(bestQuery.filters).toContain('order:streak:desc')
    expect(bestQuery.filters).toContain('order:duration_ms:asc')
    expect(bestQuery.filters).toContain('limit:1')
  })

  it('meldet keinen besten Lauf, wenn es nur Nullrunden gibt (AC-6)', async () => {
    mockDb({
      profiles: profileOk,
      runsCount: { data: null, error: null, count: 3 },
      runsBest: { data: null, error: null },
    })

    const result = await getAccountData()
    expect(result).toMatchObject({ status: 'ok', data: { roundsPlayed: 3, bestRun: null } })
  })

  it('fragt ohne Sitzung gar nicht erst ab (AC-4)', async () => {
    const seen: unknown[] = []
    createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
      from: () => {
        seen.push('abgefragt')
        return {}
      },
    })

    expect(await getAccountData()).toEqual({ status: 'unauthenticated' })
    expect(seen).toHaveLength(0)
  })

  it('gibt einen Fehler als Wert zurück, statt zu werfen', async () => {
    mockDb({
      profiles: { data: null, error: { message: 'weg' } },
      runsCount: { data: null, error: null, count: 0 },
      runsBest: { data: null, error: null },
    })

    await expect(getAccountData()).resolves.toEqual({ status: 'error' })
  })

  it('zeigt lieber gar nichts als eine falsche Rundenzahl (AC-19)', async () => {
    // Scheitert **nur** die Zählung, wäre "0 Runden" eine falsche Auskunft —
    // und AC-19 sagt Vollständigkeit zu. Also Fehlerzustand statt Halbwahrheit.
    mockDb({
      profiles: profileOk,
      runsCount: { data: null, error: { message: 'zaehlen ging nicht' } },
      runsBest: { data: null, error: null },
    })

    expect(await getAccountData()).toEqual({ status: 'error' })
  })
})
