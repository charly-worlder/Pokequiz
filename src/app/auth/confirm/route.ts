import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'

// Redeems the emailed recovery link (spec.md AC-11, AC-12, EC-7).
//
// The email template points here with `{{ .TokenHash }}` instead of using
// Supabase's default link. That is the whole point of this route: the default
// link runs PKCE, whose `code_verifier` lives in a cookie on the device that
// requested the reset. Opening the mail on a phone after requesting it on a
// laptop therefore failed — and reported an expired link when the link was
// fine (BUG-6). A token_hash is bound to the account, not to the browser, so
// verifyOtp works from anywhere.
//
// design.md → Technical Decisions (2026-09-03) has the full trace.

// Only same-origin, non-protocol-relative paths. Without this check `next` is
// an open redirect: the link arrives by email, so an attacker who can get a
// victim to request a reset could otherwise bounce them to another host from a
// URL that starts with our own domain.
function safeNext(next: string | null): string {
  if (!next) return '/reset-password'
  if (!next.startsWith('/') || next.startsWith('//')) return '/reset-password'
  return next
}

// Redirects with a RELATIVE Location, deliberately.
//
// The first version built an absolute URL from `request.nextUrl`, and that
// resolved to `localhost:3000` no matter which host the request actually
// arrived on. The emailed link carries the host from Supabase's Site URL
// (`127.0.0.1:3000` locally), so the session cookie was set on one host and the
// browser was then sent to another, which never receives it — every reset ended
// on "link invalid or expired" (BUG-16). It survived the build's own check only
// because that check called this route on localhost instead of following the
// link as the mail delivers it.
//
// A relative Location is resolved by the browser against the URL it requested,
// so the flow stays on whatever host the user opened — no assumption about the
// deployment's hostname, and none of the Host-header trust a reconstructed
// origin would need. `safeNext` guarantees the value is a single-slash path, so
// it can never become protocol-relative.
function redirectTo(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNext(searchParams.get('next'))

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })

    if (!error) {
      // verifyOtp wrote the session cookies through next/headers, so they ride
      // along on whatever response this handler returns.
      return redirectTo(next)
    }
  }

  // Missing, malformed, expired or already-used token — the reset page renders
  // the AC-12 state from this flag.
  return redirectTo('/reset-password?error=1')
}
