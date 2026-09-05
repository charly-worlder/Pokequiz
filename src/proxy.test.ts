import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Regressionstest zu BUG-3 (PROJ-2/qa-report.md).
 *
 * Der Fehler: Der Proxy prüfte die Sitzung mit `getClaims()` — nur die Signatur,
 * lokal —, während `src/app/page.tsx` mit `getUser()` den Auth-Server fragt. Eine
 * widerrufene Sitzung bestand die erste Prüfung und fiel bei der zweiten durch,
 * also schickten sich beide gegenseitig im Kreis (ERR_TOO_MANY_REDIRECTS).
 *
 * Der eigentliche Fall, den kein Test abdeckte: **Cookie vorhanden, Signatur
 * gültig, Sitzung serverseitig weg.** Genau den halten die Tests unten fest.
 */

const { getUser, getClaims, createServerClient } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getClaims: vi.fn(),
  createServerClient: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({ createServerClient }))

import { proxy } from './proxy'

/** Baut eine Anfrage mit gesetztem Auth-Cookie — der Zustand nach dem Anmelden. */
function requestWithCookie(pathname: string) {
  const request = new NextRequest(new URL(`http://localhost:3000${pathname}`))
  request.cookies.set('sb-127-auth-token', 'ein-signatur-gueltiges-aber-widerrufenes-token')
  return request
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key'
  createServerClient.mockReturnValue({ auth: { getUser, getClaims } })
})

describe('proxy — Sitzungsprüfung', () => {
  it('BUG-3: ungültige Sitzung trotz vorhandenem Cookie führt EINMAL nach /login, nicht im Kreis', async () => {
    // Der Auth-Server lehnt ab, obwohl das Cookie noch da ist.
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 403 } })

    const response = await proxy(requestWithCookie('/'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/login')
  })

  it('BUG-3: dieselbe ungültige Sitzung wird auf /login NICHT wieder weggeschickt', async () => {
    // Das ist die zweite Hälfte der Schleife: Vorher hielt getClaims() den
    // Besucher hier für angemeldet und schickte ihn zurück auf /.
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 403 } })

    const response = await proxy(requestWithCookie('/login'))

    expect(response.headers.get('location')).toBeNull()
    expect(response.status).toBe(200)
  })

  it('BUG-3: der Proxy fragt den Auth-Server und verlässt sich nicht auf die lokale Signaturprüfung', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    await proxy(requestWithCookie('/'))

    expect(getUser).toHaveBeenCalledTimes(1)
    // getClaims() darf hier nicht mehr vorkommen — es ist die Prüfung, die der
    // Seite widersprechen kann, und genau das war die Ursache.
    expect(getClaims).not.toHaveBeenCalled()
  })

  it('EC-2: ohne Sitzung wird eine geschützte Route nach /login umgeleitet', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    const response = await proxy(new NextRequest(new URL('http://localhost:3000/')))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/login')
  })

  // BUG-9 (spec.md EC-7): Next.js kodiert das `redirect()` einer Server Action
  // in-band (Status 200 plus `x-action-redirect`), gerade damit der Browser
  // keiner 307 auf eine Anmeldeseite folgt. Eine gewöhnliche Weiterleitung auf
  // einen Action-POST behandelt der Action-Handler deshalb als Protokollbruch,
  // und der Client wirft „An unexpected response was received from the server".
  //
  // Die Folge war, dass der `unauthenticated`-Zweig der Actions **unerreichbar**
  // war: Wem mitten in der Runde die Sitzung ablief, der sah einen Ergebnis-
  // Screen, der Erfolg vortäuschte, und landete nie auf /login. Die Action prüft
  // selbst — `server-actions.guard.test.ts` hält fest, dass das so bleibt.
  it('BUG-9: ein Server-Action-POST ohne Sitzung wird durchgelassen, statt umgeleitet zu werden', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    const request = new NextRequest(new URL('http://localhost:3000/'), {
      method: 'POST',
      headers: { 'next-action': '4095d024abcdef' },
    })
    const response = await proxy(request)

    expect(response.headers.get('location')).toBeNull()
    expect(response.status).not.toBe(307)
  })

  // BUG-21: Next.js bindet eine Server Action nicht an die Route, auf der sie
  // definiert wurde — jedes Action-Kennzeichen läuft unter jedem Pfad. Solange
  // die Ausnahme für *alle* geschützten Pfade galt, waren PROJ-1s loginAction
  // und registerAction unter allen erreichbar. Kein Datenabfluss, aber es
  // umgeht die naheliegende Deploy-Abwehr: eine WAF-Regel, die /login bewacht.
  it('BUG-21: ein Action-POST auf einem anderen geschützten Pfad wird weiterhin umgeleitet', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    for (const path of ['/leaderboard', '/gibtsnicht', '/irgendwas/tief']) {
      const request = new NextRequest(new URL(`http://localhost:3000${path}`), {
        method: 'POST',
        headers: { 'next-action': '6022fd5c882969a13a10f62a80b850ebc8bc41d78a' },
      })
      const response = await proxy(request)

      expect(response.status, `${path} sollte umgeleitet werden`).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/login')
    }
  })

  it('BUG-9: ein gewöhnlicher POST ohne Action-Kennzeichen wird weiterhin umgeleitet', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    const request = new NextRequest(new URL('http://localhost:3000/'), { method: 'POST' })
    const response = await proxy(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/login')
  })

  it('BUG-9: ein GET mit gefälschtem Action-Kennzeichen wird weiterhin umgeleitet', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    const request = new NextRequest(new URL('http://localhost:3000/'), {
      headers: { 'next-action': 'gefaelscht' },
    })
    const response = await proxy(request)

    expect(response.status).toBe(307)
  })

  it('AC-4: eine gültige Sitzung auf /login wird auf die Startseite geschickt', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const response = await proxy(requestWithCookie('/login'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('AC-5: eine gültige Sitzung darf die geschützte Route ohne Umleitung sehen', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const response = await proxy(requestWithCookie('/'))

    expect(response.headers.get('location')).toBeNull()
  })

  it('öffentliche Routen bleiben ohne Sitzung erreichbar', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    for (const path of ['/login', '/reset-password', '/privacy', '/imprint']) {
      const response = await proxy(new NextRequest(new URL(`http://localhost:3000${path}`)))
      expect(response.headers.get('location'), `${path} sollte erreichbar sein`).toBeNull()
    }
  })
})
