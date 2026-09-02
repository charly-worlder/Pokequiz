import { describe, expect, it, vi, beforeEach } from 'vitest'

const { createClient, fetchGermanName, fetchGermanNames, withTimeoutAndOneRetry, spriteUrlFor, resolveOfficialImageUrl } =
  vi.hoisted(() => ({
    createClient: vi.fn(),
    fetchGermanName: vi.fn(),
    fetchGermanNames: vi.fn(),
    withTimeoutAndOneRetry: vi.fn(),
    spriteUrlFor: vi.fn((id: number) => `https://sprites.test/${id}.png`),
    resolveOfficialImageUrl: vi.fn(),
  }))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/pokeapi/client', () => ({
  fetchGermanName,
  fetchGermanNames,
  withTimeoutAndOneRetry,
  spriteUrlFor,
  resolveOfficialImageUrl,
  REQUEST_TIMEOUT_MS: 5000,
}))

import { getNextQuestion, repairImageUrl } from './question-action'
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

  it('ignoriert unsinnige Einträge in der Ausschlussliste', async () => {
    const result = await getNextQuestion([NaN, 1.5, -3] as number[])
    expect(result.status).toBe('ok')
  })
})

describe('repairImageUrl (EC-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createClient.mockResolvedValue(signedIn())
    withTimeoutAndOneRetry.mockImplementation(runOperation)
    resolveOfficialImageUrl.mockResolvedValue('https://cdn.test/repariert.png')
  })

  it('liefert die offizielle Adresse', async () => {
    expect(await repairImageUrl(25)).toBe('https://cdn.test/repariert.png')
  })

  it('weist einen Aufruf ohne Sitzung ab', async () => {
    createClient.mockResolvedValue(signedOut())
    expect(await repairImageUrl(25)).toBeNull()
  })

  it('weist Nummern außerhalb des Pools ab, ohne die API zu fragen', async () => {
    expect(await repairImageUrl(0)).toBeNull()
    expect(await repairImageUrl(POOL_SIZE + 1)).toBeNull()
    expect(await repairImageUrl(1.5)).toBeNull()
    expect(resolveOfficialImageUrl).not.toHaveBeenCalled()
  })
})
