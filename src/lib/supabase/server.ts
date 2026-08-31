import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server-side client for Server Actions and Route Handlers — reads and writes
// the session via the request's cookie jar. See docs/stacks/backend-supabase.md
// → "The login and signup flow".
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
