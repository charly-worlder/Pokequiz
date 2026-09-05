import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Beantwortet die eine Frage, die das Fehlerobjekt von Supabase nicht beantwortet:
 * War der Trainername schon vergeben?
 *
 * **Warum es diese Nachfrage braucht (BUG-68).** Der Signup-Trigger aus
 * `0001_profiles.sql` wirft bei einem doppelten Trainernamen ausdrücklich
 * `trainer_name_taken`. GoTrue reicht diesen Text aber **nicht** durch: Beim
 * Client kommt `AuthRetryableFetchError`, Status 500, `code: undefined`,
 * `message: "Database error saving new user"` an — gemessen am 2026-09-05 gegen
 * die lokale Instanz mit demselben `supabase-js`, das die App benutzt. Ein echter
 * Datenbankausfall während der Registrierung erzeugt dieselbe Antwort.
 *
 * Vorher wurde deshalb **jeder** 500 als „Trainername bereits vergeben" gedeutet.
 * Das machte EC-1 richtig und alles andere falsch: Bei einer Störung las der
 * Nutzer, sein Wunschname sei weg, und probierte einen zweiten, dritten, vierten.
 *
 * **Die Nachfrage läuft nur auf dem Fehlerpfad** — der geglückte Weg kostet keine
 * zusätzliche Abfrage.
 *
 * `profiles` ist für `anon` nicht lesbar (RLS, `0001_profiles.sql`), und der
 * normale Server-Client der Registrierung hat noch keine Sitzung. Deshalb der
 * Admin-Client. Er erfährt hier ausschließlich, **ob** ein Name vergeben ist —
 * genau die Auskunft, die AC-2 dem Nutzer ohnehin gibt.
 */
export async function isTrainerNameTaken(trainerName: string): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('profiles')
      .select('id')
      .ilike('trainer_name', trainerName)
      .limit(1)
      .maybeSingle()

    if (error) return false
    return data !== null
  } catch {
    // Die Nachfrage selbst ist gescheitert — dann ist die Datenbank das Problem,
    // nicht der Name. `false` führt den Aufrufer zur Störungsmeldung, und das ist
    // in diesem Fall die zutreffende: lieber „etwas ist schiefgelaufen" als eine
    // erfundene Aussage über den Trainernamen.
    return false
  }
}
