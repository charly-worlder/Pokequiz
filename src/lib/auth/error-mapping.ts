export type ActionState = {
  error?: string
  fieldErrors?: Record<string, string>
  message?: string
}

// Shape of what we read off a Supabase AuthError — kept minimal and structural
// so it can be exercised with plain objects in tests, without a live Supabase
// instance or the actual AuthError class.
export type AuthErrorLike = {
  status?: number
  code?: string
}

export function fieldErrorsFromZod(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = String(issue.path[0])
    if (!fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return fieldErrors
}

// spec.md AC-7: identical message for a wrong password and an unknown email —
// never reveal whether an account exists.
export const WRONG_CREDENTIALS_MESSAGE = 'E-Mail-Adresse oder Passwort ist falsch.'
export const THROTTLED_MESSAGE =
  'Zu viele Versuche von dieser Verbindung. Bitte in ein paar Minuten erneut versuchen.'
export const NETWORK_ERROR_MESSAGE = 'Die Verbindung ist fehlgeschlagen. Bitte erneut versuchen.'
export const RESET_CONFIRMATION_MESSAGE =
  'Falls diese Adresse registriert ist, wurde ein Link zum Zurücksetzen verschickt.'
export const INVALID_RESET_LINK_MESSAGE =
  'Dieser Link ist ungültig oder abgelaufen. Bitte einen neuen anfordern.'

// spec.md AC-2, AC-3, AC-9(dropped)/EC-1 — verified empirically against the
// local Supabase Auth API (see design.md commit notes):
//   - duplicate email  -> AuthApiError, status 422, code "user_already_exists"
//   - duplicate trainer name -> the signup trigger's Postgres exception is
//     always reported as a generic 500 (AuthRetryableFetchError, no code);
//     nothing else in this flow produces a 500, so status alone is reliable.
//   - Supabase's built-in IP rate limit -> status 429
export function mapRegisterError(error: AuthErrorLike): ActionState {
  if (error.code === 'user_already_exists') {
    return { fieldErrors: { email: 'Diese E-Mail-Adresse ist bereits registriert.' } }
  }

  if (error.status === 429) {
    return { error: THROTTLED_MESSAGE }
  }

  if (error.status === 500) {
    return { fieldErrors: { trainerName: 'Dieser Trainername ist bereits vergeben.' } }
  }

  return { error: NETWORK_ERROR_MESSAGE }
}

// spec.md AC-7, AC-8, EC-4, EC-6 — wrong password and unknown email both return
// status 400 / code "invalid_credentials", so both land on the same message and
// AC-7 holds without any branching between them.
//
// What this must NOT do is treat every other failure as a wrong password. It
// used to: anything that was not a 429 fell through to WRONG_CREDENTIALS, so an
// outage of Supabase Auth told the user their password was wrong (BUG-9). They
// then reset a password that was never the problem, while the registration path
// reported the same outage correctly. Only statuses that really mean "these
// credentials were rejected" produce that message now; everything else — no
// status at all, a 5xx, a transport failure — is reported as what it is.
export function mapLoginError(error: AuthErrorLike): ActionState {
  if (error.status === 429) {
    return { error: THROTTLED_MESSAGE }
  }

  if (error.status === 400 || error.status === 401) {
    return { error: WRONG_CREDENTIALS_MESSAGE }
  }

  return { error: NETWORK_ERROR_MESSAGE }
}

export function mapPasswordResetRequestError(error: AuthErrorLike | null): ActionState {
  if (error && error.status === 429) {
    return { error: THROTTLED_MESSAGE }
  }

  return { message: RESET_CONFIRMATION_MESSAGE }
}
