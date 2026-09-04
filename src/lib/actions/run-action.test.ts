import { describe, expect, it, vi } from 'vitest'
import { runClientAction } from './run-action'

/**
 * Der feature-neutrale Kern hinter `runAuthAction` (PROJ-1) und dem Quiz-Pfad
 * (PROJ-2, BUG-7). Geprüft wird beides: dass ein Transport-Fehler zum
 * Rückfallwert wird und dass Next.js' Kontrollfluss-Signale weiterfliegen.
 */
/** Stellvertreter für `SaveRunResult` — der Rückfallwert ist eine andere Variante als der Erfolg. */
type Result = { status: 'saved' } | { status: 'failed' }

describe('runClientAction', () => {
  it('reicht das Ergebnis der Action unverändert durch', async () => {
    const result = await runClientAction<Result>(async () => ({ status: 'saved' }), {
      status: 'failed',
    })
    expect(result).toEqual({ status: 'saved' })
  })

  it('macht aus einem Transport-Fehler den Rückfallwert, statt zu werfen', async () => {
    const result = await runClientAction<Result>(async () => {
      throw new TypeError('Failed to fetch')
    }, { status: 'failed' })
    expect(result).toEqual({ status: 'failed' })
  })

  it('wirft ein Next.js-Redirect-Signal weiter, statt es zu verschlucken', async () => {
    const redirectError = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;replace;/;307;',
    })

    await expect(
      runClientAction<string | null>(async () => {
        throw redirectError
      }, null)
    ).rejects.toBe(redirectError)
  })

  it('ruft die Action genau einmal auf', async () => {
    const call = vi.fn(async () => 'ok')
    await runClientAction(call, 'fallback')
    expect(call).toHaveBeenCalledTimes(1)
  })
})
