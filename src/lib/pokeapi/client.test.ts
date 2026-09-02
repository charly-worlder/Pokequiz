import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchGermanName,
  resolveOfficialImageUrl,
  spriteUrlFor,
  withTimeoutAndOneRetry,
  REQUEST_TIMEOUT_MS,
} from './client'

/**
 * The two criteria that are invisible when broken (tasks.md → Prüfhinweise).
 *
 * AC-31 cannot be *proven* here: the cache belongs to the framework's fetch
 * wrapper and its options are inert outside a running Next server, so counting
 * calls would show two requests even with perfectly correct code. What a unit
 * test *can* pin down is the instruction — that the call is made with caching
 * asked for at all, which is the failure mode (a plainly written fetch).
 * The effect itself was observed at runtime; see qa-report.md.
 */

const okJson = (body: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response)

const notOk = () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response)

const signal = () => new AbortController().signal

describe('fetchGermanName', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('AC-31: fragt mit erzwungenem Zwischenspeicher und 30 Tagen Gültigkeit an', async () => {
    const fetchMock = vi.fn(() => okJson({ names: [{ name: 'Pikachu', language: { name: 'de' } }] }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchGermanName(25, signal())

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { next?: { revalidate?: number } }]
    expect(url).toBe('https://pokeapi.co/api/v2/pokemon-species/25')
    expect(init.cache).toBe('force-cache')
    expect(init.next?.revalidate).toBe(60 * 60 * 24 * 30)
  })

  it('liefert den deutschen Namen aus der Namensliste', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        okJson({
          names: [
            { name: 'Pikachu', language: { name: 'en' } },
            { name: 'Pikachu', language: { name: 'de' } },
          ],
        })
      )
    )
    expect(await fetchGermanName(25, signal())).toBe('Pikachu')
  })

  it('EC-5: liefert null, wenn es keinen deutschen Namen gibt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => okJson({ names: [{ name: 'Onlyenglish', language: { name: 'en' } }] }))
    )
    expect(await fetchGermanName(999, signal())).toBeNull()
  })

  it('liefert null bei einer Fehlerantwort', async () => {
    vi.stubGlobal('fetch', vi.fn(notOk))
    expect(await fetchGermanName(25, signal())).toBeNull()
  })
})

describe('spriteUrlFor', () => {
  it('bildet die Adresse aus der Pokémon-Nummer', () => {
    expect(spriteUrlFor(25)).toBe(
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png'
    )
  })
})

describe('resolveOfficialImageUrl (EC-11 — die Rückfallebene)', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('liest die offizielle Adresse aus /pokemon/{id}', async () => {
    const fetchMock = vi.fn(() =>
      okJson({
        sprites: { other: { 'official-artwork': { front_default: 'https://cdn.test/offiziell.png' } } },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    expect(await resolveOfficialImageUrl(25, signal())).toBe('https://cdn.test/offiziell.png')
    expect(fetchMock.mock.calls[0][0]).toBe('https://pokeapi.co/api/v2/pokemon/25')
  })

  it('weicht auf front_default aus, wenn es kein official-artwork gibt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => okJson({ sprites: { front_default: 'https://cdn.test/klein.png' } }))
    )
    expect(await resolveOfficialImageUrl(25, signal())).toBe('https://cdn.test/klein.png')
  })

  it('EC-6: liefert null, wenn auch die offizielle Antwort kein Bild hat', async () => {
    vi.stubGlobal('fetch', vi.fn(() => okJson({ sprites: {} })))
    expect(await resolveOfficialImageUrl(25, signal())).toBeNull()
  })

  it('liefert null bei einer Fehlerantwort', async () => {
    vi.stubGlobal('fetch', vi.fn(notOk))
    expect(await resolveOfficialImageUrl(25, signal())).toBeNull()
  })
})

describe('withTimeoutAndOneRetry (AC-15)', () => {
  it('gibt das Ergebnis des ersten Versuchs zurück', async () => {
    const op = vi.fn(async () => 'ok')
    expect(await withTimeoutAndOneRetry(op)).toBe('ok')
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('versucht es nach einem Fehlschlag genau einmal erneut', async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('beim zweiten Mal')
    expect(await withTimeoutAndOneRetry(op)).toBe('beim zweiten Mal')
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('gibt nach dem zweiten Fehlschlag auf — kein dritter Versuch', async () => {
    const op = vi.fn().mockRejectedValue(new Error('timeout'))
    expect(await withTimeoutAndOneRetry(op)).toBeNull()
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('übergibt ein Abbruchsignal mit der 5-Sekunden-Grenze', async () => {
    expect(REQUEST_TIMEOUT_MS).toBe(5_000)
    const op = vi.fn(async (s: AbortSignal) => {
      expect(s).toBeInstanceOf(AbortSignal)
      return 'ok'
    })
    await withTimeoutAndOneRetry(op)
    expect(op).toHaveBeenCalled()
  })
})
