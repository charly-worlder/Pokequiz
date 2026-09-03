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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNext(searchParams.get('next'))

  const redirectTo = request.nextUrl.clone()
  redirectTo.search = ''

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })

    if (!error) {
      // verifyOtp has written the session cookies onto this response's jar.
      redirectTo.pathname = next
      return NextResponse.redirect(redirectTo)
    }
  }

  // Missing, malformed, expired or already-used token — the reset page renders
  // the AC-12 state from this flag.
  redirectTo.pathname = '/reset-password'
  redirectTo.searchParams.set('error', '1')
  return NextResponse.redirect(redirectTo)
}
