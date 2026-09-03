import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

  if (!user && !isPublicPath(pathname)) {
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
