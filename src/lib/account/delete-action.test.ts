import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  createSupabaseClient: vi.fn(),
  registerAttempt: vi.fn(),
  refundAccountDeleteAttempt: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createSupabaseClient }))
vi.mock('@/lib/auth/throttle', () => ({
  registerAttempt: mocks.registerAttempt,
  refundAccountDeleteAttempt: mocks.refundAccountDeleteAttempt,
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { deleteAccountAction } from './delete-action'
import { WRONG_PASSWORD_MESSAGE, DELETE_FAILED_MESSAGE } from '@/lib/auth/error-mapping'

/**
 * Was hier geprüft wird, ist die **Reihenfolge und die Verdrahtung** — die
 * Wirkung auf die Datenbank prüft `tests/PROJ-4-deletion-cascade.spec.ts` gegen
 * echte Zeilen. Fünf Zusagen, die sich nur hier festnageln lassen:
 *
 *   1. Die zu löschende Kennung stammt aus der Sitzung, nie aus dem Formular
 *      (AC-16) — und es gibt kein Feld, über das sie hereinkäme.
 *   2. Gedrosselt wird **vor** der Passwortprüfung, beide Hälften (AC-15).
 *   3. Hart gelöscht, nicht weich — sonst brechen AC-13 und AC-17.
 *   4. Erstattet wird **nur** hinter der bestandenen Passwortprüfung; ein
 *      falsches Passwort bekommt seinen Versuch nicht zurück.
 *   5. Die Sitzung wird örtlich beendet, ohne den Auth-Dienst zu fragen.
 */

const USER = { id: 'user-echt', email: 'ich@example.de' }

function setup(
  options: {
    user?: { id: string; email: string } | null
    throttle?: { allowed: boolean; blockedBy: 'connection' | 'account' | null }[]
    passwordOk?: boolean
    deleteError?: { message: string; status?: number; code?: string } | null
  } = {}
) {
  const {
    user = USER,
    throttle = [
      { allowed: true, blockedBy: null },
      { allowed: true, blockedBy: null },
    ],
    passwordOk = true,
    deleteError = null,
  } = options

  const calls: string[] = []
  const deleteUser = vi.fn(async (id: string, soft?: boolean) => {
    calls.push(`delete:${id}:soft=${String(soft)}`)
    return { error: deleteError }
  })
  const signOut = vi.fn(async (opts?: { scope?: string }) => {
    calls.push(`signOut:${opts?.scope ?? 'default'}`)
    return { error: null }
  })

  const queue = [...throttle]
  mocks.registerAttempt.mockImplementation(async (_scope: string, email: string | null) => {
    calls.push(`throttle:${email ?? 'ip-only'}`)
    return queue.shift() ?? { allowed: true, blockedBy: null }
  })

  mocks.refundAccountDeleteAttempt.mockImplementation(async () => {
    calls.push('refund')
  })

  mocks.createClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }), signOut },
  })
  mocks.createAdminClient.mockReturnValue({ auth: { admin: { deleteUser } } })
  mocks.createSupabaseClient.mockReturnValue({
    auth: {
      signInWithPassword: async () => {
        calls.push('passwordCheck')
        return { error: passwordOk ? null : { message: 'invalid' } }
      },
    },
  })

  return { calls, deleteUser, signOut }
}

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.append(key, value)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
})

describe('deleteAccountAction', () => {
  it('löscht das Konto der Sitzung — hart, und meldet sich ab', async () => {
    const { calls, deleteUser } = setup()

    await expect(deleteAccountAction({}, form({ password: 'richtig' }))).rejects.toThrow(
      'REDIRECT:/login?geloescht=1'
    )

    // `false` ausdrücklich: Eine weiche Löschung behielte die Auth-Zeile und
    // damit den Personenbezug (AC-17) und die belegte Adresse (AC-13).
    expect(deleteUser).toHaveBeenCalledWith('user-echt', false)
    expect(calls).toContain('signOut:local')
  })

  it('nimmt die Kennung aus der Sitzung, nicht aus dem Formular (AC-16)', async () => {
    const { deleteUser } = setup()

    // Ein Angreifer schiebt jedes denkbare Feld unter. Die Action liest keines
    // davon — sie hat gar keinen Parameter dafür.
    await expect(
      deleteAccountAction(
        {},
        form({
          password: 'richtig',
          userId: 'fremdes-opfer',
          id: 'fremdes-opfer',
          email: 'opfer@example.de',
        })
      )
    ).rejects.toThrow('REDIRECT:/login?geloescht=1')

    expect(deleteUser).toHaveBeenCalledWith('user-echt', false)
    expect(deleteUser).not.toHaveBeenCalledWith('fremdes-opfer', expect.anything())
  })

  it('zählt genau einmal, und zwar vor der Passwortprüfung (AC-15)', async () => {
    const { calls } = setup()

    await expect(deleteAccountAction({}, form({ password: 'richtig' }))).rejects.toThrow()

    // Vor der Prüfung — das ist der Sinn der Drosselung.
    expect(calls.indexOf('throttle:ich@example.de')).toBeLessThan(calls.indexOf('passwordCheck'))

    // **Genau einmal.** `registerAttempt` zählt die Verbindung immer mit; ein
    // zweiter Aufruf (etwa „erst IP, dann Konto") zählt sie doppelt und
    // halbiert ihre Grenze still. Beim Bau stand genau das hier — der
    // E2E-Grenzwerttest hat es gefunden, dieser Test hält es fest.
    expect(calls.filter((call) => call.startsWith('throttle:'))).toEqual([
      'throttle:ich@example.de',
    ])
  })

  it('weist bei überschrittener Drosselung ab, ohne das Passwort zu prüfen', async () => {
    const { calls, deleteUser } = setup({
      throttle: [{ allowed: false, blockedBy: 'connection' }],
    })

    const result = await deleteAccountAction({}, form({ password: 'richtig' }))

    expect(result.error).toContain('Zu viele Versuche')
    expect(calls).not.toContain('passwordCheck')
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('löscht bei falschem Passwort nichts und erstattet nichts (AC-11)', async () => {
    const { calls, deleteUser } = setup({ passwordOk: false })

    const result = await deleteAccountAction({}, form({ password: 'falsch' }))

    expect(result.fieldErrors?.password).toBe(WRONG_PASSWORD_MESSAGE)
    expect(deleteUser).not.toHaveBeenCalled()
    // Der Kern der Abwägung: Wer das Passwort nicht kennt, bekommt seinen
    // Versuch **nicht** zurück. Sonst wäre der Zähler wirkungslos.
    expect(calls).not.toContain('refund')
  })

  it('erstattet genau dann, wenn das Passwort stimmte und die Löschung scheiterte', async () => {
    const { calls } = setup({ deleteError: { message: 'db weg' } })

    const result = await deleteAccountAction({}, form({ password: 'richtig' }))

    expect(result.error).toBe(DELETE_FAILED_MESSAGE)
    expect(calls).toContain('refund')
    // Und die Meldung sagt ausdrücklich, dass es **nicht** am Passwort lag —
    // sonst tippt der Nutzer sein richtiges Passwort neu ein.
    expect(result.error).toContain('nicht wegen deines Passworts')
    expect(result.fieldErrors).toBeUndefined()
  })

  /**
   * **BUG-4-32.** Zwei gleichzeitige Aufrufe: Beide kommen an Sitzungs- und
   * Passwortprüfung vorbei, einer gewinnt. Der Verlierer bekam bis zum
   * 2026-09-10 „Dein Konto ist unverändert" — während es gelöscht war. Eine
   * falsche Auskunft bei einer unumkehrbaren Handlung, und EC-1 verlangt
   * ausdrücklich *keine* Fehlermeldung.
   */
  it('behandelt „war schon weg" als Erfolg, nicht als Fehler (EC-1)', async () => {
    const { calls } = setup({ deleteError: { message: 'User not found', status: 404 } })

    await expect(deleteAccountAction({}, form({ password: 'richtig' }))).rejects.toThrow(
      'REDIRECT:/login?geloescht=1'
    )

    // Derselbe Ausgang wie beim Gewinner: abgemeldet, Bestätigung.
    expect(calls).toContain('signOut:local')
    // **Keine Erstattung** — es gibt nichts zu wiederholen.
    expect(calls).not.toContain('refund')
  })

  it('erkennt „war schon weg" auch am Fehlercode statt am Status (EC-1)', async () => {
    // `status` und `code` stammen aus zwei Ebenen der Bibliothek; fällt eine
    // weg, muss die andere weiter tragen.
    setup({ deleteError: { message: 'User not found', code: 'user_not_found' } })

    await expect(deleteAccountAction({}, form({ password: 'richtig' }))).rejects.toThrow(
      'REDIRECT:/login?geloescht=1'
    )
  })

  it('unterscheidet den echten Fehlschlag weiterhin davon (EC-3)', async () => {
    // Abgrenzung: Ein Datenbankfehler ist **kein** „war schon weg" — hier muss
    // die technische Meldung kommen und der Versuch erstattet werden.
    const { calls } = setup({ deleteError: { message: 'connection refused', status: 500 } })

    const result = await deleteAccountAction({}, form({ password: 'richtig' }))

    expect(result.error).toBe(DELETE_FAILED_MESSAGE)
    expect(calls).toContain('refund')
    expect(calls).not.toContain('signOut:local')
  })

  it('meldet sich bei fehlender Sitzung ab, statt zu scheitern (EC-1, EC-4)', async () => {
    const { deleteUser } = setup({ user: null })

    await expect(deleteAccountAction({}, form({ password: 'egal' }))).rejects.toThrow(
      'REDIRECT:/login'
    )
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('verlangt überhaupt ein Passwort (AC-9)', async () => {
    const { calls } = setup()

    const result = await deleteAccountAction({}, form({}))

    expect(result.fieldErrors?.password).toBeTruthy()
    // Ohne Eingabe wird nicht einmal gezählt — sonst könnte man den Zähler
    // eines Kontos mit leeren Anfragen füllen.
    expect(calls).toHaveLength(0)
  })
})
