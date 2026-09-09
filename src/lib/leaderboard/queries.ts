import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * Der Datenzugang der Weltrangliste (spec.md AC-11, AC-13, AC-19, AC-20;
 * design.md → Behaviors & Access).
 *
 * **Warum über den Administrationszugang und nicht über die Sitzung des
 * Nutzers.** Die Lesepolicy auf `runs` (`runs_select_own`, Migration 0002) gibt
 * jedem Nutzer ausschließlich seine eigenen Zeilen — das ist die Zusage
 * „schlechte Runden sind privat" aus `docs/data-model.md`, und sie ist Absicht.
 * Eine Rangliste ist daraus nicht abfragbar. Erreichbar sind fremde Bestläufe
 * nur über `leaderboard_page` (Migration 0015), und die ist allein für
 * `service_role` ausführbar. Dasselbe Muster wie beim Rundenzustand in
 * `src/lib/quiz/round-state.ts`.
 *
 * **Die Profil-Kennung stammt immer aus der Sitzung — nie aus einem Argument.**
 * Das ist hier keine Stilfrage: `leaderboard_page` läuft als `security definer`
 * und umgeht damit RLS. Ihr Parameter steuert zwar nur, welche *zusätzliche*
 * Zeile herauskommt, aber mit einer fremden Kennung liesse sich der beste Lauf
 * und der Rang eines Spielers ausserhalb der Top-5 erfahren. Deshalb nimmt
 * `getLeaderboard()` **kein** Argument entgegen: Es gibt keinen Aufrufer, der
 * eine Kennung mitgeben könnte, auch nicht versehentlich.
 */

export type LeaderboardEntry = {
  rank: number
  trainerName: string
  streak: number
  durationMs: number
  /**
   * Gehört diese Zeile dem Betrachter? Kommt als Wahrheitswert aus der
   * Datenbank, damit die Konto-Kennung den Server nie verlässt (AC-20).
   */
  isSelf: boolean
}

export type LeaderboardResult =
  /** Zeilen nach Platz sortiert: Top-5, dahinter die eigene Zeile, falls Platz > 5. */
  | { status: 'ok'; entries: LeaderboardEntry[] }
  /** spec.md EC-6 — Netzwerk- oder Datenbankfehler. Die Seite zeigt die Fehlerkarte. */
  | { status: 'error' }
  /** spec.md AC-13, EC-8 — keine oder abgelaufene Sitzung. Die Seite leitet auf `/login`. */
  | { status: 'unauthenticated' }

type LeaderboardRow = {
  rank: number
  trainer_name: string
  streak: number
  duration_ms: number
  is_self: boolean
}

/**
 * Die Rangliste für den angemeldeten Betrachter.
 *
 * **Nichts wird zwischengespeichert** (AC-11). Das gilt hier von selbst — die
 * Sitzungsprüfung liest Cookies, die Seite ist damit pro Anfrage gerendert, und
 * der Aufruf über `supabase-js` geht durch `fetch`, das in Next 16 ohne
 * `cacheComponents` nicht cacht. Es steht trotzdem als Zusage hier, weil eine
 * später hinzugefügte Zeile sie lautlos umkehren würde: Der Spieler sähe nach
 * seiner Rekordrunde eine Liste ohne sich selbst und hielte das für einen
 * Speicherfehler.
 *
 * **Wirft nicht, sondern gibt den Fehler zurück** (EC-6). Eine Ausnahme landete
 * in der Fehlergrenze der Route und ersetzte den ganzen Inhaltsbereich; der
 * Vertrag verlangt den Hinweis *innerhalb* der Karte, mit stehender Kopf- und
 * Fußzeile. Als Rückgabewert entscheidet die Seite, welcher Teil ausgetauscht
 * wird.
 */
export async function getLeaderboard(): Promise<LeaderboardResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Die zweite, unabhängige Prüfung neben dem Routen-Schutz in `src/proxy.ts`.
  // Sie steht **vor** jedem Datenzugriff: Es entstehen gar keine fremden
  // Trainernamen, die versehentlich ausgeliefert werden könnten (AC-13, AC-23).
  if (!user) return { status: 'unauthenticated' }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('leaderboard_page', { p_profile: user.id })

  if (error) return { status: 'error' }

  const rows = (data ?? []) as LeaderboardRow[]

  return {
    status: 'ok',
    entries: rows.map((row) => ({
      rank: row.rank,
      trainerName: row.trainer_name,
      streak: row.streak,
      durationMs: row.duration_ms,
      isSelf: row.is_self,
    })),
  }
}
