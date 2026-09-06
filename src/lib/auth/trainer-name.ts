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
 * **Warum eine Datenbankfunktion und keine Abfrage von hier aus (BUG-74).** Die
 * erste Fassung fragte mit PostgREST `ilike` — und traf damit eine andere
 * Entscheidung als der Trigger: In einem LIKE-Muster ist `_` ein Platzhalter, in
 * einem Trainernamen ein erlaubtes Zeichen. `'AshX1' ilike 'Ash_1'` ist wahr,
 * obwohl `Ash_1` frei ist. Dazu kam, dass `ilike` den Funktionsindex nicht
 * benutzen kann und als Seq Scan lief — auf einem Fehlerpfad, den ein Fremder
 * auslösen kann, ist das ein Verstärker. `is_trainer_name_taken` (Migration
 * `0006`) macht denselben Vergleich wie der Trigger und trifft den Index.
 *
 * **Die Nachfrage läuft nur auf dem Fehlerpfad** — der geglückte Weg kostet keine
 * zusätzliche Abfrage.
 */
export async function isTrainerNameTaken(trainerName: string): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('is_trainer_name_taken', { p_name: trainerName })

    if (error) return false
    return data === true
  } catch {
    // Die Nachfrage selbst ist gescheitert — dann ist die Datenbank das Problem,
    // nicht der Name. `false` führt den Aufrufer zur Störungsmeldung, und das ist
    // in diesem Fall die zutreffende: lieber „etwas ist schiefgelaufen" als eine
    // erfundene Aussage über den Trainernamen.
    return false
  }
}
