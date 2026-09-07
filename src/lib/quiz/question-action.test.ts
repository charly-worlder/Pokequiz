import { describe, expect, it, vi, beforeEach } from 'vitest'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

const { drawQuestion } = vi.hoisted(() => ({ drawQuestion: vi.fn() }))
vi.mock('./draw-question', () => ({ drawQuestion }))

const state = vi.hoisted(() => ({
  startRound: vi.fn(),
  setPreparedQuestion: vi.fn(),
  discardPreparedQuestion: vi.fn(),
  promotePreparedQuestion: vi.fn(),
  getRoundSnapshot: vi.fn(),
  finishRound: vi.fn(),
}))
vi.mock('./round-state', () => state)

const { getPersonalBest } = vi.hoisted(() => ({ getPersonalBest: vi.fn() }))
vi.mock('./run-actions', () => ({ getPersonalBest }))

import {
  startRoundAction,
  replacePreparedQuestionAction,
  prepareNextQuestionAction,
} from './question-action'

function session(user: { id: string } | null = { id: 'user-1' }) {
  createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user } }) } })
}

const drawn = (answerId: number, correctIndex: number, alsoSeen: number[] = []) => ({
  answerId,
  correctIndex,
  options: ['Glurak', 'Relaxo', 'Pikachu', 'Enton'],
  alsoSeen,
})

beforeEach(() => {
  vi.clearAllMocks()
  session()
})

describe('startRoundAction', () => {
  it('gibt weder die Pokémon-Nummer noch die richtige Option an den Browser (AC-32)', async () => {
    drawQuestion.mockResolvedValueOnce(drawn(25, 2)).mockResolvedValueOnce(drawn(6, 0))
    state.startRound.mockResolvedValue({
      roundId: 'r-1',
      currentToken: 't-1',
      preparedToken: 't-2',
    })

    const result = await startRoundAction()

    expect(result).toEqual({
      status: 'ok',
      roundId: 'r-1',
      current: { token: 't-1', options: ['Glurak', 'Relaxo', 'Pikachu', 'Enton'] },
      prepared: { token: 't-2', options: ['Glurak', 'Relaxo', 'Pikachu', 'Enton'] },
    })

    // Der eigentliche Punkt: In der ganzen Antwort steht keine Nummer und kein
    // Hinweis auf die Lösung — auch nicht in einem Feld, das niemand anzeigt.
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('answerId')
    expect(serialized).not.toContain('correctIndex')
    expect(serialized).not.toContain('25')
  })

  it('zieht die zweite Frage ohne die Nummer der ersten (AC-5)', async () => {
    drawQuestion.mockResolvedValueOnce(drawn(25, 2, [113])).mockResolvedValueOnce(drawn(6, 0))
    state.startRound.mockResolvedValue({ roundId: 'r', currentToken: 'a', preparedToken: 'b' })

    await startRoundAction()

    const excludedForSecond = drawQuestion.mock.calls[1][0] as Set<number>
    expect(excludedForSecond.has(25)).toBe(true)
    expect(excludedForSecond.has(113)).toBe(true)
  })

  it('reicht die verworfenen Nummern in den Rundenzustand (EC-5)', async () => {
    drawQuestion.mockResolvedValueOnce(drawn(25, 2, [113])).mockResolvedValueOnce(drawn(6, 0, [201]))
    state.startRound.mockResolvedValue({ roundId: 'r', currentToken: 'a', preparedToken: 'b' })

    await startRoundAction()

    expect(state.startRound.mock.calls[0][3]).toEqual([113, 201])
  })

  it('meldet „nicht ladbar", wenn keine Frage zustande kommt (AC-16)', async () => {
    drawQuestion.mockResolvedValue(null)
    expect(await startRoundAction()).toEqual({ status: 'unavailable' })
    expect(state.startRound).not.toHaveBeenCalled()
  })

  it('weist einen Aufruf ohne Sitzung ab (EC-7)', async () => {
    session(null)
    expect(await startRoundAction()).toEqual({ status: 'unauthenticated' })
    expect(drawQuestion).not.toHaveBeenCalled()
  })
})

describe('replacePreparedQuestionAction', () => {
  it('verwirft die vorbereitete Frage und zieht eine neue (EC-6)', async () => {
    state.getRoundSnapshot.mockResolvedValue({
      roundId: 'r-1',
      seenIds: [25, 6],
      streak: 1,
      hasCurrent: true,
      hasPrepared: false,
    })
    drawQuestion.mockResolvedValue(drawn(150, 1))
    state.setPreparedQuestion.mockResolvedValue('t-neu')

    const result = await replacePreparedQuestionAction()

    expect(state.discardPreparedQuestion).toHaveBeenCalledWith('user-1')
    expect(result).toEqual({
      status: 'ok',
      prepared: { token: 't-neu', options: ['Glurak', 'Relaxo', 'Pikachu', 'Enton'] },
    })
  })

  it('zieht ausschließlich aus den noch nicht verbrauchten Nummern (AC-5)', async () => {
    state.getRoundSnapshot.mockResolvedValue({
      roundId: 'r-1',
      seenIds: [25, 6, 113],
      streak: 1,
      hasCurrent: true,
      hasPrepared: false,
    })
    drawQuestion.mockResolvedValue(drawn(150, 1))
    state.setPreparedQuestion.mockResolvedValue('t-neu')

    await replacePreparedQuestionAction()

    expect([...(drawQuestion.mock.calls[0][0] as Set<number>)]).toEqual([25, 6, 113])
  })

  it('weist einen Aufruf ohne Sitzung ab (EC-7)', async () => {
    session(null)
    expect(await replacePreparedQuestionAction()).toEqual({ status: 'unauthenticated' })
    expect(state.discardPreparedQuestion).not.toHaveBeenCalled()
  })
})

describe('prepareNextQuestionAction', () => {
  it('beendet die Runde selbst, wenn der Vorrat erschöpft ist und keine Frage offensteht (AC-35, EC-2)', async () => {
    state.getRoundSnapshot.mockResolvedValue({
      roundId: 'r-1',
      seenIds: [],
      streak: 386,
      hasCurrent: false,
      hasPrepared: false,
    })
    drawQuestion.mockResolvedValue('pool-empty')
    state.finishRound.mockResolvedValue({
      roundId: 'r-1',
      streak: 386,
      durationMs: 12_000,
      written: true,
    })
    getPersonalBest.mockResolvedValue(null)

    const result = await prepareNextQuestionAction()

    // Der Server wertet, nicht der Browser: Bleibt dessen Aufruf aus, wäre das
    // Ergebnis sonst verloren (BUG-119).
    expect(state.finishRound).toHaveBeenCalledWith('user-1', 'r-1')
    expect(result).toEqual({
      status: 'pool-empty',
      result: { streak: 386, durationMs: 12_000, isPersonalBest: true },
    })
  })

  it('beendet die Runde NICHT, solange noch eine Frage offensteht (AC-35)', async () => {
    state.getRoundSnapshot.mockResolvedValue({
      roundId: 'r-1',
      seenIds: [],
      streak: 5,
      hasCurrent: true,
      hasPrepared: false,
    })
    drawQuestion.mockResolvedValue('pool-empty')

    expect(await prepareNextQuestionAction()).toEqual({ status: 'pool-empty', result: null })
    expect(state.finishRound).not.toHaveBeenCalled()
  })

  it('meldet „nicht ladbar", wenn es gar keine laufende Runde gibt', async () => {
    state.getRoundSnapshot.mockResolvedValue(null)
    expect(await prepareNextQuestionAction()).toEqual({ status: 'unavailable' })
  })
})
