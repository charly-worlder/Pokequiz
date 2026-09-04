import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

/**
 * spec.md EC-7, AC-11, AC-12 — redeeming the recovery link server-side.
 *
 * Two things are pinned here. The first is that a token is redeemed at all
 * without any browser state, which is what makes the link work on a device
 * other than the one that asked for it (BUG-6).
 *
 * The second is the `next` guard. It is the kind of parameter that looks
 * harmless and is not: the URL arrives by email, so an unchecked `next` turns
 * our own domain into a redirector to anywhere. It has no visible symptom and
 * would survive any manual test, which is exactly why it needs a test.
 */

const { verifyOtp } = vi.hoisted(() => ({ verifyOtp: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { verifyOtp } }),
}))

const BASE = 'http://localhost:3000'

function call(query: string) {
  return GET(new NextRequest(`${BASE}/auth/confirm${query}`))
}

describe('/auth/confirm', () => {
  beforeEach(() => {
    verifyOtp.mockReset()
  })

  it('redeems a valid token and redirects to next', async () => {
    verifyOtp.mockResolvedValue({ error: null })

    const res = await call('?token_hash=abc123&type=recovery&next=/reset-password')

    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'abc123' })
    expect(res.headers.get('location')).toBe('/reset-password')
  })

  it('sends an invalid or already-used token to the AC-12 error state', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired' } })

    const res = await call('?token_hash=stale&type=recovery&next=/reset-password')

    expect(res.headers.get('location')).toBe('/reset-password?error=1')
  })

  it('does not call verifyOtp when the token is missing', async () => {
    const res = await call('')

    expect(verifyOtp).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toBe('/reset-password?error=1')
  })

  it('refuses an absolute next and stays on our own origin', async () => {
    verifyOtp.mockResolvedValue({ error: null })

    const res = await call('?token_hash=abc123&type=recovery&next=https://evil.example')

    expect(res.headers.get('location')).toBe('/reset-password')
  })

  it('refuses a protocol-relative next', async () => {
    verifyOtp.mockResolvedValue({ error: null })

    const res = await call('?token_hash=abc123&type=recovery&next=//evil.example')

    expect(res.headers.get('location')).toBe('/reset-password')
  })

  // BUG-20. The guard used to ban prefixes — https:// and // — and pass
  // everything else. `/\evil.com` walked straight through it, because browsers
  // normalise the backslash and the value becomes protocol-relative. The
  // allowlist that replaced it is checked here against the whole family of
  // encodings, not just the two that were originally imagined.
  //
  // Note these need a VALID token: with an invalid one the route takes the
  // error path and never reaches the guard at all, so the test would pass while
  // proving nothing. That is exactly how the first counter-check looked green.
  it.each([
    ['backslash', '/\\evil.example'],
    ['double backslash', '\\\\evil.example'],
    ['mixed slash and backslash', '/\\/evil.example'],
    ['absolute http', 'http://evil.example'],
    ['absolute https', 'https://evil.example'],
    ['protocol-relative', '//evil.example'],
    ['encoded protocol-relative', '%2f%2fevil.example'],
    ['tab-separated', '/\t/evil.example'],
    ['an in-app path that is not on the list', '/some/other/page'],
  ])('refuses next=%s and falls back to the reset page', async (_label, next) => {
    verifyOtp.mockResolvedValue({ error: null })

    const res = await call(`?token_hash=abc123&type=recovery&next=${encodeURIComponent(next)}`)

    expect(res.headers.get('location')).toBe('/reset-password')
  })

  // BUG-16. The first version redirected to an absolute URL built from
  // request.nextUrl, which resolved to localhost whatever host the request came
  // in on. The emailed link uses Supabase's Site URL, so the session cookie
  // landed on one host and the browser was sent to another — every reset failed
  // on a valid link. A relative Location cannot drift from the requested host,
  // and this asserts the shape rather than one particular hostname: an absolute
  // Location is the defect, regardless of which host it names.
  it.each([
    ['a request that arrives on 127.0.0.1', 'http://127.0.0.1:3000'],
    ['a request that arrives on a LAN address', 'http://192.168.0.165:3000'],
    ['a request that arrives on a production domain', 'https://quiz.example'],
  ])('keeps the redirect relative for %s', async (_label, origin) => {
    verifyOtp.mockResolvedValue({ error: null })

    const res = await GET(
      new NextRequest(`${origin}/auth/confirm?token_hash=abc123&type=recovery&next=/reset-password`)
    )

    const location = res.headers.get('location')
    expect(location).toBe('/reset-password')
    expect(location).not.toMatch(/^https?:\/\//)
  })
})
