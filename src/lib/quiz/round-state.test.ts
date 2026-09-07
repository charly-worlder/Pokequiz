import { describe, expect, it, vi, beforeEach } from 'vitest'

const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))

import {
  discardPreparedQuestion,
  finishRound,
  getRoundSnapshot,
  resolveQuestionImage,
  setPreparedQuestion,
  startRound,
  submitAnswer,
} from './round-state'

/**
 * Was hier geprüft wird, ist nicht die Spielregel — die liegt in Migration 0009
 * und ist dort in SQL geprüft. Hier wird die **Übersetzung** geprüft: dass die
 * Argumentnamen zu den Funktionssignaturen passen und dass die Spalten der
 * Datenbank auf die richtigen Felder abgebildet werden.
 *
 * Das ist die Fehlerklasse, die sonst erst zur Laufzeit auffällt: Ein Tippfehler
 * in `p_correct_index` liefert keinen Fehler, sondern `null` — und aus einer
 * richtigen Antwort würde stillschweigend eine falsche.
 */
function makeAdmin(response: unknown, error: { message: string } | null = null) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  createAdminClient.mockReturnValue({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      return { data: response, error }
    },
  })
  return calls
}

beforeEach(() => vi.clearAllMocks())

describe('getRoundSnapshot', () => {
  it('bildet die Spalten der Datenbank auf den Rundenstand ab', async () => {
    makeAdmin([
      { round_id: 'r-1', seen_ids: [25, 6], streak: 3, has_current: true, has_prepared: false },
    ])

    expect(await getRoundSnapshot('p-1')).toEqual({
      roundId: 'r-1',
      seenIds: [25, 6],
      streak: 3,
      hasCurrent: true,
      hasPrepared: false,
    })
  })

  it('meldet null, wenn keine Runde läuft', async () => {
    makeAdmin([])
    expect(await getRoundSnapshot('p-1')).toBeNull()
  })
})

describe('startRound', () => {
  it('reicht Lösung und richtige Position beider Fragen unter den erwarteten Namen durch', async () => {
    const calls = makeAdmin([{ round_id: 'r-1', current_token: 't-1', prepared_token: 't-2' }])

    const result = await startRound('p-1', { answerId: 25, correctIndex: 2 }, { answerId: 6, correctIndex: 0 })

    expect(calls[0].fn).toBe('start_round')
    expect(calls[0].args).toEqual({
      p_profile: 'p-1',
      p_answer_id: 25,
      p_correct_index: 2,
      p_prepared_answer_id: 6,
      p_prepared_correct_index: 0,
      p_also_seen: [],
    })
    expect(result).toEqual({ roundId: 'r-1', currentToken: 't-1', preparedToken: 't-2' })
  })
})

describe('setPreparedQuestion', () => {
  it('gibt die verworfenen Nummern mit, damit sie nicht erneut gezogen werden (EC-5)', async () => {
    const calls = makeAdmin('t-3')

    expect(await setPreparedQuestion('p-1', 'r-1', { answerId: 150, correctIndex: 1 }, [7, 8])).toBe(
      't-3'
    )
    expect(calls[0].args).toEqual({
      p_profile: 'p-1',
      p_round_id: 'r-1',
      p_answer_id: 150,
      p_correct_index: 1,
      p_also_seen: [7, 8],
    })
  })

  /**
   * BUG-130 — ohne die Runden-Kennung im Aufruf könnte die Datenbank gar nicht
   * prüfen, wessen Runde gemeint ist. Der Test pinnt, dass sie mitgeht.
   */
  it('reicht die Runden-Kennung an die Datenbank durch (BUG-130)', async () => {
    const calls = makeAdmin('t-4')

    await setPreparedQuestion('p-1', 'r-42', { answerId: 9, correctIndex: 0 })

    expect(calls[0].fn).toBe('set_prepared_question')
    expect(calls[0].args).toMatchObject({ p_profile: 'p-1', p_round_id: 'r-42' })
  })
})

describe('discardPreparedQuestion', () => {
  it('reicht die Runden-Kennung an die Datenbank durch (BUG-130)', async () => {
    const calls = makeAdmin(null)

    await discardPreparedQuestion('p-1', 'r-42')

    expect(calls[0].fn).toBe('discard_prepared_question')
    expect(calls[0].args).toEqual({ p_profile: 'p-1', p_round_id: 'r-42' })
  })
})

describe('submitAnswer', () => {
  it('übersetzt das Urteil einer laufenden Runde', async () => {
    const calls = makeAdmin([
      {
        matched: true,
        correct: true,
        correct_index: 2,
        streak: 4,
        finished: false,
        duration_ms: null,
        round_id: 'r-1',
        next_token: 't-2',
      },
    ])

    const verdict = await submitAnswer('p-1', 't-1', 2)

    expect(calls[0].args).toEqual({ p_profile: 'p-1', p_token: 't-1', p_choice: 2 })
    expect(verdict).toEqual({
      matched: true,
      correct: true,
      correctIndex: 2,
      streak: 4,
      finished: false,
      durationMs: null,
      roundId: 'r-1',
      nextToken: 't-2',
    })
  })

  it('übersetzt eine beendete Runde samt servergemessener Dauer', async () => {
    makeAdmin([
      {
        matched: true,
        correct: false,
        correct_index: 1,
        streak: 7,
        finished: true,
        duration_ms: 12345,
        round_id: 'r-1',
        next_token: null,
      },
    ])

    const verdict = await submitAnswer('p-1', 't-1', 3)
    expect(verdict.finished).toBe(true)
    expect(verdict.durationMs).toBe(12345)
    expect(verdict.correctIndex).toBe(1)
  })

  it('meldet ein nicht passendes Token als nicht getroffen (EC-1, EC-15)', async () => {
    makeAdmin([
      {
        matched: false,
        correct: false,
        correct_index: null,
        streak: null,
        finished: false,
        duration_ms: null,
        round_id: null,
        next_token: null,
      },
    ])

    expect((await submitAnswer('p-1', 't-alt', 0)).matched).toBe(false)
  })
})

describe('finishRound', () => {
  it('nennt die zu beendende Runde und meldet die geschriebene zurück', async () => {
    const calls = makeAdmin([{ round_id: 'r-1', streak: 5, duration_ms: 9000, written: true }])
    const result = await finishRound('p-1', 'r-1')

    // Ohne die Kennung beendete der Aufruf, was gerade aktiv war — ein veralteter
    // Tab konnte damit die laufende Runde eines anderen beenden (BUG-120).
    expect(calls[0].args).toEqual({ p_profile: 'p-1', p_round_id: 'r-1' })
    expect(result).toEqual({
      roundId: 'r-1',
      streak: 5,
      durationMs: 9000,
      written: true,
    })
  })

  it('meldet den zweiten Aufruf als nicht geschrieben (EC-4)', async () => {
    makeAdmin([{ round_id: null, streak: null, duration_ms: null, written: false }])
    expect((await finishRound('p-1', 'r-1')).written).toBe(false)
  })

  it('meldet eine fremde Runden-Kennung als nicht geschrieben (BUG-120)', async () => {
    makeAdmin([{ round_id: null, streak: null, duration_ms: null, written: false }])
    expect((await finishRound('p-1', 'r-fremd')).written).toBe(false)
  })
})

describe('resolveQuestionImage', () => {
  it('gibt die Pokémon-Nummer zurück', async () => {
    const calls = makeAdmin(25)
    expect(await resolveQuestionImage('p-1', 't-1')).toBe(25)
    expect(calls[0].args).toEqual({ p_profile: 'p-1', p_token: 't-1' })
  })

  it('gibt null für ein fremdes Token zurück', async () => {
    makeAdmin(null)
    expect(await resolveQuestionImage('p-1', 't-fremd')).toBeNull()
  })
})

describe('Fehler der Datenbank', () => {
  it('wird geworfen statt als leerer Zustand ausgegeben', async () => {
    makeAdmin(null, { message: 'connection reset' })
    await expect(getRoundSnapshot('p-1')).rejects.toThrow('connection reset')
  })

  it('gilt auch für das Verwerfen der vorbereiteten Frage', async () => {
    makeAdmin(null, { message: 'deadlock detected' })
    await expect(discardPreparedQuestion('p-1', 'r-1')).rejects.toThrow('deadlock detected')
  })
})
