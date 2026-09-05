import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { AUTH_COOKIE_OPTIONS } from '@/lib/supabase/cookie-options'

// Route protection (design.md → Behaviors & Access, spec.md EC-2): everything
// requires a session except these — /auth/confirm redeems the emailed recovery
// link and must be reachable by someone who is precisely NOT signed in yet,
// /reset-password is reached only through it, /privacy and /imprint are PROJ-4
// and stay public.
const PUBLIC_PATHS = ['/auth/confirm', '/login', '/reset-password', '/privacy', '/imprint']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // BUG-3 (PROJ-2/qa-report.md): this used to be getClaims(), which only checks
  // the JWT's signature locally. A revoked session — or one whose account was
  // deleted — still passes that check, so the proxy considered the visitor
  // signed in while src/app/page.tsx, which asks the auth server via getUser(),
  // considered them signed out. The two redirected at each other until the
  // browser gave up with ERR_TOO_MANY_REDIRECTS.
  //
  // There is now exactly ONE authority for "is this visitor signed in", and it
  // is the auth server. Next.js's guidance to keep the proxy light still holds,
  // but a cheap check that can disagree with the expensive one is worse than a
  // slower check that cannot: the disagreement is what produced the loop.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  /**
   * BUG-9 (PROJ-2/qa-report.md, spec.md EC-7): A Server Action must not be
   * answered with an HTTP redirect.
   *
   * Next.js encodes a Server Action's own `redirect()` **in-band** — status 200
   * plus an `x-action-redirect` header — precisely so the browser does not
   * follow a 307 to a sign-in page. Its action handler therefore treats an
   * ordinary redirect that comes back as HTML as a protocol violation, and the
   * client throws „An unexpected response was received from the server".
   *
   * The visible damage was that the action's own `unauthenticated` branch had
   * become **unreachable**: the player whose session expired mid-round saw a
   * result screen that pretended everything was fine, and never landed on
   * /login. The branch existed and was unit-tested — the proxy simply never let
   * it run.
   *
   * Letting the action through is the framework's intended shape, not a hole:
   * Next's own guidance is that "any Server Actions called from components must
   * perform their own authorization checks". Every action here does, and the
   * database enforces the same rules a second time through RLS.
   * `server-actions.guard.test.ts` keeps that from silently ceasing to be true.
   */
  /**
   * BUG-21: the exception is as narrow as the reason for it.
   *
   * Next.js does not bind a Server Action to the route it was defined on — any
   * action id posted to any path runs. When this exception applied to every
   * protected path, PROJ-1's `loginAction` and `registerAction` became reachable
   * under all of them; six accounts were created through `/` instead of `/login`
   * during the QA run. Nothing leaked and no privilege was gained, but it defeats
   * the obvious deployment defence: an edge or WAF rule that watches `/login`
   * would simply be walked around.
   *
   * Only `/` hosts actions that need the exception (the quiz, for EC-7). Every
   * other protected path keeps its redirect. **A new route that invokes Server
   * Actions has to be added here** — and if it is forgotten, the symptom is
   * loud: the action answers with a redirect instead of running.
   */
  const ACTION_HOST_PATHS = ['/']
  const isServerAction =
    request.method === 'POST' &&
    request.headers.has('next-action') &&
    ACTION_HOST_PATHS.includes(pathname)

  if (!user && !isPublicPath(pathname) && !isServerAction) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
