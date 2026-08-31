'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
  NETWORK_ERROR_MESSAGE,
  INVALID_RESET_LINK_MESSAGE,
  type ActionState,
} from '@/lib/auth/error-mapping'

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
    return mapRegisterError(error)
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

  let supabase
  try {
    supabase = await createClient()
  } catch {
    return { error: NETWORK_ERROR_MESSAGE }
  }

  const headerList = await headers()
  const origin = headerList.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''

  // Supabase's recovery link always redirects with the session tokens in the
  // URL fragment (#access_token=...), never a server-readable ?code= — so it
  // goes straight to /reset-password, which handles the fragment client-side.
  // No intermediate Route Handler can do this exchange; see design.md.
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
    return { error: NETWORK_ERROR_MESSAGE }
  }

  redirect('/')
}
