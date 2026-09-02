import { describe, expect, it } from 'vitest'
import { runSubmissionSchema, POOL_SIZE, MIN_MS_PER_ANSWER } from './quiz'

/**
 * spec.md AC-12 — the first of the two independent checks on a submitted round.
 * The second is the set of CHECK constraints in migration 0002; both have to
 * reject the same shapes.
 */

const valid = {
  streak: 10,
  durationMs: 20_000,
  clientRoundId: '3f8b2c1e-9a4d-4f6b-8e2a-1c5d7e9f0a3b',
}

describe('runSubmissionSchema (AC-12)', () => {
  it('nimmt eine plausible Runde an', () => {
    expect(runSubmissionSchema.safeParse(valid).success).toBe(true)
  })

  it('nimmt eine Runde mit Serie 0 an (AC-11: auch Nullrunden werden gespeichert)', () => {
    expect(runSubmissionSchema.safeParse({ ...valid, streak: 0, durationMs: 0 }).success).toBe(true)
  })

  it('lehnt eine Serie über dem Pool ab', () => {
    const result = runSubmissionSchema.safeParse({ ...valid, streak: POOL_SIZE + 1 })
    expect(result.success).toBe(false)
  })

  it('lehnt eine negative Serie ab', () => {
    expect(runSubmissionSchema.safeParse({ ...valid, streak: -1 }).success).toBe(false)
  })

  it('lehnt eine negative Dauer ab', () => {
    expect(runSubmissionSchema.safeParse({ ...valid, durationMs: -1 }).success).toBe(false)
  })

  it('lehnt eine Runde ab, die schneller ist als 500ms pro Frage', () => {
    const tooFast = { ...valid, streak: 20, durationMs: 20 * MIN_MS_PER_ANSWER - 1 }
    expect(runSubmissionSchema.safeParse(tooFast).success).toBe(false)
  })

  it('nimmt genau die Grenze von 500ms pro Frage an', () => {
    const exact = { ...valid, streak: 20, durationMs: 20 * MIN_MS_PER_ANSWER }
    expect(runSubmissionSchema.safeParse(exact).success).toBe(true)
  })

  it('lehnt nicht ganzzahlige Werte ab', () => {
    expect(runSubmissionSchema.safeParse({ ...valid, streak: 3.5 }).success).toBe(false)
    expect(runSubmissionSchema.safeParse({ ...valid, durationMs: 1.5 }).success).toBe(false)
  })

  it('lehnt ein Runden-Kennzeichen ab, das keine UUID ist', () => {
    expect(runSubmissionSchema.safeParse({ ...valid, clientRoundId: 'nicht-uuid' }).success).toBe(false)
  })

  it('lehnt fremde Felder als Ersatz für Pflichtfelder ab', () => {
    expect(runSubmissionSchema.safeParse({ streak: 1 }).success).toBe(false)
    expect(runSubmissionSchema.safeParse(null).success).toBe(false)
    expect(runSubmissionSchema.safeParse('10').success).toBe(false)
  })
})
