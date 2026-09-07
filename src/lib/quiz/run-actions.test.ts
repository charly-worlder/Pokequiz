import { describe, expect, it, vi, beforeEach } from 'vitest'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

const state = vi.hoisted(() => ({ submitAnswer: vi.fn(), finishRound: vi.fn() }))
vi.mock('./round-state', () => state)

import { answerAction, endRoundAction, getPersonalBest } from './run-actions'

const TOKEN = '3f8b2c1e-9a4d-4f6b-8e2a-1c5d7e9f0a3b'
const ROUND = '9c1f7a2b-3e4d-4a5b-8c6d-2e1f0a9b8c7d'

type BestRow = { streak: number; duration_ms: number } | null

/** Sehr kleiner Ersatz für den Abfrage-Baukasten; merkt sich die Filter. */
function session({
  user = { id: 'user-1' } as { id: string } | null,
  best = null as BestRow,
} = {}) {
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
  })

  createClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => builder,
  })
  return filters
}

beforeEach(() => {
  vi.clearAllMocks()
  session()
})

describe('answerAction', () => {
  it('reicht nur Token und Position an die Datenbank weiter (AC-33)', async () => {
    state.submitAnswer.mockResolvedValue({
      matched: true,
      correct: true,
      correctIndex: 2,
      streak: 5,
      finished: false,
      durationMs: null,
      roundId: ROUND,
      nextToken: 't-2',
    })

    const result = await answerAction({ token: TOKEN, choice: 2 })

    expect(state.submitAnswer).toHaveBeenCalledWith('user-1', TOKEN, 2)
    expect(result).toEqual({
      status: 'answered',
      correct: true,
      correctIndex: 2,
      streak: 5,
      result: null,
    })
  })

  it('ignoriert eine mitgeschickte Serie und Dauer (AC-12)', async () => {
    state.submitAnswer.mockResolvedValue({
      matched: true,
      correct: true,
      correctIndex: 0,
      streak: 1,
      finished: false,
      durationMs: null,
      roundId: ROUND,
      nextToken: 't-2',
    })

    const result = await answerAction({ token: TOKEN, choice: 0, streak: 386, durationMs: 1 })

    // Nicht abgelehnt, aber auch nicht übernommen: Die Serie kommt aus der
    // Datenbank, nicht aus der Anfrage.
    expect(result).toMatchObject({ status: 'answered', streak: 1 })
    expect(state.submitAnswer).toHaveBeenCalledWith('user-1', TOKEN, 0)
  })

  it('lehnt eine Position außerhalb der vier Optionen ab', async () => {
    expect(await answerAction({ token: TOKEN, choice: 7 })).toEqual({ status: 'rejected' })
    expect(state.submitAnswer).not.toHaveBeenCalled()
  })

  it('lehnt eine Antwort ohne gültiges Token ab', async () => {
    expect(await answerAction({ token: 'nope', choice: 1 })).toEqual({ status: 'rejected' })
    expect(state.submitAnswer).not.toHaveBeenCalled()
  })

  it('meldet ein nicht mehr passendes Token als abgelaufen (EC-1, EC-15)', async () => {
    state.submitAnswer.mockResolvedValue({
      matched: false,
      correct: false,
      correctIndex: null,
      streak: null,
      finished: false,
      durationMs: null,
      roundId: null,
      nextToken: null,
    })

    expect(await answerAction({ token: TOKEN, choice: 1 })).toEqual({ status: 'stale' })
  })

  it('liefert bei Rundenende die servergemessene Zeit und den Rekord-Vergleich (AC-8, AC-34)', async () => {
    session({ best: { streak: 3, duration_ms: 9000 } })
    state.submitAnswer.mockResolvedValue({
      matched: true,
      correct: false,
      correctIndex: 1,
      streak: 7,
      finished: true,
      durationMs: 12345,
      roundId: ROUND,
      nextToken: null,
    })

    const result = await answerAction({ token: TOKEN, choice: 3 })

    expect(result).toEqual({
      status: 'answered',
      correct: false,
      correctIndex: 1,
      streak: 7,
      result: { streak: 7, durationMs: 12345, isPersonalBest: true },
    })
  })

  it('erkennt eine schlechtere Runde nicht als Bestleistung (AC-8)', async () => {
    session({ best: { streak: 20, duration_ms: 5000 } })
    state.submitAnswer.mockResolvedValue({
      matched: true,
      correct: false,
      correctIndex: 1,
      streak: 7,
      finished: true,
      durationMs: 12345,
      roundId: ROUND,
      nextToken: null,
    })

    const result = await answerAction({ token: TOKEN, choice: 3 })
    expect(result).toMatchObject({ result: { isPersonalBest: false } })
  })

  it('weist einen Aufruf ohne Sitzung ab (EC-7)', async () => {
    session({ user: null })
    expect(await answerAction({ token: TOKEN, choice: 1 })).toEqual({ status: 'unauthenticated' })
    expect(state.submitAnswer).not.toHaveBeenCalled()
  })
})

describe('endRoundAction', () => {
  it('wertet die bis dahin erreichte Serie normal (AC-18)', async () => {
    state.finishRound.mockResolvedValue({
      roundId: ROUND,
      streak: 4,
      durationMs: 8000,
      written: true,
    })

    expect(await endRoundAction(ROUND)).toEqual({
      status: 'ended',
      result: { streak: 4, durationMs: 8000, isPersonalBest: true },
    })
    expect(state.finishRound).toHaveBeenCalledWith('user-1', ROUND)
  })

  it('meldet einen zweiten Aufruf als gegenstandslos, statt eine zweite Zeile anzulegen (EC-4)', async () => {
    state.finishRound.mockResolvedValue({
      roundId: null,
      streak: null,
      durationMs: null,
      written: false,
    })

    expect(await endRoundAction(ROUND)).toEqual({ status: 'gone' })
  })
})

describe('endRoundAction — die Runden-Kennung (BUG-120)', () => {
  it('lehnt einen Aufruf ohne brauchbare Kennung ab, statt irgendeine Runde zu beenden', async () => {
    expect(await endRoundAction(undefined)).toEqual({ status: 'gone' })
    expect(await endRoundAction('nicht-uuid')).toEqual({ status: 'gone' })
    expect(state.finishRound).not.toHaveBeenCalled()
  })
})

describe('getPersonalBest', () => {
  it('liest ausschließlich eigene Runden (AC-8, AC-14)', async () => {
    const filters = session({ best: { streak: 12, duration_ms: 30000 } })

    expect(await getPersonalBest()).toEqual({ streak: 12, durationMs: 30000 })
    expect(filters['eq:profile_id']).toBe('user-1')
  })

  it('schließt die gerade geschriebene Runde über round_id aus (EC-4)', async () => {
    const filters = session({ best: { streak: 12, duration_ms: 30000 } })

    await getPersonalBest(ROUND)
    expect(filters['neq:round_id']).toBe(ROUND)
  })

  it('lehnt eine unbrauchbare Runden-Kennung ab, statt sie in die Abfrage zu geben', async () => {
    const filters = session({ best: { streak: 1, duration_ms: 1 } })
    expect(await getPersonalBest('nicht-uuid')).toBeNull()
    expect(filters['neq:round_id']).toBeUndefined()
  })
})
