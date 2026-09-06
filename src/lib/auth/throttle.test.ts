import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Drosselung der Zugangsdaten-Pfade (BUG-29).
 *
 * Was hier **nicht** geprüft wird, weil es nicht hierher gehört: dass der Zähler
 * in der Datenbank richtig zählt und unter Gleichzeitigkeit hält. Das entscheidet
 * ein einziges SQL-Statement (`0003_auth_throttle.sql`), und ein Test mit einem
 * gemockten Client würde davon nur die Mock-Antwort bestätigen. Belegt wurde es
 * gegen die laufende Datenbank: 10 parallele Versuche bei Limit 5 → genau 5
 * erlaubt, 5 abgelehnt; und der Browser-Schlüssel bekommt auf die Funktion
 * `42501 permission denied`.
 *
 * Hier steht die Logik davor: welche Schlüssel gebildet werden, dass **beide**
 * Zähler laufen, und dass ein Fehler nicht stillschweigend durchwinkt.
 */

const { rpc, createAdminClient, headerGet } = vi.hoisted(() => ({
  rpc: vi.fn(),
  createAdminClient: vi.fn(),
  headerGet: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))
vi.mock('next/headers', () => ({ headers: async () => ({ get: headerGet }) }))
vi.mock('server-only', () => ({}))

import { registerAttempt, settleSuccessfulLogin, LIMITS } from './throttle'

beforeEach(() => {
  vi.clearAllMocks()
  createAdminClient.mockReturnValue({ rpc })
  rpc.mockResolvedValue({ data: true, error: null })
  headerGet.mockImplementation((name: string) => (name === 'x-forwarded-for' ? '1.2.3.4' : null))
})

/** Die Argumente aller `register_auth_attempt`-Aufrufe, nach Schlüssel sortiert. */
const keysUsed = () =>
  rpc.mock.calls.filter((c) => c[0] === 'register_auth_attempt').map((c) => c[1].p_key).sort()

describe('Grenzwerte', () => {
  it('entsprechen docs/production/rate-limiting.md', () => {
    // Login/Register: 5 pro Minute · Passwort-Reset: 3 pro 5 Minuten.
    expect(LIMITS.credentialsPerIp).toEqual({ limit: 5, windowSeconds: 60 })
    expect(LIMITS.passwordResetPerIp).toEqual({ limit: 3, windowSeconds: 300 })
  })

  it('fasst den Konto-Zähler bewusst weiter als den IP-Zähler', () => {
    // Der Kompromiss aus design.md: Ein enger Konto-Zähler macht jedes Konto
    // aussperrbar, solange es kein CAPTCHA gibt. Bricht jemand diese Beziehung,
    // soll er die Begründung dort lesen, statt es beiläufig zu ändern.
    expect(LIMITS.credentialsPerAccount.limit).toBeGreaterThan(LIMITS.credentialsPerIp.limit)
    expect(LIMITS.credentialsPerAccount.windowSeconds).toBeGreaterThan(
      LIMITS.credentialsPerIp.windowSeconds
    )
  })
})

describe('registerAttempt', () => {
  it('zählt IP und Konto getrennt', async () => {
    await registerAttempt('login', 'Spieler@Example.COM')

    expect(keysUsed()).toEqual([
      'login:account:spieler@example.com', // Adresse kleingeschrieben — sonst zwei Zähler für dasselbe Konto
      'login:ip:1.2.3.4',
    ])
  })

  it('zählt beide auch dann, wenn der erste schon ablehnt', async () => {
    // Sonst könnte ein Angreifer den Konto-Zähler leer halten, indem er den
    // IP-Zähler absichtlich überlaufen lässt.
    rpc.mockResolvedValue({ data: false, error: null })

    const { allowed } = await registerAttempt('login', 'a@b.de')

    expect(allowed).toBe(false)
    expect(keysUsed()).toHaveLength(2)
  })

  it('lehnt ab, sobald einer der beiden Zähler ablehnt', async () => {
    rpc.mockImplementation(async (_fn: string, args: { p_key: string }) => ({
      data: !args.p_key.startsWith('login:account:'),
      error: null,
    }))

    expect((await registerAttempt('login', 'a@b.de')).allowed).toBe(false)
  })

  it('nimmt für den Passwort-Reset den engeren Grenzwert', async () => {
    await registerAttempt('password-reset', 'a@b.de')

    const ipCall = rpc.mock.calls.find((c) => c[1].p_key.startsWith('password-reset:ip:'))
    expect(ipCall?.[1]).toMatchObject({ p_limit: 3, p_window_seconds: 300 })
  })

  it('zählt ohne Adresse nur die IP', async () => {
    await registerAttempt('login', null)
    expect(keysUsed()).toEqual(['login:ip:1.2.3.4'])
  })

  it('nimmt aus einer Proxy-Kette den ersten Eintrag', async () => {
    headerGet.mockImplementation((name: string) =>
      name === 'x-forwarded-for' ? '9.9.9.9, 10.0.0.1, 10.0.0.2' : null
    )
    await registerAttempt('login', null)
    expect(keysUsed()).toEqual(['login:ip:9.9.9.9'])
  })

  // Eine Drosselung, die im Fehlerfall stillschweigend aufmacht, ist genau dann
  // nicht da, wenn etwas nicht stimmt — fehlende Migration, Datenbank weg.
  it('wirft bei einem Datenbankfehler, statt durchzuwinken', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'relation does not exist' } })

    await expect(registerAttempt('login', 'a@b.de')).rejects.toThrow(/nicht zählbar/)
  })
})

describe('Welcher Zähler abgewiesen hat (BUG-67, EC-4)', () => {
  /** Lässt genau die Schlüssel scheitern, auf die `trifft` zutrifft. */
  const sperre = (trifft: (key: string) => boolean) =>
    rpc.mockImplementation((fn: string, args: { p_key: string }) =>
      Promise.resolve({ data: fn === 'register_auth_attempt' ? !trifft(args.p_key) : true, error: null })
    )

  it('nennt die Verbindung, wenn nur der IP-Zähler sperrt', async () => {
    sperre((k) => k.includes(':ip:'))

    const r = await registerAttempt('login', 'a@b.de')

    expect(r.allowed).toBe(false)
    expect(r.blockedBy).toBe('connection')
  })

  /**
   * Der eigentliche Befund aus BUG-67: Hier kommt der rechtmäßige Besitzer von
   * einer **unbelasteten** Verbindung und wurde trotzdem auf sie verwiesen.
   */
  it('nennt die Adresse, wenn nur der Konto-Zähler sperrt', async () => {
    sperre((k) => k.includes(':account:'))

    const r = await registerAttempt('login', 'a@b.de')

    expect(r.allowed).toBe(false)
    expect(r.blockedBy).toBe('account')
  })

  it('nennt bei doppelter Sperre die Adresse — ihr Fenster ist das längere', async () => {
    sperre(() => true)

    expect((await registerAttempt('login', 'a@b.de')).blockedBy).toBe('account')
  })

  it('meldet ohne Sperre keine Ursache', async () => {
    sperre(() => false)

    const r = await registerAttempt('login', 'a@b.de')

    expect(r.allowed).toBe(true)
    expect(r.blockedBy).toBeNull()
  })

  it('kann ohne Adresse nur die Verbindung nennen (AC-20)', async () => {
    sperre(() => true)

    expect((await registerAttempt('token-confirm', null)).blockedBy).toBe('connection')
  })

  it('zählt beide weiter, auch wenn schon einer sperrt', async () => {
    sperre((k) => k.includes(':ip:'))

    await registerAttempt('login', 'a@b.de')

    expect(keysUsed()).toEqual(['login:account:a@b.de', 'login:ip:1.2.3.4'])
  })
})

describe('Grenzwerte je Vorgang (AC-19, AC-20)', () => {
  /**
   * Bis BUG-76 nahm `registerAttempt` für **jeden** Vorgang
   * `credentialsPerAccount`. Das war kein Entschluss, sondern der Login-Wert, der
   * mitgalt — und beim Reset begrenzt derselbe Zähler etwas ganz anderes: Mails
   * an eine fremde Adresse statt Raten am eigenen Konto.
   */
  it('nimmt für den Passwort-Reset die eigene, engere Konto-Grenze', async () => {
    await registerAttempt('password-reset', 'a@b.de')

    const accountCall = rpc.mock.calls.find((c) => c[1].p_key.includes(':account:'))
    expect(accountCall?.[1].p_limit).toBe(LIMITS.passwordResetPerAccount.limit)
    expect(accountCall?.[1].p_window_seconds).toBe(LIMITS.passwordResetPerAccount.windowSeconds)
  })

  it('nimmt für den Login weiterhin die weitere Konto-Grenze', async () => {
    await registerAttempt('login', 'a@b.de')

    const accountCall = rpc.mock.calls.find((c) => c[1].p_key.includes(':account:'))
    expect(accountCall?.[1].p_limit).toBe(LIMITS.credentialsPerAccount.limit)
  })

  it('begrenzt den Reset am Konto enger als den Login', () => {
    const proStunde = (l: { limit: number; windowSeconds: number }) =>
      (l.limit * 3600) / l.windowSeconds

    expect(proStunde(LIMITS.passwordResetPerAccount)).toBeLessThan(
      proStunde(LIMITS.credentialsPerAccount)
    )
  })

  it('zählt die Token-Einlösung mit eigenem Schlüssel und eigener Grenze (AC-20)', async () => {
    await registerAttempt('token-confirm', null)

    expect(keysUsed()).toEqual(['token-confirm:ip:1.2.3.4'])
    expect(rpc.mock.calls[0][1].p_limit).toBe(LIMITS.tokenConfirmPerIp.limit)
    expect(rpc.mock.calls[0][1].p_window_seconds).toBe(LIMITS.tokenConfirmPerIp.windowSeconds)
  })
})

describe('settleSuccessfulLogin', () => {
  it('löscht den Konto-Zähler ganz', async () => {
    await settleSuccessfulLogin('Spieler@Example.COM')

    expect(rpc).toHaveBeenCalledWith('clear_auth_attempts', {
      p_keys: ['login:account:spieler@example.com'],
    })
  })

  // Die beiden Fehler, zwischen denen diese Zusage liegt, waren beide ein
  // Zuviel bzw. Zuwenig an genau dieser Stelle: BUG-39 löschte den IP-Zähler
  // (Angreifer konnte sich selbst freischalten), der Fix dafür ließ ihn stehen
  // (BUG-54, geteilte Anschlüsse sperrten legitime Spieler aus). Richtig ist
  // **genau ein** erstatteter Versuch — deshalb steht hier die Menge, nicht nur
  // die Tatsache.
  it('erstattet auf dem IP-Zähler genau einen Versuch (BUG-54)', async () => {
    headerGet.mockImplementation((name: string) =>
      name === 'x-forwarded-for' ? '203.0.113.9' : null
    )

    await settleSuccessfulLogin('spieler@example.com')

    const refunds = rpc.mock.calls.filter((c) => c[0] === 'refund_auth_attempt')
    expect(refunds).toHaveLength(1)
    expect(refunds[0][1]).toEqual({ p_key: 'login:ip:203.0.113.9' })
  })

  // Die vorige Fassung dieses Tests verlangte ausdrücklich **beide** Schlüssel
  // im Löschaufruf und war damit grün, während der Fehler danebenstand: Sie
  // beschrieb, was der Code tat, statt was er leisten soll — dasselbe Muster wie
  // BUG-31 und BUG-35. Deshalb steht die Zusage zusätzlich als negative
  // Erwartung: Der IP-Schlüssel darf **nie** im Löschaufruf auftauchen, denn
  // Löschen ist etwas anderes als Erstatten (BUG-39).
  it('löscht den IP-Zähler unter keinen Umständen (BUG-39)', async () => {
    headerGet.mockImplementation((name: string) =>
      name === 'x-forwarded-for' ? '203.0.113.9' : null
    )

    await settleSuccessfulLogin('spieler@example.com')

    const cleared = rpc.mock.calls
      .filter((c) => c[0] === 'clear_auth_attempts')
      .flatMap((c) => c[1].p_keys as string[])

    expect(cleared).not.toContain('login:ip:203.0.113.9')
    expect(cleared.some((key) => key.includes(':ip:'))).toBe(false)
  })

  it('macht aus einem Fehler beim Aufräumen keinen fehlgeschlagenen Login', async () => {
    // Der Nutzer ist bereits angemeldet; ein stehengebliebener Zähler ist die
    // harmlosere Richtung als ein Wurf, der die Anmeldung wieder einreißt.
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    rpc.mockResolvedValue({ data: null, error: { message: 'weg' } })

    await expect(settleSuccessfulLogin('a@b.de')).resolves.toBeUndefined()
    expect(logged).toHaveBeenCalled()
    logged.mockRestore()
  })
})
