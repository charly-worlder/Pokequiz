import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Die Kontodaten für den angemeldeten Spieler (PROJ-4, spec.md AC-2, AC-19).
 *
 * **Ausdrücklich über die Nutzersitzung, nicht über den Administrationszugang.**
 * Alle drei Quellen sind bereits per Row Level Security auf den Eigentümer
 * beschränkt (`0016` für `profiles`, `0002` für `runs`). Den Generalschlüssel
 * hier zu benutzen wäre bequemer und nähme genau die zweite Schutzschicht weg,
 * die `.claude/rules/security.md` verlangt — die Anwendungsprüfung wäre dann die
 * einzige. `design.md` → Technical Decisions führt das als Entscheidung.
 *
 * **Wirft nicht, sondern gibt den Fehler zurück** — dieselbe Konvention wie
 * `getLeaderboard()` (PROJ-3, EC-6): Eine Ausnahme landete in der Fehlergrenze
 * der Route und ersetzte den ganzen Inhaltsbereich. Als Rückgabewert entscheidet
 * die Seite, welcher Teil ausgetauscht wird.
 */

/** Der beste Lauf — `null`, solange es keinen Lauf mit Serie ≥ 1 gibt (AC-6). */
export type BestRun = { streak: number; durationMs: number }

export type AccountData = {
  email: string
  trainerName: string
  /** Zeitpunkt der Registrierung, als ISO-Zeichenkette aus der Datenbank. */
  createdAt: string
  /** **Alle** eigenen Runden, auch Nullrunden — siehe unten. */
  roundsPlayed: number
  bestRun: BestRun | null
}

export type AccountResult =
  | { status: 'ok'; data: AccountData }
  | { status: 'unauthenticated' }
  | { status: 'error' }

export async function getAccountData(): Promise<AccountResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Zweite, unabhängige Schranke neben dem Routen-Schutz in `src/proxy.ts`, und
  // sie steht **vor** jedem Datenzugriff (AC-4).
  if (!user?.email) return { status: 'unauthenticated' }

  const [profile, rounds, best] = await Promise.all([
    supabase.from('profiles').select('trainer_name, created_at').eq('id', user.id).maybeSingle(),

    // `head: true` holt nur die Anzahl, nicht die Zeilen. **Gezählt werden alle
    // Runden, auch die mit Serie 0** — anders als in der Rangliste, die
    // Nullrunden ausschließt (PROJ-3, AC-5). Der Unterschied ist beabsichtigt:
    // Diese Seite ist eine Auskunft darüber, was gespeichert ist (Art. 15
    // DSGVO), keine Wertung. Eine Nullrunde liegt als Zeile in der Datenbank
    // und muss deshalb in der Auskunft auftauchen.
    supabase.from('runs').select('id', { count: 'exact', head: true }).eq('profile_id', user.id),

    // Der beste Lauf nach derselben Regel wie die Rangliste (PROJ-3, AC-3):
    // Serie absteigend, bei Gleichstand Zeit aufsteigend. Serie 0 zählt hier
    // **nicht** als Bestleistung — „bester Lauf: Serie 0" wäre keine Auskunft,
    // sondern Hohn. AC-6 verlangt für diesen Fall den Hinweis.
    supabase
      .from('runs')
      .select('streak, duration_ms')
      .eq('profile_id', user.id)
      .gte('streak', 1)
      .order('streak', { ascending: false })
      .order('duration_ms', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  // Das Profil ist die einzige Pflichtquelle: Ohne es gibt es nichts anzuzeigen.
  // Bei den beiden anderen ist ein Fehler ebenfalls ein Fehler — eine Seite, die
  // „0 Runden" zeigt, weil die Abfrage scheiterte, wäre eine **falsche
  // Auskunft**, und AC-19 sagt zu, dass die Anzeige vollständig ist.
  if (profile.error || !profile.data || rounds.error || best.error) return { status: 'error' }

  return {
    status: 'ok',
    data: {
      email: user.email,
      trainerName: profile.data.trainer_name,
      createdAt: profile.data.created_at,
      roundsPlayed: rounds.count ?? 0,
      bestRun: best.data ? { streak: best.data.streak, durationMs: best.data.duration_ms } : null,
    },
  }
}
