import Link from 'next/link'

import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { createClient } from '@/lib/supabase/server'
import { hasRecoverySession } from '@/lib/auth/recovery-session'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// The recovery session already exists by the time this page renders: the
// emailed link goes to /auth/confirm, which redeems the token_hash server-side
// and sets the session cookie before redirecting here. So the check belongs on
// the server — the browser no longer has to read anything out of the URL.
//
// This replaced a client-side getSession() check, which only worked in the
// browser that requested the reset (BUG-6 / EC-7). See design.md → Technical
// Decisions, 2026-09-03.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // spec.md AC-12: link missing, invalid, expired or already used. /auth/confirm
  // sets ?error=1 for the first three; no session covers the rest.
  //
  // BUG-91: Eine Sitzung allein reicht auch hier nicht. Vorher bekam **jeder**
  // Angemeldete das Formular zu sehen — seit `updatePasswordAction` eine echte
  // Recovery-Sitzung verlangt, wäre das ein Formular, das nur noch scheitern kann.
  // Die Sicherheitsgrenze ist und bleibt die Server Action; diese Zeile sorgt
  // dafür, dass die Seite dasselbe sagt wie sie, statt in eine Sackgasse zu führen.
  const isInvalid = error === '1' || !user || !(await hasRecoverySession(supabase))

  return (
    // BUG-5: siehe login/page.tsx — die App-Shell liefert seit PROJ-2 das main-Element.
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md rounded-card">
        <CardHeader>
          <CardTitle>Neues Passwort</CardTitle>
          <CardDescription>
            {isInvalid
              ? 'Der Link konnte nicht bestätigt werden.'
              : 'Setze ein neues Passwort für dein Konto.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isInvalid ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Dieser Link ist ungültig oder abgelaufen.
              </p>
              <Button asChild className="w-full">
                <Link href="/login">Neuen Link anfordern</Link>
              </Button>
            </div>
          ) : (
            <ResetPasswordForm />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
