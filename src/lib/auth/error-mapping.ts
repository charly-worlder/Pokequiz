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
// BUG-67: Die Meldung oben nennt die Verbindung — und lag damit immer dann
// falsch, wenn der **Konto**-Zähler abgewiesen hatte: Der rechtmäßige Besitzer
// kommt in diesem Fall von einer völlig unbelasteten Verbindung und probierte
// den nächstliegenden Workaround (anderes WLAN), der nichts half.
//
// Diese Meldung nennt keine Wartezeit, weil es zwei verschiedene gibt (Login
// 15 Minuten, Reset eine Stunde) und eine falsche Zahl schlechter ist als keine.
export const THROTTLED_ACCOUNT_MESSAGE =
  'Zu viele Versuche für diese E-Mail-Adresse. Bitte später erneut versuchen.'

/**
 * Wählt die Sperrmeldung nach der Ursache (spec.md AC-16, AC-19, EC-4).
 *
 * Dass die Adress-Meldung nichts über die Existenz eines Kontos verrät, trägt
 * nicht ihr Wortlaut, sondern der Zähler: Er zählt **jede** Adresse, auch eine
 * ohne Konto. Gemessen am 2026-09-06 — eine frei erfundene Adresse wird nach der
 * 5. Reset-Anfrage genauso abgewiesen wie eine echte.
 */
export function throttleMessage(blockedBy: 'connection' | 'account' | null): string {
  return blockedBy === 'account' ? THROTTLED_ACCOUNT_MESSAGE : THROTTLED_MESSAGE
}
export const NETWORK_ERROR_MESSAGE = 'Die Verbindung ist fehlgeschlagen. Bitte erneut versuchen.'
export const RESET_CONFIRMATION_MESSAGE =
  'Falls diese Adresse registriert ist, wurde ein Link zum Zurücksetzen verschickt.'
export const INVALID_RESET_LINK_MESSAGE =
  'Dieser Link ist ungültig oder abgelaufen. Bitte einen neuen anfordern.'
// BUG-66: Supabase rejects a password identical to the current one with a 422 /
// code "same_password". That is a field problem, not an outage.
export const SAME_PASSWORD_MESSAGE =
  'Das neue Passwort muss sich vom bisherigen unterscheiden.'

// spec.md AC-2, AC-3, EC-1 — verified empirically against the local Supabase
// Auth API, re-measured on 2026-09-05 through the same supabase-js the app uses:
//   - duplicate email        -> AuthApiError, 422, code "user_already_exists"
//   - duplicate trainer name -> AuthRetryableFetchError, 500, code undefined,
//                               message "Database error saving new user"
//   - Supabase's built-in IP rate limit -> status 429
//
// BUG-68: that 500 is NOT self-identifying. The signup trigger raises
// `trainer_name_taken` (0001_profiles.sql), but GoTrue replaces it with the
// generic message above — a real database outage during registration arrives
// looking exactly the same. This function used to read every 500 as a taken
// trainer name, so an outage told the user their chosen name was gone.
//
// The status alone cannot decide it, so the caller has to answer the question
// first: `trainerNameTaken` is the result of asking the database whether a
// profile with that name actually exists (see trainer-name.ts). The parameter is
// required on purpose — a default would let a future caller silently reintroduce
// the guess.
export function mapRegisterError(
  error: AuthErrorLike,
  context: { trainerNameTaken: boolean }
): ActionState {
  if (error.code === 'user_already_exists') {
    return { fieldErrors: { email: 'Diese E-Mail-Adresse ist bereits registriert.' } }
  }

  if (error.status === 429) {
    return { error: THROTTLED_MESSAGE }
  }

  // spec.md EC-1 still holds: in a real race the winning transaction has
  // committed by the time we look, so the loser sees the field error.
  if (error.status === 500 && context.trainerNameTaken) {
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

// spec.md AC-10, EC-3 — die Antwort auf eine Reset-Anfrage ist **immer** dieselbe.
//
// BUG-79: Hier stand ein Zweig, der einen 429 von Supabase auf die
// Drosselungsmeldung abbildete. Das war ein Kontoexistenz-Orakel, und zwar ein
// vollständiges: Supabase antwortet auf `/auth/v1/recover` mit
// `over_email_send_rate_limit` **nur dann, wenn tatsächlich eine Mail hinausginge**
// — also nur bei einem existierenden Konto. Zu einer unbekannten Adresse wird nie
// eine Mail versucht, also nie ein 429. Zwei Anfragen genügten, um eine beliebige
// Adresse sicher zuzuordnen; im QA-Lauf vom 2026-09-06 gemessen: **30 von 30
// korrekt, rund 2 Adressen pro Sekunde**. Gehostet ist das Fenster 60× breiter als
// lokal (`max_frequency` 60 s statt 1 s).
//
// Deshalb wird hier **jeder** Fehler geschluckt. Das ist die Umkehrung der Regel,
// die für die App-eigenen Zähler gilt (AC-16, AC-19): Die dürfen ihre Ursache
// nennen, weil sie **jede** Adresse zählen, auch eine ohne Konto — ihre Meldung
// hängt nicht davon ab, ob es das Konto gibt. Supabases 429 hängt genau davon ab.
// Der Unterschied ist gemessen, nicht erwogen.
//
// Der Preis: Wer die eigene Anfrage zu schnell wiederholt, sieht die Bestätigung,
// obwohl gerade keine Mail hinausging. Die App-eigene Drosselung greift davor und
// sagt es ihm (AC-17: 3 pro Verbindung / 5 min, AC-19: 5 pro Adresse / Stunde) —
// nur Supabases eigenes, engeres Zeitfenster bleibt stumm.
//
// Der Parameter bleibt in der Signatur: Er dokumentiert, dass hier ein Fehler
// ankommen **kann** und bewusst nicht nach außen dringt.
export function mapPasswordResetRequestError(_error: AuthErrorLike | null): ActionState {
  return { message: RESET_CONFIRMATION_MESSAGE }
}

// spec.md AC-11 — setting the new password at the end of a reset.
//
// BUG-66: reusing the current password came back as "Die Verbindung ist
// fehlgeschlagen", because every failure here fell through to the network
// message. Supabase is specific about this one (422 / code "same_password",
// measured 2026-09-05), so the user gets a field error telling them what to
// change. Everything else stays a genuine failure — the same separation BUG-9
// established for the login: never dress an outage up as a user mistake, and
// never dress a user mistake up as an outage.
export function mapUpdatePasswordError(error: AuthErrorLike): ActionState {
  if (error.code === 'same_password') {
    return { fieldErrors: { password: SAME_PASSWORD_MESSAGE } }
  }

  return { error: NETWORK_ERROR_MESSAGE }
}
