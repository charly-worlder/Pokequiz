import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Die **Verdrahtung** der Server Actions (BUG-75).
 *
 * Warum es diese Datei gibt: `error-mapping.test.ts` prüft, dass die
 * Zuordnungsfunktionen richtig entscheiden — aber nicht, dass die Actions sie
 * überhaupt benutzen. Der QA-Nachlauf vom 2026-09-05 hat genau das gemessen:
 * Umgeht man `isTrainerNameTaken` in `registerAction` oder ruft man
 * `mapUpdatePasswordError` nicht mehr auf, bleibt die gesamte Suite grün, obwohl
 * AC-2 damit tot wäre und BUG-66 zurückkäme.
 *
 * Hier steht deshalb nicht, was die Funktionen entscheiden, sondern **dass sie
 * gefragt werden** — und was der Nutzer am Ende sieht.
 */

const { registerAttempt, settleSuccessfulLogin, isTrainerNameTaken, signUp, updateUser, getUser } =
  vi.hoisted(() => ({
    registerAttempt: vi.fn(),
    settleSuccessfulLogin: vi.fn(),
    isTrainerNameTaken: vi.fn(),
    signUp: vi.fn(),
    updateUser: vi.fn(),
    getUser: vi.fn(),
  }))

vi.mock('@/lib/auth/throttle', () => ({ registerAttempt, settleSuccessfulLogin }))
vi.mock('@/lib/auth/trainer-name', () => ({ isTrainerNameTaken }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signUp, updateUser, getUser } }),
}))
vi.mock('next/headers', () => ({ headers: async () => ({ get: () => null }) }))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`)
  },
}))
vi.mock('server-only', () => ({}))

import {
  registerAction,
  updatePasswordAction,
  loginAction,
  requestPasswordResetAction,
} from './actions'
import {
  NETWORK_ERROR_MESSAGE,
  SAME_PASSWORD_MESSAGE,
  THROTTLED_MESSAGE,
  THROTTLED_ACCOUNT_MESSAGE,
} from './error-mapping'

beforeEach(() => {
  vi.clearAllMocks()
  registerAttempt.mockResolvedValue({ allowed: true, blockedBy: null })
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
})

function registerForm(trainerName = 'AshKetchum') {
  const fd = new FormData()
  fd.set('trainerName', trainerName)
  fd.set('email', 'ash@example.com')
  fd.set('password', 'LangGenug1')
  return fd
}

function passwordForm(password = 'LangGenug1') {
  const fd = new FormData()
  fd.set('password', password)
  return fd
}

/** Der 500, den GoTrue sowohl bei Namenskollision als auch bei Störung schickt. */
const AMBIGUOUS_500 = { status: 500, message: 'Database error saving new user' }

describe('registerAction — fragt bei einem 500 wirklich nach (BUG-68, BUG-75)', () => {
  it('holt die Antwort bei `isTrainerNameTaken` ein, statt sie zu raten', async () => {
    signUp.mockResolvedValue({ error: AMBIGUOUS_500 })
    isTrainerNameTaken.mockResolvedValue(true)

    await registerAction({}, registerForm('Pikachu'))

    expect(isTrainerNameTaken).toHaveBeenCalledWith('Pikachu')
  })

  /**
   * Der eigentliche Wächter. Er ist der Grund für diese Datei: Er wird rot,
   * sobald die Nachfrage umgangen wird — auch dann, wenn `mapRegisterError`
   * selbst unverändert richtig ist.
   */
  it('meldet eine Störung als Störung, wenn der Name gar nicht vergeben ist', async () => {
    signUp.mockResolvedValue({ error: AMBIGUOUS_500 })
    isTrainerNameTaken.mockResolvedValue(false)

    const result = await registerAction({}, registerForm())

    expect(result.error).toBe(NETWORK_ERROR_MESSAGE)
    expect(result.fieldErrors).toBeUndefined()
  })

  it('hält AC-2: derselbe 500 wird zum Feldfehler, wenn der Name vergeben ist', async () => {
    signUp.mockResolvedValue({ error: AMBIGUOUS_500 })
    isTrainerNameTaken.mockResolvedValue(true)

    const result = await registerAction({}, registerForm())

    expect(result.fieldErrors?.trainerName).toBe('Dieser Trainername ist bereits vergeben.')
    expect(result.error).toBeUndefined()
  })

  it('fragt gar nicht erst nach, wenn der Fehler eindeutig ist (AC-3)', async () => {
    signUp.mockResolvedValue({ error: { status: 422, code: 'user_already_exists' } })

    const result = await registerAction({}, registerForm())

    expect(isTrainerNameTaken).not.toHaveBeenCalled()
    expect(result.fieldErrors?.email).toBeDefined()
  })

  it('zählt vor dem Registrieren und bricht bei Abweisung ab (AC-8)', async () => {
    registerAttempt.mockResolvedValue({ allowed: false, blockedBy: 'connection' })

    const result = await registerAction({}, registerForm())

    expect(signUp).not.toHaveBeenCalled()
    expect(isTrainerNameTaken).not.toHaveBeenCalled()
    expect(result.error).toBeDefined()
  })
})

describe('Die Sperrmeldung folgt der Ursache (BUG-67, BUG-75)', () => {
  function loginForm() {
    const fd = new FormData()
    fd.set('email', 'ash@example.com')
    fd.set('password', 'LangGenug1')
    return fd
  }

  function resetForm() {
    const fd = new FormData()
    fd.set('email', 'ash@example.com')
    return fd
  }

  it('zeigt beim Login die Adress-Meldung, wenn der Konto-Zähler sperrte', async () => {
    registerAttempt.mockResolvedValue({ allowed: false, blockedBy: 'account' })

    const result = await loginAction({}, loginForm())

    expect(result.error).toBe(THROTTLED_ACCOUNT_MESSAGE)
  })

  it('zeigt beim Login weiterhin die Verbindungs-Meldung, wenn die IP sperrte', async () => {
    registerAttempt.mockResolvedValue({ allowed: false, blockedBy: 'connection' })

    const result = await loginAction({}, loginForm())

    expect(result.error).toBe(THROTTLED_MESSAGE)
  })

  it('zeigt beim Passwort-Reset die Adress-Meldung, wenn der Konto-Zähler sperrte (AC-19)', async () => {
    registerAttempt.mockResolvedValue({ allowed: false, blockedBy: 'account' })

    const result = await requestPasswordResetAction({}, resetForm())

    expect(result.error).toBe(THROTTLED_ACCOUNT_MESSAGE)
  })

  it('zeigt bei der Registrierung die Adress-Meldung, wenn der Konto-Zähler sperrte', async () => {
    registerAttempt.mockResolvedValue({ allowed: false, blockedBy: 'account' })

    const result = await registerAction({}, registerForm())

    expect(result.error).toBe(THROTTLED_ACCOUNT_MESSAGE)
  })
})

describe('updatePasswordAction — benutzt die eigene Zuordnung (BUG-66, BUG-75)', () => {
  /**
   * Zweiter Wächter: rot, sobald der Aufruf von `mapUpdatePasswordError` durch
   * die pauschale Netzwerkmeldung ersetzt wird.
   */
  it('meldet ein unverändertes Passwort am Feld, nicht als Verbindungsfehler', async () => {
    updateUser.mockResolvedValue({ error: { status: 422, code: 'same_password' } })

    const result = await updatePasswordAction({}, passwordForm())

    expect(result.fieldErrors?.password).toBe(SAME_PASSWORD_MESSAGE)
    expect(result.error).toBeUndefined()
  })

  it('meldet eine echte Störung weiterhin als Störung', async () => {
    updateUser.mockResolvedValue({ error: { status: 500 } })

    const result = await updatePasswordAction({}, passwordForm())

    expect(result.error).toBe(NETWORK_ERROR_MESSAGE)
    expect(result.fieldErrors).toBeUndefined()
  })
})
