import { describe, expect, it } from 'vitest'
import {
  mapRegisterError,
  mapLoginError,
  mapPasswordResetRequestError,
  mapUpdatePasswordError,
  fieldErrorsFromZod,
  THROTTLED_MESSAGE,
  WRONG_CREDENTIALS_MESSAGE,
  RESET_CONFIRMATION_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  SAME_PASSWORD_MESSAGE,
} from './error-mapping'

// Kurzschreibweisen für die beiden Antworten auf „war der Name vergeben?" —
// dieselbe Frage, die registerAction auf dem Fehlerpfad an die Datenbank stellt.
const NAME_VERGEBEN = { trainerNameTaken: true }
const NAME_FREI = { trainerNameTaken: false }

// These shapes (status/code combinations) were verified against a running
// local Supabase Auth instance during /build — see the comments in
// error-mapping.ts — rather than assumed from documentation.

describe('mapRegisterError', () => {
  // spec.md AC-3: duplicate email is told openly, on the email field.
  it('maps a duplicate email to a field error on email', () => {
    const result = mapRegisterError({ status: 422, code: 'user_already_exists' }, NAME_FREI)
    expect(result.fieldErrors?.email).toBeDefined()
    expect(result.error).toBeUndefined()
  })

  // spec.md AC-2, EC-1: the signup trigger's rejection surfaces as a bare 500 —
  // and is only a taken name if the database says the name is actually there.
  it('maps a 500 to a field error on trainerName when the name really is taken', () => {
    const result = mapRegisterError({ status: 500 }, NAME_VERGEBEN)
    expect(result.fieldErrors?.trainerName).toBeDefined()
  })

  // spec.md AC-8: Supabase's own IP rate limit.
  it('maps a 429 to the throttled message', () => {
    expect(mapRegisterError({ status: 429 }, NAME_FREI).error).toBe(THROTTLED_MESSAGE)
  })

  it('falls back to a generic error for anything else', () => {
    const result = mapRegisterError({ status: 503 }, NAME_FREI)
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

/**
 * BUG-9: Ein Ausfall von Supabase Auth wurde dem Nutzer als „Passwort falsch"
 * gemeldet, weil alles außer einem 429 auf WRONG_CREDENTIALS durchfiel. Er hat
 * dann ein Passwort zurückgesetzt, das nie das Problem war.
 *
 * Der erste Test hier ist der eigentliche Wächter; die beiden darüber sichern
 * ab, dass die Trennung AC-7 nicht bricht — falsches Passwort und unbekannte
 * Adresse müssen weiterhin ununterscheidbar bleiben.
 */
describe('mapRegisterError — Ausfall vs. vergebener Trainername (BUG-68)', () => {
  /**
   * Der Trigger wirft `trainer_name_taken`, aber GoTrue ersetzt den Text durch
   * „Database error saving new user" — gemessen am 2026-09-05. Ein echter
   * Datenbankausfall während der Registrierung sieht am Fehlerobjekt **identisch**
   * aus. Vorher wurde jeder 500 als vergebener Name gedeutet; der Nutzer bekam bei
   * einer Störung gesagt, sein Wunschname sei weg, und probierte weiter.
   *
   * Dieser Test ist der eigentliche Wächter: Er prüft den Fall, in dem die
   * Datenbank sagt „den Namen gibt es hier gar nicht".
   */
  it('meldet einen 500 als Störung, wenn der Trainername gar nicht vergeben ist', () => {
    const result = mapRegisterError({ status: 500 }, NAME_FREI)
    expect(result.error).toBe(NETWORK_ERROR_MESSAGE)
    expect(result.fieldErrors).toBeUndefined()
  })

  it('hält AC-2/EC-1: derselbe 500 bleibt ein Feldfehler, wenn der Name wirklich vergeben ist', () => {
    const result = mapRegisterError({ status: 500 }, NAME_VERGEBEN)
    expect(result.fieldErrors?.trainerName).toBe('Dieser Trainername ist bereits vergeben.')
    expect(result.error).toBeUndefined()
  })

  it('lässt die Nachfrage den 429 nicht überstimmen — Drosselung bleibt Drosselung', () => {
    expect(mapRegisterError({ status: 429 }, NAME_VERGEBEN).error).toBe(THROTTLED_MESSAGE)
  })
})

describe('mapUpdatePasswordError — Feldproblem vs. Störung (BUG-66)', () => {
  /**
   * Ein neues Passwort, das dem alten entspricht, wurde als „Die Verbindung ist
   * fehlgeschlagen" gemeldet, weil jeder Fehler auf die Netzwerkmeldung durchfiel.
   * Der Nutzer erfuhr nicht, was er ändern soll. Supabase ist hier eindeutig:
   * 422 / code "same_password" (gemessen 2026-09-05).
   */
  it('meldet ein unverändertes Passwort am Passwort-Feld, nicht als Verbindungsfehler', () => {
    const result = mapUpdatePasswordError({ status: 422, code: 'same_password' })
    expect(result.fieldErrors?.password).toBe(SAME_PASSWORD_MESSAGE)
    expect(result.error).toBeUndefined()
  })

  it('meldet eine echte Störung weiterhin als Störung, nicht als Feldproblem', () => {
    expect(mapUpdatePasswordError({ status: 500 }).error).toBe(NETWORK_ERROR_MESSAGE)
    expect(mapUpdatePasswordError({}).error).toBe(NETWORK_ERROR_MESSAGE)
    expect(mapUpdatePasswordError({ status: 500 }).fieldErrors).toBeUndefined()
  })
})

describe('mapLoginError — Ausfall vs. falsche Zugangsdaten (BUG-9)', () => {
  it('meldet einen Fehler ohne Status als Verbindungsproblem, nicht als falsches Passwort', () => {
    expect(mapLoginError({}).error).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('meldet einen Serverfehler als Verbindungsproblem', () => {
    expect(mapLoginError({ status: 500 }).error).toBe(NETWORK_ERROR_MESSAGE)
    expect(mapLoginError({ status: 503 }).error).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('hält AC-7: falsches Passwort und unbekannte Adresse bleiben ununterscheidbar', () => {
    const wrongPassword = mapLoginError({ status: 400, code: 'invalid_credentials' })
    const unknownEmail = mapLoginError({ status: 400, code: 'invalid_credentials' })

    expect(wrongPassword.error).toBe(WRONG_CREDENTIALS_MESSAGE)
    expect(unknownEmail.error).toBe(wrongPassword.error)
  })
})
