'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { requestPasswordResetSchema } from '@/lib/validation/auth'
import { requestPasswordResetAction, type ActionState } from '@/lib/auth/actions'
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

type ForgotPasswordValues = { email: string }

export function ForgotPasswordView({ onBackToLogin }: { onBackToLogin: () => void }) {
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: { email: '' },
  })
  const [serverError, setServerError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onSubmit(values: ForgotPasswordValues) {
    setServerError(null)
    const formData = new FormData()
    formData.set('email', values.email)

    startTransition(async () => {
      const result: ActionState = await runAuthAction(() =>
        requestPasswordResetAction({}, formData)
      )
      if (result.error) setServerError(result.error)
      if (result.message) setConfirmation(result.message)
      if (result.fieldErrors) {
        for (const [name, message] of Object.entries(result.fieldErrors)) {
          form.setError(name as keyof ForgotPasswordValues, { message })
        }
      }
    })
  }

  // spec.md AC-10, EC-3: identical confirmation whether or not the account exists.
  if (confirmation) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-foreground">{confirmation}</p>
        <Button type="button" variant="outline" className="w-full" onClick={onBackToLogin}>
          Zurück zum Login
        </Button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Wird gesendet …' : 'Link senden'}
        </Button>

        <button
          type="button"
          onClick={onBackToLogin}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Zurück zum Login
        </button>
      </form>
    </Form>
  )
}
