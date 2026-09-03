'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updatePasswordSchema } from '@/lib/validation/auth'
import { updatePasswordAction, type ActionState } from '@/lib/auth/actions'
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

type ResetPasswordValues = { password: string }

// Just the form. Whether a valid recovery session exists is decided on the
// server in reset-password/page.tsx — this component is only rendered when it
// does. It used to carry that check itself, reading the session out of the URL
// in the browser, which is what limited the reset to the requesting device
// (BUG-6 / EC-7).
export function ResetPasswordForm() {
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
      <form
        method="post"
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
      >
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
