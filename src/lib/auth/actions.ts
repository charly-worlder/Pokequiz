'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { registerAttempt, settleSuccessfulLogin } from '@/lib/auth/throttle'
import {
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  updatePasswordSchema,
} from '@/lib/validation/auth'
import {
  fieldErrorsFromZod,
  mapLoginError,
  mapRegisterError,
  mapUpdatePasswordError,
  NETWORK_ERROR_MESSAGE,
  throttleMessage,
  INVALID_RESET_LINK_MESSAGE,
  type ActionState,
} from '@/lib/auth/error-mapping'
import { isTrainerNameTaken } from '@/lib/auth/trainer-name'
import { requestPasswordResetIdentically } from '@/lib/auth/reset-response'
import { hasRecoverySession } from '@/lib/auth/recovery-session'

export type { ActionState }

export async function registerAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    trainerName: formData.get('trainerName'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  const { trainerName, email, password } = parsed.data

  // BUG-29: gezählt wird **hier**, nicht im Proxy. Eine Server Action ist an
  // keine Route gebunden — eine Schranke am Pfad ließe sich über `/privacy` oder
  // ein beliebiges `*.png` umgehen (BUG-30, BUG-31).
  const registerThrottle = await registerAttempt('register', email)
  if (!registerThrottle.allowed) {
    return { error: throttleMessage(registerThrottle.blockedBy) }
  }

  let supabase
  try {
    supabase = await createClient()
  } catch {
    return { error: NETWORK_ERROR_MESSAGE }
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { trainer_name: trainerName } },
  })

  if (error) {
    // BUG-68: Ein 500 heißt hier entweder „Trainername vergeben" (Trigger) oder
    // „Datenbank gerade kaputt" — GoTrue liefert für beides denselben Text. Also
    // wird nachgefragt, statt geraten. Nur auf dem Fehlerpfad, nur bei 500.
    const trainerNameTaken =
      error.status === 500 ? await isTrainerNameTaken(trainerName) : false

    return mapRegisterError(error, { trainerNameTaken })
  }

  redirect('/')
}

export async function loginAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  // BUG-29: siehe registerAction. Der Zähler läuft vor dem Auth-Aufruf, damit
  // ein Rateversuch gar nicht erst nach oben durchgereicht wird.
  const loginThrottle = await registerAttempt('login', parsed.data.email)
  if (!loginThrottle.allowed) {
    return { error: throttleMessage(loginThrottle.blockedBy) }
  }

  let supabase
  try {
    supabase = await createClient()
  } catch {
    return { error: NETWORK_ERROR_MESSAGE }
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return mapLoginError(error)
  }

  // Geglückt: Konto-Zähler leeren, damit vier Tippfehler vor dem richtigen
  // Passwort nicht nachwirken — und den einen IP-Versuch erstatten, damit der
  // IP-Zähler nur Fehlversuche zählt (BUG-39, BUG-54). Warum das beides braucht
  // und warum Registrierung und Reset ausdrücklich nicht erstatten: throttle.ts.
  await settleSuccessfulLogin(parsed.data.email)

  redirect('/')
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function requestPasswordResetAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get('email') })

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  // BUG-29: eigener, engerer Grenzwert (3 pro 5 Minuten). Der Reset verschickt
  // E-Mail, ist also nicht nur ein Rate-, sondern auch ein Belästigungsvektor.
  const resetThrottle = await registerAttempt('password-reset', parsed.data.email)
  if (!resetThrottle.allowed) {
    return { error: throttleMessage(resetThrottle.blockedBy) }
  }

  const headerList = await headers()
  const origin = headerList.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''

  // The link's shape is decided by the email template, not here: it points at
  // /auth/confirm with {{ .TokenHash }} (supabase/templates/recovery.html), so
  // the token is redeemed server-side and works on any device (EC-7).
  //
  // redirectTo still names an allowed return target for Supabase's own
  // validation; the template does not interpolate it.
  //
  // Ab hier gibt es **einen** Ausgang: `requestPasswordResetIdentically` erzeugt
  // eine Antwort, die für jeden internen Ausgang gleich aussieht — Rückgabewert,
  // Status und Cookies. Die Begründung und der Preis stehen dort (BUG-87).
  // Alles, was vor dieser Zeile antwortet (Validierung, Drosselung), darf und
  // soll unterscheidbar sein: Es hängt nicht davon ab, ob ein Konto existiert.
  return requestPasswordResetIdentically(parsed.data.email, `${origin}/reset-password`)
}

export async function updatePasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = updatePasswordSchema.safeParse({ password: formData.get('password') })

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  // BUG-91: gezählt wird **vor** jedem Supabase-Aufruf, wie auf allen anderen
  // Zugangsdaten-Pfaden. Diese Action war die einzige ohne Zähler (gemessen:
  // 12 Aufrufe von einer Verbindung, null abgewiesen), obwohl jeder Aufruf ein
  // `getUser()` und ein `updateUser()` gegen das gemeinsame Kontingent des
  // Auth-Dienstes auslöst (BUG-21). Ohne E-Mail-Adresse, weil die erst nach der
  // Sitzungsprüfung feststeht — und die soll hinter der Drosselung liegen.
  const updateThrottle = await registerAttempt('password-update', null)
  if (!updateThrottle.allowed) {
    return { error: throttleMessage(updateThrottle.blockedBy) }
  }

  let supabase
  try {
    supabase = await createClient()
  } catch {
    return { error: NETWORK_ERROR_MESSAGE }
  }

  // spec.md AC-12: no valid recovery session — the link was invalid or expired.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: INVALID_RESET_LINK_MESSAGE }
  }

  // BUG-91: **eine Sitzung genügt nicht — es muss eine Recovery-Sitzung sein.**
  //
  // `design.md` → Behaviors & Access sagt „nur mit gültiger Recovery-Sitzung";
  // im Code stand davon nichts. Gemessen wurde die Folge am 2026-09-06: Mit einer
  // gewöhnlichen Login-Sitzung ließ sich das Passwort setzen, ohne das alte zu
  // kennen — das alte war danach ungültig, das neue funktionierte. Wer ein
  // angemeldetes Gerät erreicht, übernimmt damit das Konto endgültig, und die
  // Sitzung lebt laut AC-5 bis zum aktiven Abmelden (`Max-Age=34560000`).
  //
  // **Woran eine Recovery-Sitzung erkennbar ist:** am `amr`-Anspruch des JWT.
  // Gegen die lokale Instanz gemessen — `signInWithPassword` ergibt
  // `amr: [{method: 'password'}]`, `verifyOtp({type:'recovery'})` ergibt
  // `amr: [{method: 'otp'}]`. Der Anspruch steht **im signierten Token**, ist also
  // nicht fälschbar; ein selbstgesetztes Merker-Cookie wäre genau auf dem
  // geteilten Gerät manipulierbar, gegen das dieser Schutz gerichtet ist.
  //
  // `otp` deckt bei Supabase auch Magic Link und E-Mail-OTP ab — beides hat diese
  // App nicht (`spec.md` kennt nur Passwort-Login und Passwort-Reset). Käme je
  // eines dazu, muss diese Prüfung enger werden.
  if (!(await hasRecoverySession(supabase))) {
    // Bewusst dieselbe Meldung wie bei einer fehlenden Sitzung (AC-12): Wer
    // hierher kommt, hat keinen gültigen Reset-Link — und die Seite bietet ihm
    // genau die richtige Abhilfe an, „Neuen Link anfordern".
    return { error: INVALID_RESET_LINK_MESSAGE }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    return mapUpdatePasswordError(error)
  }

  redirect('/')
}
