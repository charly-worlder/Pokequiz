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
  mapPasswordResetRequestError,
  mapRegisterError,
  mapUpdatePasswordError,
  NETWORK_ERROR_MESSAGE,
  throttleMessage,
  INVALID_RESET_LINK_MESSAGE,
  type ActionState,
} from '@/lib/auth/error-mapping'
import { isTrainerNameTaken } from '@/lib/auth/trainer-name'

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

  let supabase
  try {
    supabase = await createClient()
  } catch {
    return { error: NETWORK_ERROR_MESSAGE }
  }

  const headerList = await headers()
  const origin = headerList.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''

  // The link's shape is decided by the email template, not here: it points at
  // /auth/confirm with {{ .TokenHash }} (supabase/templates/recovery.html), so
  // the token is redeemed server-side and works on any device (EC-7).
  //
  // The comment that used to sit here claimed the recovery link "always"
  // arrives with the tokens in the URL fragment and never as a server-readable
  // ?code=. That was wrong — ?code= was what our own client actually produced,
  // and the belief is what kept the reset tied to one browser (BUG-6, BUG-15).
  //
  // redirectTo still names an allowed return target for Supabase's own
  // validation; the template does not interpolate it.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/reset-password`,
  })

  // spec.md AC-10, EC-3: Supabase itself never reveals whether the address
  // exists on this endpoint — the same confirmation covers both cases.
  return mapPasswordResetRequestError(error)
}

export async function updatePasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = updatePasswordSchema.safeParse({ password: formData.get('password') })

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
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

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    return mapUpdatePasswordError(error)
  }

  redirect('/')
}
