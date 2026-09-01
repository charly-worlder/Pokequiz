'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updatePasswordSchema } from '@/lib/validation/auth'
import { updatePasswordAction, type ActionState } from '@/lib/auth/actions'
import { runAuthAction } from '@/lib/auth/run-action'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

type Status = 'checking' | 'ready' | 'invalid'

// Supabase's recovery link never sends a server-readable code — the session
// tokens (or an error) arrive in the URL fragment (#access_token=... or
// #error=...), which only the browser ever sees. The browser Supabase client
// auto-detects and consumes that fragment (detectSessionInUrl, on by default),
// so getSession() here reflects it once the client has initialized.
// design.md → Technical Decisions has the full trace of how this was found.
export function ResetPasswordForm() {
  const [status, setStatus] = useState<Status>(() =>
    typeof window !== 'undefined' && window.location.hash.includes('error=')
      ? 'invalid'
      : 'checking'
  )

  useEffect(() => {
    if (status !== 'checking') return

    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        window.history.replaceState(null, '', window.location.pathname)
        setStatus(session ? 'ready' : 'invalid')
      })
  }, [status])

  if (status === 'checking') {
    return <p className="text-sm text-muted-foreground">Link wird geprüft …</p>
  }

  // spec.md AC-12: no recovery session (missing, invalid, or already-used link).
  if (status === 'invalid') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Dieser Link ist ungültig oder abgelaufen.
        </p>
        <Button asChild className="w-full">
          <Link href="/login">Neuen Link anfordern</Link>
        </Button>
      </div>
    )
  }

  return <SetPasswordForm />
}

type ResetPasswordValues = { password: string }

function SetPasswordForm() {
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: '' },
  })
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onSubmit(values: ResetPasswordValues) {
    setServerError(null)
    const formData = new FormData()
    formData.set('password', values.password)

    startTransition(async () => {
      const result: ActionState = await runAuthAction(() => updatePasswordAction({}, formData))
      if (result.error) setServerError(result.error)
      if (result.fieldErrors) {
        for (const [name, message] of Object.entries(result.fieldErrors)) {
          form.setError(name as keyof ResetPasswordValues, { message })
        }
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Neues Passwort</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Wird gespeichert …' : 'Passwort setzen'}
        </Button>
      </form>
    </Form>
  )
}
