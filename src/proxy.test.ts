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
