import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// The recovery link's session tokens arrive in the URL fragment, which a
// Server Component never sees — ResetPasswordForm handles checking for a
// valid session and showing the right state client-side. See its comment
// and design.md → Technical Decisions for why.
export default function ResetPasswordPage() {
  return (
    // BUG-5: siehe login/page.tsx — die App-Shell liefert seit PROJ-2 das main-Element.
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md rounded-card">
        <CardHeader>
          <CardTitle>Neues Passwort</CardTitle>
          <CardDescription>Setze ein neues Passwort für dein Konto.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
