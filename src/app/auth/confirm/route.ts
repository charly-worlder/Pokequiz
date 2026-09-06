import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { registerAttempt } from '@/lib/auth/throttle'

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

// Where this route is allowed to send someone, as an explicit list.
//
// The previous version banned prefixes instead — it rejected `https://` and
// `//` and let everything else through. `/\evil.com` slipped past it: browsers
// normalise the backslash to a slash, so the value becomes protocol-relative
// and points at another host (BUG-20). The tests covered exactly the two
// variants that had been thought of while writing them, which is the failure
// mode of every ban list: it only ever knows the attacks its author imagined.
//
// An allowlist inverts that. Anything not named here goes to the reset page,
// whatever clever encoding it uses. Adding a destination is a deliberate edit.
const ALLOWED_NEXT = ['/reset-password'] as const

function safeNext(next: string | null): string {
  return ALLOWED_NEXT.includes(next as (typeof ALLOWED_NEXT)[number])
    ? (next as string)
    : '/reset-password'
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

  // spec.md AC-20 — gezählt wird, **bevor** der Token beim Auth-Dienst landet.
  //
  // Diese Route war die einzige Stelle der App, die ein Credential prüft und
  // nicht zählt: Die Drosselung sitzt bewusst in den Server Actions, und eine
  // Route ist keine Action. Gemessen im QA-Lauf vom 2026-09-05: 40 Einlösungen
  // von einer Verbindung, null abgewiesen (BUG-71).
  //
  // Der Zweck ist ausdrücklich nicht, das Erraten des Tokens zu verhindern — der
  // ist zu lang dafür. Der Zweck ist, dass niemand Supabases gemeinsames
  // `token_verifications`-Kontingent leerlaufen lassen kann: Weil die App nur
  // über Server Actions mit Supabase spricht, sieht dieses Limit für alle Spieler
  // dieselbe Server-IP (BUG-21). Wer es erschöpft, sperrt den Passwort-Reset für
  // alle — und der ist laut docs/PRD.md der einzige Weg zurück ins Konto.
  //
  // Keine E-Mail-Adresse: Die verrät der Token erst nach der Prüfung. Gezählt
  // wird deshalb nur die Verbindung.
  if (!(await registerAttempt('token-confirm', null)).allowed) {
    // Bewusst der bestehende AC-12-Zustand statt einer eigenen Meldung: Wer den
    // Link anklickt, sieht die Seite, die ihm einen neuen anbietet. Eine eigene
    // „zu viele Versuche"-Meldung würde einem Angreifer bestätigen, dass er die
    // Grenze getroffen hat, und einem echten Nutzer nichts nützen.
    return redirectTo('/reset-password?error=1')
  }

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
