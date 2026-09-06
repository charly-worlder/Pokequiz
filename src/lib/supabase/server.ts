import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { AUTH_COOKIE_OPTIONS } from './cookie-options'

/**
 * Client, dessen Schreibvorgänge die HTTP-Antwort **nicht** erreichen (BUG-87).
 *
 * Gebraucht auf Pfaden, deren Antwort für jeden Ausgang identisch aussehen muss.
 * Der reguläre Client oben reicht Cookie-Schreibvorgänge von `@supabase/ssr` an
 * die Antwort durch — und `@supabase/ssr` schreibt auch **im Fehlerfall**: Bei
 * einem 429 auf `/auth/v1/recover` löscht es die PKCE-`code-verifier`-Cookies.
 * Weil dieser 429 nur bei einem existierenden Konto auftritt, wurde die
 * Cookie-Kopfzeile zum Existenz-Orakel, obwohl der Antwort-Body längst
 * vereinheitlicht war.
 *
 * **Auf dem Reset-Pfad ist das Verwerfen folgenlos.** Die Mail-Vorlage zeigt auf
 * `/auth/confirm` mit `{{ .TokenHash }}`, und `verifyOtp` löst den Token
 * serverseitig ein — der `code_verifier` wird in dieser App **nirgends gelesen**
 * (das war gerade der Punkt des BUG-6-Fixes, damit der Link auf einem anderen
 * Gerät funktioniert, EC-7).
 *
 * Lesen bleibt erlaubt: Es verändert die Antwort nicht.
 */
export async function createResponseNeutralClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // Absichtlich leer — siehe oben. Kein `try`, kein Logeintrag: Es gibt
          // hier nichts zu tun und nichts, was schiefgehen könnte.
        },
      },
    }
  )
}

// Server-side client for Server Actions and Route Handlers — reads and writes
// the session via the request's cookie jar. See docs/stacks/backend-supabase.md
// → "The login and signup flow".
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component, which cannot set cookies during
            // render — the middleware refreshes the session on every request.
          }
        },
      },
    }
  )
}
