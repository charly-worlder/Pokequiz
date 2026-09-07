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

const ROUND = '11111111-1111-4111-8111-111111111111'

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
      roundId: ROUND,
      currentToken: 't-1',
      preparedToken: 't-2',
    })

    const result = await startRoundAction()

    expect(result).toEqual({
      status: 'ok',
      roundId: ROUND,
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
      roundId: ROUND,
      seenIds: [25, 6],
      streak: 1,
      hasCurrent: true,
      hasPrepared: false,
    })
    drawQuestion.mockResolvedValue(drawn(150, 1))
    state.setPreparedQuestion.mockResolvedValue('t-neu')

    const result = await replacePreparedQuestionAction(ROUND)

    expect(state.discardPreparedQuestion).toHaveBeenCalledWith('user-1', ROUND)
    expect(result).toEqual({
      status: 'ok',
      prepared: { token: 't-neu', options: ['Glurak', 'Relaxo', 'Pikachu', 'Enton'] },
    })
  })

  it('zieht ausschließlich aus den noch nicht verbrauchten Nummern (AC-5)', async () => {
    state.getRoundSnapshot.mockResolvedValue({
      roundId: ROUND,
      seenIds: [25, 6, 113],
      streak: 1,
      hasCurrent: true,
      hasPrepared: false,
    })
    drawQuestion.mockResolvedValue(drawn(150, 1))
    state.setPreparedQuestion.mockResolvedValue('t-neu')

    await replacePreparedQuestionAction(ROUND)

    expect([...(drawQuestion.mock.calls[0][0] as Set<number>)]).toEqual([25, 6, 113])
  })

  it('weist einen Aufruf ohne Sitzung ab (EC-7)', async () => {
    session(null)
    expect(await replacePreparedQuestionAction(ROUND)).toEqual({ status: 'unauthenticated' })
    expect(state.discardPreparedQuestion).not.toHaveBeenCalled()
  })
})

describe('prepareNextQuestionAction', () => {
  it('beendet die Runde selbst, wenn der Vorrat erschöpft ist und keine Frage offensteht (AC-35, EC-2)', async () => {
    state.getRoundSnapshot.mockResolvedValue({
      roundId: ROUND,
      seenIds: [],
      streak: 386,
      hasCurrent: false,
      hasPrepared: false,
    })
    drawQuestion.mockResolvedValue('pool-empty')
    state.finishRound.mockResolvedValue({
      roundId: ROUND,
      streak: 386,
      durationMs: 12_000,
      written: true,
    })
    getPersonalBest.mockResolvedValue(null)

    const result = await prepareNextQuestionAction(ROUND)

    // Der Server wertet, nicht der Browser: Bleibt dessen Aufruf aus, wäre das
    // Ergebnis sonst verloren (BUG-119).
    expect(state.finishRound).toHaveBeenCalledWith('user-1', ROUND)
    expect(result).toEqual({
      status: 'pool-empty',
      result: { streak: 386, durationMs: 12_000, isPersonalBest: true },
    })
  })

  it('beendet die Runde NICHT, solange noch eine Frage offensteht (AC-35)', async () => {
    state.getRoundSnapshot.mockResolvedValue({
      roundId: ROUND,
      seenIds: [],
      streak: 5,
      hasCurrent: true,
      hasPrepared: false,
    })
    drawQuestion.mockResolvedValue('pool-empty')

    expect(await prepareNextQuestionAction(ROUND)).toEqual({ status: 'pool-empty', result: null })
    expect(state.finishRound).not.toHaveBeenCalled()
  })

  it('meldet „nicht ladbar", wenn es gar keine laufende Runde gibt', async () => {
    state.getRoundSnapshot.mockResolvedValue(null)
    expect(await prepareNextQuestionAction(ROUND)).toEqual({ status: 'unavailable' })
  })
})

/**
 * BUG-130 — dieselbe Klasse wie BUG-120, die dessen Fix in `0012` überlebt hat.
 *
 * Ein veralteter Tab (seine Runde wurde nach AC-36 anderswo verdrängt) rief
 * diese beiden Actions **ohne jedes Argument** auf. Der Server arbeitete
 * daraufhin auf „was gerade läuft" — und veränderte damit die Runde des anderen
 * Tabs: Ihre vorbereitete Frage wurde ausgetauscht, ihr Ziehungsvorrat verkürzt,
 * und im Fall eines erschöpften Vorrats wurde sie sogar beendet und gewertet.
 *
 * Die Tests hier prüfen deshalb nicht nur den Rückgabewert, sondern vor allem,
 * dass die verändernden Aufrufe **gar nicht erst stattfinden**.
 */
const FREMDE_RUNDE = '22222222-2222-4222-8222-222222222222'

describe('Ein veralteter Tab verändert die laufende Runde nicht (BUG-130, AC-36, EC-15)', () => {
  const laufendeRunde = {
    roundId: ROUND,
    seenIds: [25, 6],
    streak: 1,
    hasCurrent: true,
    hasPrepared: true,
  }

  it('replacePreparedQuestionAction weist eine fremde Kennung ab, OHNE zu verwerfen', async () => {
    state.getRoundSnapshot.mockResolvedValue(laufendeRunde)

    expect(await replacePreparedQuestionAction(FREMDE_RUNDE)).toEqual({ status: 'stale' })

    // Der Kern des Befunds: Vorher wurde hier die vorbereitete Frage der
    // *laufenden* Runde gelöscht, bevor überhaupt jemand nach der Kennung fragte.
    expect(state.discardPreparedQuestion).not.toHaveBeenCalled()
    expect(state.setPreparedQuestion).not.toHaveBeenCalled()
    expect(drawQuestion).not.toHaveBeenCalled()
  })

  it('prepareNextQuestionAction weist eine fremde Kennung ab, OHNE eine Frage zu ziehen', async () => {
    state.getRoundSnapshot.mockResolvedValue(laufendeRunde)

    expect(await prepareNextQuestionAction(FREMDE_RUNDE)).toEqual({ status: 'stale' })

    // Kein Zug aus dem Vorrat der fremden Runde: `seen_ids` bleibt unberührt.
    expect(drawQuestion).not.toHaveBeenCalled()
    expect(state.setPreparedQuestion).not.toHaveBeenCalled()
  })

  it('beendet die laufende Runde NICHT, wenn ein veralteter Tab auf erschöpften Vorrat läuft', async () => {
    // Der schärfste Fall: Vorher bekam `finishRound` die serverseitig
    // abgeleitete `snapshot.roundId` — die passte zwangsläufig immer, und der
    // veraltete Tab beendete die fremde Runde samt Wertung.
    state.getRoundSnapshot.mockResolvedValue({
      roundId: ROUND,
      seenIds: [],
      streak: 9,
      hasCurrent: false,
      hasPrepared: false,
    })
    drawQuestion.mockResolvedValue('pool-empty')

    expect(await prepareNextQuestionAction(FREMDE_RUNDE)).toEqual({ status: 'stale' })
    expect(state.finishRound).not.toHaveBeenCalled()
  })

  it('weist eine Kennung ab, die gar keine ist, bevor irgendetwas geschieht', async () => {
    state.getRoundSnapshot.mockResolvedValue(laufendeRunde)

    expect(await prepareNextQuestionAction('nicht-mal-eine-uuid')).toEqual({ status: 'stale' })
    expect(await replacePreparedQuestionAction(null)).toEqual({ status: 'stale' })

    expect(state.getRoundSnapshot).not.toHaveBeenCalled()
    expect(state.discardPreparedQuestion).not.toHaveBeenCalled()
  })

  it('meldet „stale", wenn die Runde zwischen Prüfung und Schreiben verdrängt wird', async () => {
    state.getRoundSnapshot.mockResolvedValue(laufendeRunde)
    drawQuestion.mockResolvedValue(drawn(150, 1))
    // Die Datenbank findet die Runde nicht mehr — ihr `where a.round_id = …`
    // trifft nichts, also kommt kein Token zurück.
    state.setPreparedQuestion.mockResolvedValue(null)

    expect(await prepareNextQuestionAction(ROUND)).toEqual({ status: 'stale' })
  })
})
