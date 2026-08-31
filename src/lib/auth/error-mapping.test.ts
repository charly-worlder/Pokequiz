import { describe, expect, it } from 'vitest'
import {
  mapRegisterError,
  mapLoginError,
  mapPasswordResetRequestError,
  fieldErrorsFromZod,
  THROTTLED_MESSAGE,
  WRONG_CREDENTIALS_MESSAGE,
  RESET_CONFIRMATION_MESSAGE,
} from './error-mapping'

// These shapes (status/code combinations) were verified against a running
// local Supabase Auth instance during /build — see the comments in
// error-mapping.ts — rather than assumed from documentation.

describe('mapRegisterError', () => {
  // spec.md AC-3: duplicate email is told openly, on the email field.
  it('maps a duplicate email to a field error on email', () => {
    const result = mapRegisterError({ status: 422, code: 'user_already_exists' })
    expect(result.fieldErrors?.email).toBeDefined()
    expect(result.error).toBeUndefined()
  })

  // spec.md AC-2, EC-1: the signup trigger's rejection surfaces as a bare 500.
  it('maps a generic 500 to a field error on trainerName', () => {
    const result = mapRegisterError({ status: 500 })
    expect(result.fieldErrors?.trainerName).toBeDefined()
  })

  // spec.md AC-9(dropped)/AC-8: Supabase's own IP rate limit.
  it('maps a 429 to the throttled message', () => {
    expect(mapRegisterError({ status: 429 }).error).toBe(THROTTLED_MESSAGE)
  })

  it('falls back to a generic error for anything else', () => {
    const result = mapRegisterError({ status: 503 })
    expect(result.error).toBeDefined()
    expect(result.fieldErrors).toBeUndefined()
  })
})

describe('mapLoginError', () => {
  // spec.md AC-7: identical message regardless of the underlying cause.
  it('returns the same message for invalid_credentials as for any other 400', () => {
    const a = mapLoginError({ status: 400, code: 'invalid_credentials' })
    const b = mapLoginError({ status: 400 })
    expect(a.error).toBe(WRONG_CREDENTIALS_MESSAGE)
    expect(b.error).toBe(WRONG_CREDENTIALS_MESSAGE)
  })

  // spec.md AC-8, EC-4
  it('maps a 429 to the throttled message, not the generic one', () => {
    expect(mapLoginError({ status: 429 }).error).toBe(THROTTLED_MESSAGE)
  })
})

describe('mapPasswordResetRequestError', () => {
  // spec.md AC-10, EC-3: same confirmation whether or not the account exists —
  // Supabase's endpoint itself never returns an error for an unknown address.
  it('returns the confirmation message when there is no error', () => {
    expect(mapPasswordResetRequestError(null).message).toBe(RESET_CONFIRMATION_MESSAGE)
  })

  it('returns the throttled message on a 429', () => {
    expect(mapPasswordResetRequestError({ status: 429 }).error).toBe(THROTTLED_MESSAGE)
  })
})

describe('fieldErrorsFromZod', () => {
  it('keeps only the first issue per field', () => {
    const result = fieldErrorsFromZod([
      { path: ['email'], message: 'first' },
      { path: ['email'], message: 'second' },
      { path: ['password'], message: 'third' },
    ])
    expect(result).toEqual({ email: 'first', password: 'third' })
  })
})
