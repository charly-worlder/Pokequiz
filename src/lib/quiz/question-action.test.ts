import { describe, expect, it, vi, beforeEach } from 'vitest'

const { createClient, fetchGermanName, fetchGermanNames, withTimeoutAndOneRetry, spriteUrlFor } =
  vi.hoisted(() => ({
    createClient: vi.fn(),
    fetchGermanName: vi.fn(),
    fetchGermanNames: vi.fn(),
    withTimeoutAndOneRetry: vi.fn(),
    spriteUrlFor: vi.fn((id: number) => `https://sprites.test/${id}.png`),
  }))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/pokeapi/client', () => ({
  fetchGermanName,
  fetchGermanNames,
  withTimeoutAndOneRetry,
  spriteUrlFor,
  REQUEST_TIMEOUT_MS: 5000,
}))

import { getNextQuestion } from './question-action'
import { POOL_SIZE } from '@/lib/validation/quiz'

const signedIn = () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) } })
const signedOut = () => ({ auth: { getUser: async () => ({ data: { user: null } }) } })

/** Runs the real assembly logic instead of stubbing it away. */
const runOperation = async (op: (s: AbortSignal) => Promise<unknown>) =>
  op(new AbortController().signal)

describe('getNextQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createClient.mockResolvedValue(signedIn())
    withTimeoutAndOneRetry.mockImplementation(runOperation)
    fetchGermanName.mockImplementation(async (id: number) => `Name${id}`)
    fetchGermanNames.mockImplementation(async (ids: number[]) => ids.map((id) => `Name${id}`))
  })

  it('EC-7: weist einen Aufruf ohne Sitzung ab', async () => {
    createClient.mockResolvedValue(signedOut())
    expect(await getNextQuestion([])).toEqual({ status: 'unauthenticated' })
  })

  // BUG-12: `seenIds` ging ungeprüft in `.filter()`. Alles, was kein Array war,
  // erzeugte eine unbehandelte TypeError und damit HTTP 500 — im Dev-Modus samt
  // absoluter Dateipfade in der Antwort. Ein Server Action ist ein öffentlicher
  // Endpunkt; `saveRun` hatte sein Zod-Schema von Anfang an, diese Grenze nicht.
  it('BUG-12: weist unbrauchbare Eingaben ab, statt zu werfen', async () => {
    for (const bad of [undefined, null, 'abc', 42, {}, [null], ['7'], [1.5], [{}]]) {
      await expect(getNextQuestion(bad)).resolves.toEqual({ status: 'unavailable' })
    }
  })

  // BUG-17: Der Ausschlussliste wurden beliebige Zahlen geglaubt. 386 Nummern
  // *außerhalb* des Pools ergaben „Pool leer" — und damit die Gewinner-Meldung
  // aus EC-2, ohne dass je eine Frage beantwortet worden wäre.
  it('BUG-17: Nummern außerhalb des Pools erzeugen kein „Pool leer"', async () => {
    const outside = Array.from({ length: POOL_SIZE }, (_, i) => 100_000 + i)
    await expect(getNextQuestion(outside)).resolves.toEqual({ status: 'unavailable' })
  })

  it('AC-3: liefert genau vier verschiedene Namen, einer davon der richtige', async () => {
    const result = await getNextQuestion([])
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return

    const { options, correctIndex, pokemonId } = result.question
    expect(options).toHaveLength(4)
    expect(new Set(options).size).toBe(4)
    expect(options[correctIndex]).toBe(`Name${pokemonId}`)
  })

  it('AC-3: die Bildadresse gehört zum gesuchten Pokémon', async () => {
    const result = await getNextQuestion([])
    if (result.status !== 'ok') throw new Error('erwartet: ok')
    expect(result.question.imageUrl).toBe(`https://sprites.test/${result.question.pokemonId}.png`)
  })

  it('AC-5: zieht nie ein bereits gezeigtes Pokémon erneut', async () => {
    // Alle bis auf die 42 sind verbraucht — es muss die 42 kommen.
    const seen = Array.from({ length: POOL_SIZE }, (_, i) => i + 1).filter((id) => id !== 42)
    const result = await getNextQuestion(seen)
    if (result.status !== 'ok') throw new Error('erwartet: ok')
    expect(result.question.pokemonId).toBe(42)
  })

  it('EC-2: meldet einen leeren Pool, wenn alle 386 verbraucht sind', async () => {
    const seen = Array.from({ length: POOL_SIZE }, (_, i) => i + 1)
    expect(await getNextQuestion(seen)).toEqual({ status: 'pool-empty' })
  })

  it('EC-5: verwirft ein Pokémon ohne deutschen Namen und zieht ein anderes', async () => {
    let firstCall = true
    fetchGermanName.mockImplementation(async (id: number) => {
      if (firstCall) {
        firstCall = false
        return null
      }
      return `Name${id}`
    })

    const result = await getNextQuestion([])
    expect(result.status).toBe('ok')
    // Zwei Lösungsversuche: der erste ohne Namen, der zweite mit.
    expect(fetchGermanName.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('AC-16: meldet "nicht ladbar", wenn die Quelle nichts liefert', async () => {
    withTimeoutAndOneRetry.mockResolvedValue(null)
    expect(await getNextQuestion([])).toEqual({ status: 'unavailable' })
  })

  // **Vertrag geändert am 2026-09-04 (BUG-12).** Dieser Test hieß „ignoriert
  // unsinnige Einträge in der Ausschlussliste" und verlangte `ok`: Unsinn wurde
  // stillschweigend herausgefiltert und weitergemacht. Genau diese Nachsicht war
  // die Lücke — sie ließ auch `[null]` oder `"abc"` bis in `.filter()` durch,
  // und dort gab es dann HTTP 500 statt einer Antwort.
  //
  // Die Grenze weist jetzt ab, statt zu reparieren. Unser eigener Client schickt
  // so etwas nie; was es schickt, ist ein Aufruf von Hand, und der bekommt eine
  // saubere Absage.
  it('BUG-12: weist eine Ausschlussliste mit unsinnigen Einträgen ab, statt sie zu säubern', async () => {
    const result = await getNextQuestion([NaN, 1.5, -3] as number[])
    expect(result.status).toBe('unavailable')
  })
})
