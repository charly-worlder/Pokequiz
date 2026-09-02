'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema } from '@/lib/validation/auth'
import { loginAction, type ActionState } from '@/lib/auth/actions'
import { runAuthAction } from '@/lib/auth/run-action'
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

type LoginValues = { email: string; password: string }

export function LoginView({
  onSwitchToRegister,
  onSwitchToForgotPassword,
}: {
  onSwitchToRegister: () => void
  onSwitchToForgotPassword: () => void
}) {
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onSubmit(values: LoginValues) {
    setServerError(null)
    const formData = new FormData()
    formData.set('email', values.email)
    formData.set('password', values.password)

    startTransition(async () => {
      const result: ActionState = await runAuthAction(() => loginAction({}, formData))
      if (result.error) setServerError(result.error)
      if (result.fieldErrors) {
        for (const [name, message] of Object.entries(result.fieldErrors)) {
          form.setError(name as keyof LoginValues, { message })
        }
      }
    })
  }

  return (
    <Form {...form}>
      <form
        method="post"
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-Mail</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Passwort</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <button
          type="button"
          onClick={onSwitchToForgotPassword}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Passwort vergessen?
        </button>

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Einloggen …' : 'Einloggen'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Noch kein Konto?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-medium text-foreground hover:underline"
          >
            Registrieren
          </button>
        </p>
      </form>
    </Form>
  )
}
