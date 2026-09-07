import { describe, expect, it } from 'vitest'
import { answerSubmissionSchema, choiceIndexSchema, questionTokenSchema, POOL_SIZE } from './quiz'

/**
 * spec.md AC-32 und AC-33 — alles, was der Browser über eine Frage sagen darf:
 * welche Frage, und welche der vier Optionen. Beides kommt an einer Server
 * Action an, ist also ein öffentlicher Endpunkt, den jeder mit einer Sitzung mit
 * beliebigem Inhalt aufrufen kann (`.claude/rules/security.md`).
 *
 * Was hier **nicht** mehr steht, ist der eigentliche Punkt: Bis zum 2026-09-06
 * prüfte diese Datei ein eingereichtes Rundenergebnis auf Plausibilität. Es gibt
 * kein eingereichtes Ergebnis mehr (AC-12).
 */

const TOKEN = '3f8b2c1e-9a4d-4f6b-8e2a-1c5d7e9f0a3b'

describe('questionTokenSchema', () => {
  it('nimmt ein Frage-Token an', () => {
    expect(questionTokenSchema.safeParse(TOKEN).success).toBe(true)
  })

  it('lehnt alles ab, was kein Token ist', () => {
    for (const value of ['', 'nicht-uuid', 42, null, undefined, {}, [TOKEN]]) {
      expect(questionTokenSchema.safeParse(value).success).toBe(false)
    }
  })
})

describe('choiceIndexSchema', () => {
  it('nimmt genau die vier Positionen an', () => {
    for (const choice of [0, 1, 2, 3]) {
      expect(choiceIndexSchema.safeParse(choice).success).toBe(true)
    }
  })

  it('lehnt Positionen außerhalb der vier Optionen ab', () => {
    for (const choice of [-1, 4, 1.5, POOL_SIZE, '2', null]) {
      expect(choiceIndexSchema.safeParse(choice).success).toBe(false)
    }
  })
})

describe('answerSubmissionSchema', () => {
  it('nimmt eine vollständige Antwort an', () => {
    expect(answerSubmissionSchema.safeParse({ token: TOKEN, choice: 2 }).success).toBe(true)
  })

  it('lehnt eine Antwort ohne Token ab', () => {
    expect(answerSubmissionSchema.safeParse({ choice: 2 }).success).toBe(false)
  })

  it('lehnt zusätzliche Felder nicht ab, übernimmt sie aber auch nicht', () => {
    // Serie und Dauer sind genau die Werte, die der Browser früher mitschickte.
    // Sie dürfen nirgends mehr ankommen — hier wird belegt, dass sie das Schema
    // nicht passieren, statt still übernommen zu werden.
    const parsed = answerSubmissionSchema.parse({ token: TOKEN, choice: 1, streak: 386, durationMs: 0 })
    expect(parsed).toEqual({ token: TOKEN, choice: 1 })
  })
})
