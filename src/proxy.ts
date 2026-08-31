import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Route protection (design.md → Behaviors & Access, spec.md EC-2): everything
// requires a session except these — /reset-password is reached only via the
// emailed recovery link, /privacy and /imprint are PROJ-4 and stay public.
const PUBLIC_PATHS = ['/login', '/reset-password', '/privacy', '/imprint']

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

  // getClaims() verifies the JWT locally against the project's signing key —
  // no network round trip to Supabase Auth on every request, unlike getUser().
  // Next.js's own guidance is to keep Proxy to an optimistic check and leave
  // heavier work to Server Components/Actions; RLS and the page-level
  // getUser() calls (e.g. src/app/page.tsx) remain the actual authority.
  const { data: claims } = await supabase.auth.getClaims()

  const { pathname } = request.nextUrl

  if (!claims && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (claims && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
