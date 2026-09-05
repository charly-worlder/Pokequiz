import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Der Supabase-Client mit dem **Service-Role-Schlüssel**.
 *
 * Dieser Schlüssel hebt Row Level Security vollständig auf. Er darf deshalb
 * ausschließlich hier entstehen, ausschließlich serverseitig, und niemals in eine
 * Variable mit `NEXT_PUBLIC_`-Präfix geraten — ein solches Präfix backt den Wert
 * in das ausgelieferte JavaScript und gibt ihn jedem Besucher (siehe
 * `.claude/rules/security.md` → Secrets Management). `server-only` oben lässt den
 * Build abbrechen, falls diese Datei je aus einer Client-Komponente importiert
 * wird.
 *
 * **Wofür er hier gebraucht wird, und wofür nicht.** Einzige Aufgabe ist der
 * Fehlversuchszähler aus `0003_auth_throttle.sql`. Dessen Funktionen sind
 * absichtlich nur für `service_role` ausführbar: Könnte der Browser sie selbst
 * aufrufen, wäre die Drosselung eine Aussperr-Waffe — fünf Aufrufe mit fremder
 * Adresse, und der Betroffene kommt nicht mehr an sein Konto. Alles andere in
 * dieser App läuft weiter über den normalen Client mit RLS.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    // Bewusst laut und bewusst *geschlossen*: Fehlt der Schlüssel, ist die
    // Drosselung nicht da — und ein stiller Weiterlauf hieße, dass der Schutz
    // genau dann fehlt, wenn niemand hinsieht. Der Aufrufer macht daraus eine
    // Absage an den Nutzer, keine stillschweigende Freigabe.
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY fehlt. Die Drosselung der Anmelde-Pfade kann ohne ihn nicht zählen; ' +
        'siehe .env.local.example.'
    )
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
