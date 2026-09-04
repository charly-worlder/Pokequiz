import { describe, expect, it } from 'vitest'
import { registerSchema, loginSchema, trainerNameSchema, passwordSchema } from './auth'

describe('trainerNameSchema', () => {
  // spec.md AC-1, AC-2: 3–20 characters, letters/digits/underscore only.
  it('accepts a valid trainer name', () => {
    expect(trainerNameSchema.safeParse('Ash_Ketchum1').success).toBe(true)
  })

  // spec.md EC-5: too short, too long, and disallowed characters are rejected.
  it.each(['ab', 'a'.repeat(21), 'Ash Ketchum', 'Ash🔥', ''])(
    'rejects invalid trainer name %j',
    (value) => {
      expect(trainerNameSchema.safeParse(value).success).toBe(false)
    }
  )
})

describe('passwordSchema', () => {
  // spec.md AC-1, AC-11: minimum 8 characters, no forced character classes.
  it('accepts an 8-character password', () => {
    expect(passwordSchema.safeParse('simplepw').success).toBe(true)
  })

  it('rejects a password shorter than 8 characters', () => {
    expect(passwordSchema.safeParse('short1').success).toBe(false)
  })
})

describe('registerSchema', () => {
  it('accepts a fully valid registration payload', () => {
    const result = registerSchema.safeParse({
      trainerName: 'Ash_Ketchum',
      email: 'ash@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
  })

  // spec.md AC-13: every missing/invalid field surfaces its own error.
  it('reports one issue per invalid field', () => {
    const result = registerSchema.safeParse({ trainerName: '', email: 'not-an-email', password: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path[0])
      expect(paths).toEqual(expect.arrayContaining(['trainerName', 'email', 'password']))
    }
  })
})

describe('loginSchema', () => {
  it('rejects an empty password without enforcing a minimum length', () => {
    // Login only checks presence — the length rule belongs to registration.
    expect(loginSchema.safeParse({ email: 'ash@example.com', password: '' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'ash@example.com', password: 'x' }).success).toBe(true)
  })
})

/**
 * BUG-11: Ein Passwort über bcrypts 72-Byte-Grenze wurde von Supabase mit einem
 * 400 abgelehnt, und die App zeigte „Die Verbindung ist fehlgeschlagen" — ein
 * Netzwerkfehler für ein Feldproblem, ohne Hinweis, was zu ändern wäre.
 * Passwortmanager erzeugen solche Passphrasen.
 */
describe('passwordSchema — Obergrenze (BUG-11)', () => {
  it('nimmt exakt 72 Zeichen an', () => {
    expect(passwordSchema.safeParse('a'.repeat(72)).success).toBe(true)
  })

  it('lehnt 73 Zeichen mit einer Feldmeldung ab', () => {
    const result = passwordSchema.safeParse('a'.repeat(73))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Höchstens 72 Zeichen')
    }
  })

  it('zählt Bytes, nicht Zeichen — 40 Umlaute sind 80 Byte und damit zu lang', () => {
    // "ä" ist in UTF-8 zwei Byte. Eine reine Zeichenzählung würde das
    // durchlassen und dem Nutzer denselben verwirrenden Fehler zurückgeben.
    expect(passwordSchema.safeParse('ä'.repeat(40)).success).toBe(false)
    expect(passwordSchema.safeParse('ä'.repeat(36)).success).toBe(true)
  })
})
