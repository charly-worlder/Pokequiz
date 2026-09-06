import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Die erste Stufe des Wächters für BUG-87 (spec.md AC-10, EC-3).
 *
 * **Was hier geprüft wird und was ausdrücklich nicht.** Diese Tests belegen, dass
 * die Normalisierung *versucht*, was sie verspricht: kein Cookie-Schreibvorgang,
 * kein durchgelassener Fehler, immer dasselbe Ergebnis. Sie können **nicht**
 * belegen, dass die ausgehende HTTP-Antwort tatsächlich identisch ist — genau
 * diese Verwechslung war BUG-87. Dafür gibt es die zweite Stufe:
 * `tests/PROJ-1-reset-response.spec.ts` vergleicht Status und alle
 * `Set-Cookie`-Kopfzeilen an der echten Antwort.
 *
 * Beide Stufen zusammen, nicht eine davon.
 */

const { resetPasswordForEmail, cookieSet, createServerClient } = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  cookieSet: vi.fn(),
  createServerClient: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({ createServerClient }))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => null }),
  cookies: async () => ({ getAll: () => [], set: cookieSet }),
}))
vi.mock('server-only', () => ({}))

import { requestPasswordResetIdentically, RESET_REQUEST_RESPONSE } from './reset-response'
import { RESET_CONFIRMATION_MESSAGE } from './error-mapping'

/** Führt den Cookie-Adapter aus, den der Client bekommen hat. */
function adapterSetzeCookie() {
  const optionen = createServerClient.mock.calls.at(-1)?.[2]
  optionen.cookies.setAll([{ name: 'sb-probe', value: '', options: { maxAge: 0 } }])
}

beforeEach(() => {
  vi.clearAllMocks()
  createServerClient.mockReturnValue({ auth: { resetPasswordForEmail } })
  resetPasswordForEmail.mockResolvedValue({ error: null })
})

describe('requestPasswordResetIdentically (BUG-87)', () => {
  it('antwortet bei Erfolg mit der Bestätigung', async () => {
    const r = await requestPasswordResetIdentically('a@b.de', 'http://x/reset-password')

    expect(r).toEqual({ message: RESET_CONFIRMATION_MESSAGE })
  })

  it('antwortet identisch, wenn Supabase einen Fehler zurückgibt', async () => {
    resetPasswordForEmail.mockResolvedValue({
      error: { status: 429, code: 'over_email_send_rate_limit' },
    })

    const r = await requestPasswordResetIdentically('a@b.de', 'http://x/reset-password')

    expect(r).toEqual(RESET_REQUEST_RESPONSE)
  })

  /**
   * Der geworfene Fehler ist der zweite Kanal: Er würde als anderer Status-Code
   * sichtbar. Er darf diese Funktion nicht verlassen.
   */
  it('lässt auch einen geworfenen Fehler nicht nach außen', async () => {
    resetPasswordForEmail.mockRejectedValue(new Error('Netzwerk weg'))

    await expect(
      requestPasswordResetIdentically('a@b.de', 'http://x/reset-password')
    ).resolves.toEqual(RESET_REQUEST_RESPONSE)
  })

  it('antwortet identisch, wenn schon der Client nicht entsteht', async () => {
    createServerClient.mockImplementation(() => {
      throw new Error('kein Schlüssel')
    })

    await expect(
      requestPasswordResetIdentically('a@b.de', 'http://x/reset-password')
    ).resolves.toEqual(RESET_REQUEST_RESPONSE)
  })

  /**
   * Der dritte Kanal, und der, an dem BUG-87 hing: `@supabase/ssr` schreibt auch
   * im Fehlerfall Cookies — bei einem 429 löscht es die PKCE-`code-verifier`.
   * Auf diesem Pfad darf **kein** Schreibvorgang die Antwort erreichen.
   */
  it('reicht keinen Cookie-Schreibvorgang an die Antwort weiter', async () => {
    await requestPasswordResetIdentically('a@b.de', 'http://x/reset-password')

    adapterSetzeCookie()

    expect(cookieSet).not.toHaveBeenCalled()
  })

  it('gibt jedes Mal dasselbe Ergebnis zurück, über alle Ausgänge hinweg', async () => {
    const ausgaenge = [
      () => resetPasswordForEmail.mockResolvedValue({ error: null }),
      () => resetPasswordForEmail.mockResolvedValue({ error: { status: 429 } }),
      () => resetPasswordForEmail.mockResolvedValue({ error: { status: 500 } }),
      () => resetPasswordForEmail.mockRejectedValue(new Error('weg')),
    ]

    const antworten: string[] = []
    for (const ausgang of ausgaenge) {
      ausgang()
      antworten.push(
        JSON.stringify(await requestPasswordResetIdentically('a@b.de', 'http://x/reset-password'))
      )
    }

    expect(new Set(antworten).size).toBe(1)
  })
})
