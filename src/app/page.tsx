import { createClient } from '@/lib/supabase/server'
import { logoutAction } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'

// Platzhalter, bis PROJ-2 die echte Startseite baut (Spiel starten, spielen,
// Ergebnis sehen) — siehe design.md → PROJ-1, T12. Dient hier nur dazu, AC-4
// (Weiterleitungsziel nach Login) und AC-6 (Abmelden) testbar zu machen.
export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('trainer_name')
    .eq('id', user.id)
    .single()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6">
      <p className="text-lg text-foreground">
        Eingeloggt als <span className="font-semibold">{profile?.trainer_name}</span>
      </p>
      <form action={logoutAction}>
        <Button type="submit" variant="outline">
          Abmelden
        </Button>
      </form>
    </main>
  )
}
