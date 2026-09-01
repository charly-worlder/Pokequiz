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
