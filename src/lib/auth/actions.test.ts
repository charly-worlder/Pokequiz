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

const {
  registerAttempt,
  settleSuccessfulLogin,
  isTrainerNameTaken,
  signUp,
  updateUser,
  getUser,
  getClaims,
  signInWithPassword,
  requestPasswordResetIdentically,
} = vi.hoisted(() => ({
  registerAttempt: vi.fn(),
  settleSuccessfulLogin: vi.fn(),
  isTrainerNameTaken: vi.fn(),
  signUp: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
  getClaims: vi.fn(),
  signInWithPassword: vi.fn(),
  requestPasswordResetIdentically: vi.fn(),
}))

vi.mock('@/lib/auth/throttle', () => ({ registerAttempt, settleSuccessfulLogin }))
vi.mock('@/lib/auth/trainer-name', () => ({ isTrainerNameTaken }))
vi.mock('@/lib/auth/reset-response', () => ({
  requestPasswordResetIdentically,
  RESET_REQUEST_RESPONSE: { message: 'bestaetigung' },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { signUp, updateUser, getUser, getClaims, signInWithPassword },
  }),
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
  INVALID_RESET_LINK_MESSAGE,
} from './error-mapping'

/** Der `amr`-Anspruch, an dem `updatePasswordAction` die Recovery-Sitzung erkennt. */
function sitzungMit(methode: string) {
  return { data: { claims: { amr: [{ method: methode, timestamp: 1 }] } } }
}

beforeEach(() => {
  vi.clearAllMocks()
  registerAttempt.mockResolvedValue({ allowed: true, blockedBy: null })
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  // Standard ist die **Recovery**-Sitzung: Die bestehenden Wächter unten prüfen
  // die Fehlerzuordnung, nicht den Sitzungstyp, und sollen daran nicht scheitern.
  getClaims.mockResolvedValue(sitzungMit('otp'))
  requestPasswordResetIdentically.mockResolvedValue({ message: 'bestaetigung' })
  // Standard ist der **fehlgeschlagene** Login: Er endet mit einer Rückgabe statt
  // mit einem Redirect, sodass ein Wächter die Verdrahtung prüfen kann, ohne den
  // Erfolgspfad mit abzuwickeln.
  signInWithPassword.mockResolvedValue({ error: { status: 400, code: 'invalid_credentials' } })
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

/**
 * Die **Verdrahtung der Drosselung** (BUG-93).
 *
 * Warum es diesen Block gibt: Der QA-Nachlauf vom 2026-09-06 hat drei Mutationen
 * gefahren, die `npm test` **und** die E2E-Suite überlebt haben — alle drei in
 * `actions.ts`, alle drei an der Stelle, an der die Drosselung *verdrahtet* wird:
 *
 * - **M1** `registerAttempt('password-reset', null)` → die Konto-Hälfte von AC-19
 *   ist tot, ohne dass etwas rot wird
 * - **M2** Scope `'login'` statt `'password-reset'` → AC-17 und AC-19 laufen
 *   plötzlich auf den Login-Grenzwerten
 * - **M3** der Zähl-Block wandert **hinter** den Versand → gezählt wird weiter,
 *   verhindert wird nichts; genau das, was AC-17/AC-19 begrenzen sollen
 *
 * `throttle.test.ts` ruft `registerAttempt` direkt mit dem richtigen Scope auf und
 * kann das nicht sehen. Hier steht deshalb nicht, **ob** der Zähler funktioniert,
 * sondern **womit er gerufen wird und wann** — dieselbe Lehre wie bei BUG-75,
 * diesmal auf die Argumente und die Reihenfolge angewandt.
 */
describe('Die Drosselung ist richtig verdrahtet (BUG-93)', () => {
  function resetForm(email = 'ash@example.com') {
    const fd = new FormData()
    fd.set('email', email)
    return fd
  }

  function loginForm() {
    const fd = new FormData()
    fd.set('email', 'ash@example.com')
    fd.set('password', 'LangGenug1')
    return fd
  }

  // Fängt M1 (Adresse → null) und M2 (Scope → 'login') zugleich.
  it('zählt den Passwort-Reset unter dem eigenen Scope und mit der Adresse (M1, M2)', async () => {
    await requestPasswordResetAction({}, resetForm())

    expect(registerAttempt).toHaveBeenCalledWith('password-reset', 'ash@example.com')
  })

  /**
   * Fängt M3. Die Reihenfolge ist die eigentliche Zusage von AC-17/AC-19:
   * „Begrenzt ist der Versand selbst." Ein Zähler, der erst hinterher zählt,
   * erfüllt den Wortlaut und verfehlt den Zweck.
   */
  it('verschickt nichts mehr, sobald die Drosselung abgewiesen hat (M3)', async () => {
    registerAttempt.mockResolvedValue({ allowed: false, blockedBy: 'account' })

    await requestPasswordResetAction({}, resetForm())

    expect(requestPasswordResetIdentically).not.toHaveBeenCalled()
  })

  it('zählt den Login unter dem Login-Scope und mit der Adresse', async () => {
    await loginAction({}, loginForm())

    expect(registerAttempt).toHaveBeenCalledWith('login', 'ash@example.com')
  })

  it('zählt die Registrierung unter dem Register-Scope und mit der Adresse', async () => {
    await registerAction({}, registerForm())

    expect(registerAttempt).toHaveBeenCalledWith('register', 'ash@example.com')
  })

  it('zählt das Setzen des Passworts unter dem eigenen Scope (BUG-91)', async () => {
    await updatePasswordAction({}, passwordForm())

    expect(registerAttempt).toHaveBeenCalledWith('password-update', null)
  })
})

/**
 * **BUG-91** — `updatePasswordAction` war der einzige Zugangsdaten-Pfad, der
 * jede beliebige Sitzung akzeptierte und überhaupt nicht zählte. Gemessen am
 * 2026-09-06: Mit einer gewöhnlichen Login-Sitzung ließ sich das Passwort setzen,
 * ohne das alte zu kennen (danach war das alte ungültig und das neue gültig), und
 * 12 Aufrufe von einer Verbindung wurden alle durchgelassen.
 */
describe('updatePasswordAction verlangt eine Recovery-Sitzung und zählt (BUG-91)', () => {
  it('lehnt eine gewöhnliche Login-Sitzung ab, ohne das Passwort zu ändern', async () => {
    getClaims.mockResolvedValue(sitzungMit('password'))

    const result = await updatePasswordAction({}, passwordForm())

    expect(result.error).toBe(INVALID_RESET_LINK_MESSAGE)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('lehnt auch eine Sitzung ohne jeden amr-Anspruch ab', async () => {
    getClaims.mockResolvedValue({ data: { claims: {} } })

    const result = await updatePasswordAction({}, passwordForm())

    expect(result.error).toBe(INVALID_RESET_LINK_MESSAGE)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('lässt die Recovery-Sitzung durch', async () => {
    getClaims.mockResolvedValue(sitzungMit('otp'))
    updateUser.mockResolvedValue({ error: null })

    await expect(updatePasswordAction({}, passwordForm())).rejects.toThrow('REDIRECT:/')
    expect(updateUser).toHaveBeenCalled()
  })

  it('weist ab, sobald die Drosselung greift — vor jedem Supabase-Aufruf', async () => {
    registerAttempt.mockResolvedValue({ allowed: false, blockedBy: 'connection' })

    const result = await updatePasswordAction({}, passwordForm())

    expect(result.error).toBe(THROTTLED_MESSAGE)
    expect(getUser).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })
})
