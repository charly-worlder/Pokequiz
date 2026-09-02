import { describe, expect, it, vi, beforeEach } from 'vitest'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { saveRun, getPersonalBest } from './run-actions'

const ROUND_ID = '3f8b2c1e-9a4d-4f6b-8e2a-1c5d7e9f0a3b'

type BestRow = { streak: number; duration_ms: number } | null

/**
 * Minimal stand-in for the Supabase query builder: records what was inserted
 * and which filters the personal-best query applied.
 */
function makeClient({
  user = { id: 'user-1' } as { id: string } | null,
  best = null as BestRow,
  insertError = null as { code: string } | null,
} = {}) {
  const inserted: Record<string, unknown>[] = []
  const filters: Record<string, unknown> = {}

  const builder: Record<string, unknown> = {}
  const chain = () => builder
  Object.assign(builder, {
    select: chain,
    eq: (col: string, val: unknown) => {
      filters[`eq:${col}`] = val
      return builder
    },
    neq: (col: string, val: unknown) => {
      filters[`neq:${col}`] = val
      return builder
    },
    order: chain,
    limit: chain,
    maybeSingle: async () => ({ data: best }),
    insert: async (row: Record<string, unknown>) => {
      inserted.push(row)
      return { error: insertError }
    },
  })

  return {
    client: {
      auth: { getUser: async () => ({ data: { user } }) },
      from: () => builder,
    },
    inserted,
    filters,
  }
}

describe('saveRun', () => {
  beforeEach(() => vi.clearAllMocks())

  it('EC-7: weist einen Aufruf ohne Sitzung ab und schreibt nichts', async () => {
    const { client, inserted } = makeClient({ user: null })
    createClient.mockResolvedValue(client)

    expect(await saveRun({ streak: 5, durationMs: 10_000, clientRoundId: ROUND_ID })).toEqual({
      status: 'unauthenticated',
    })
    expect(inserted).toHaveLength(0)
  })

  it('AC-12: lehnt ein rechnerisch unmögliches Ergebnis ab, bevor es die Datenbank sieht', async () => {
    const { client, inserted } = makeClient()
    createClient.mockResolvedValue(client)

    expect(await saveRun({ streak: 50, durationMs: 100, clientRoundId: ROUND_ID })).toEqual({
      status: 'rejected',
    })
    expect(inserted).toHaveLength(0)
  })

  it('AC-12: lehnt eine Serie über dem Pool ab', async () => {
    const { client } = makeClient()
    createClient.mockResolvedValue(client)
    const result = await saveRun({ streak: 999, durationMs: 9_999_999, clientRoundId: ROUND_ID })
    expect(result.status).toBe('rejected')
  })

  it('AC-14: schreibt immer für das Profil aus der Sitzung, nie für ein übergebenes', async () => {
    const { client, inserted } = makeClient({ user: { id: 'user-1' } })
    createClient.mockResolvedValue(client)

    await saveRun({
      streak: 3,
      durationMs: 9_000,
      clientRoundId: ROUND_ID,
      // Ein Angreifer würde genau das mitschicken:
      profile_id: 'fremdes-profil',
    } as unknown)

    expect(inserted).toHaveLength(1)
    expect(inserted[0].profile_id).toBe('user-1')
  })

  it('AC-11: speichert auch eine Runde mit Serie 0', async () => {
    const { client, inserted } = makeClient()
    createClient.mockResolvedValue(client)

    const result = await saveRun({ streak: 0, durationMs: 4_000, clientRoundId: ROUND_ID })
    expect(result.status).toBe('saved')
    expect(inserted[0].streak).toBe(0)
  })

  it('EC-4: eine zweite Einreichung derselben Runde meldet Erfolg statt eines Fehlers', async () => {
    const { client } = makeClient({ insertError: { code: '23505' } })
    createClient.mockResolvedValue(client)

    const result = await saveRun({ streak: 3, durationMs: 9_000, clientRoundId: ROUND_ID })
    expect(result.status).toBe('saved')
  })

  it('EC-3: meldet einen echten Speicherfehler als fehlgeschlagen', async () => {
    const { client } = makeClient({ insertError: { code: '08006' } })
    createClient.mockResolvedValue(client)

    expect(await saveRun({ streak: 3, durationMs: 9_000, clientRoundId: ROUND_ID })).toEqual({
      status: 'failed',
    })
  })

  it('AC-8: erste Runde überhaupt ist eine persönliche Bestleistung', async () => {
    const { client } = makeClient({ best: null })
    createClient.mockResolvedValue(client)

    const result = await saveRun({ streak: 3, durationMs: 9_000, clientRoundId: ROUND_ID })
    expect(result).toEqual({ status: 'saved', isPersonalBest: true })
  })

  it('AC-8: höhere Serie schlägt den bisherigen Rekord', async () => {
    const { client } = makeClient({ best: { streak: 5, duration_ms: 10_000 } })
    createClient.mockResolvedValue(client)

    const result = await saveRun({ streak: 6, durationMs: 60_000, clientRoundId: ROUND_ID })
    expect(result).toEqual({ status: 'saved', isPersonalBest: true })
  })

  it('AC-8: gleiche Serie, kürzere Zeit schlägt den Rekord', async () => {
    const { client } = makeClient({ best: { streak: 5, duration_ms: 10_000 } })
    createClient.mockResolvedValue(client)

    const result = await saveRun({ streak: 5, durationMs: 9_999, clientRoundId: ROUND_ID })
    expect(result).toEqual({ status: 'saved', isPersonalBest: true })
  })

  it('AC-8: gleiche Serie, längere Zeit ist kein Rekord', async () => {
    const { client } = makeClient({ best: { streak: 5, duration_ms: 10_000 } })
    createClient.mockResolvedValue(client)

    const result = await saveRun({ streak: 5, durationMs: 10_001, clientRoundId: ROUND_ID })
    expect(result).toEqual({ status: 'saved', isPersonalBest: false })
  })

  it('EC-4: die Rekordfrage schließt die laufende Runde aus dem Vergleich aus', async () => {
    const { client, filters } = makeClient({ best: null })
    createClient.mockResolvedValue(client)

    await saveRun({ streak: 3, durationMs: 9_000, clientRoundId: ROUND_ID })
    expect(filters['neq:client_round_id']).toBe(ROUND_ID)
  })
})

describe('getPersonalBest (AC-8)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('liest nur die Runden des angemeldeten Profils', async () => {
    const { client, filters } = makeClient({ best: { streak: 7, duration_ms: 20_000 } })
    createClient.mockResolvedValue(client)

    expect(await getPersonalBest()).toEqual({ streak: 7, durationMs: 20_000 })
    expect(filters['eq:profile_id']).toBe('user-1')
  })

  it('liefert null ohne Sitzung', async () => {
    const { client } = makeClient({ user: null })
    createClient.mockResolvedValue(client)
    expect(await getPersonalBest()).toBeNull()
  })

  it('liefert null, wenn es noch keine Runde gibt', async () => {
    const { client } = makeClient({ best: null })
    createClient.mockResolvedValue(client)
    expect(await getPersonalBest()).toBeNull()
  })
})
