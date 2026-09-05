// Fails the build if this module is ever pulled into a client bundle. That is
// not decoration: the caching options below are Next *server* options and are
// inert in the browser, so an accidental client import would move these fetches
// into the browser and break AC-31 (and AC-20) silently — the exact class of
// failure this feature guards against everywhere else. design.md said "no new
// packages"; this one is a deliberate, approved exception, because a comment
// enforces nothing.
import 'server-only'

/**
 * Access to the PokeAPI. Everything here runs on the server — never in the
 * browser — so no player's IP address ever reaches a non-EU service
 * (spec.md AC-20 and, beyond it, design.md → Behaviors & Access).
 */

const API_BASE = 'https://pokeapi.co/api/v2'
const SPRITE_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork'

/**
 * spec.md AC-31 — the PokeAPI's fair use policy asks consumers to cache what
 * they have already fetched. Next 16 does NOT cache fetch by default, so this
 * has to be spelled out: a bare fetch looks identical and silently fails AC-31.
 * German names effectively never change, so 30 days is uncontroversial.
 *
 * The cache key is the request URL. No user identity takes part in it, which is
 * what keeps the cache from ever becoming a "who saw what, when" record
 * (spec.md AC-28).
 */
const CACHE_SECONDS = 60 * 60 * 24 * 30

/** spec.md AC-15 — a question that is not fully loadable within 5s counts as failed. */
export const REQUEST_TIMEOUT_MS = 5_000

/**
 * The sprite address, constructed from the Pokémon number (design.md →
 * Technical Decisions). Deliberately not verified here: checking it server-side
 * would cost a request per question in the normal case, and next/image fetches
 * the image anyway. The browser is what discovers a broken address, and a broken
 * address means the question is discarded (spec.md EC-6).
 *
 * **This is the only image source.** Until 2026-09-04 a second one sat behind it
 * (`resolveOfficialImageUrl`, spec.md EC-11), reading the officially documented
 * address from `/pokemon/{id}`. It was removed once it was measured that the
 * official address is character-for-character the one built here — see BUG-16.
 */
export function spriteUrlFor(id: number): string {
  return `${SPRITE_BASE}/${id}.png`
}

function cachedFetch(url: string, signal: AbortSignal): Promise<Response> {
  return fetch(url, {
    signal,
    cache: 'force-cache',
    next: { revalidate: CACHE_SECONDS },
  })
}

/**
 * The official German name, or null when the species has none.
 * spec.md EC-5: a Pokémon without a German name is never shown — the caller
 * draws a different one instead. (Verified 2026-09-01: all 386 have one, so
 * this guards against future drift rather than a known gap.)
 */
export async function fetchGermanName(id: number, signal: AbortSignal): Promise<string | null> {
  const res = await cachedFetch(`${API_BASE}/pokemon-species/${id}`, signal)
  if (!res.ok) return null

  const species = (await res.json()) as {
    names?: { name: string; language: { name: string } }[]
  }
  return species.names?.find((entry) => entry.language.name === 'de')?.name ?? null
}

export async function fetchGermanNames(
  ids: number[],
  signal: AbortSignal
): Promise<(string | null)[]> {
  return Promise.all(ids.map((id) => fetchGermanName(id, signal)))
}

/**
 * spec.md AC-15 — one attempt, and if it does not finish within the timeout,
 * exactly one silent retry. Anything beyond that is the caller's error state
 * (AC-16), not another retry here.
 */
export async function withTimeoutAndOneRetry<T>(
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await operation(AbortSignal.timeout(REQUEST_TIMEOUT_MS))
    } catch {
      // Timed out or the network failed — fall through to the single retry.
    }
  }
  return null
}
