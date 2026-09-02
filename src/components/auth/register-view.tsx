'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { registerSchema } from '@/lib/validation/auth'
import { registerAction, type ActionState } from '@/lib/auth/actions'
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

type RegisterValues = { trainerName: string; email: string; password: string }

export function RegisterView({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { trainerName: '', email: '', password: '' },
  })
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onSubmit(values: RegisterValues) {
    setServerError(null)
    const formData = new FormData()
    formData.set('trainerName', values.trainerName)
    formData.set('email', values.email)
    formData.set('password', values.password)

    startTransition(async () => {
      const result: ActionState = await runAuthAction(() => registerAction({}, formData))
      if (result.error) setServerError(result.error)
      if (result.fieldErrors) {
        for (const [name, message] of Object.entries(result.fieldErrors)) {
          form.setError(name as keyof RegisterValues, { message })
        }
      }
    })
  }

  const emailError = form.formState.errors.email

  return (
    <Form {...form}>
      <form
        method="post"
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="trainerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Trainername</FormLabel>
              <FormControl>
                <Input autoComplete="username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
              {emailError && (
                <p className="text-sm text-muted-foreground">
                  <button
                    type="button"
                    onClick={onSwitchToLogin}
                    className="underline hover:text-foreground"
                  >
                    Stattdessen einloggen
                  </button>
                </p>
              )}
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
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <p className="text-xs text-muted-foreground">
          Mit der Registrierung akzeptierst du unsere{' '}
          <Link href="/privacy" className="underline hover:text-foreground">
            Datenschutzerklärung
          </Link>
          .
        </p>

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Registrieren …' : 'Registrieren'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Schon ein Konto?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-medium text-foreground hover:underline"
          >
            Einloggen
          </button>
        </p>
      </form>
    </Form>
  )
}
