/**
 * Cookie attributes for the Supabase auth session (BUG-13).
 *
 * Shared on purpose: the session cookie is written from two places — the server
 * client in Server Actions and Route Handlers, and the proxy when it refreshes
 * the session on a request. If only one of them set these flags, the other would
 * quietly rewrite the cookie without them on the next refresh, and the
 * protection would look present while being gone.
 *
 * `httpOnly` became possible only after the password reset moved server-side
 * (EC-7): until then the browser client had to read the session out of the
 * cookie itself. Nothing client-side reads it any more.
 *
 * `secure` is deliberately NOT unconditional. A Secure cookie is never sent
 * over plain HTTP, so setting it always would break local development and every
 * test that runs against http://localhost — the app would appear to log in and
 * then behave as if it had not.
 */
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
} as const
