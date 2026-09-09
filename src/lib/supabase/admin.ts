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
 * **Wofür er hier gebraucht wird, und wofür nicht.** Vier Aufrufer, alle mit
 * demselben Grund: Sie rufen Datenbankfunktionen auf, die absichtlich **nur für
 * `service_role`** ausführbar sind — könnte der Browser sie selbst aufrufen,
 * wäre der jeweilige Schutz wirkungslos oder sogar umkehrbar.
 *
 *   - `auth/throttle.ts` — der Fehlversuchszähler (`0003`). Aus dem Browser
 *     aufrufbar wäre die Drosselung eine Aussperr-Waffe: fünf Aufrufe mit fremder
 *     Adresse, und der Betroffene kommt nicht mehr an sein Konto.
 *   - `auth/trainer-name.ts` — die Verfügbarkeitsauskunft (`0006`). Freigegeben
 *     wäre sie ein bequemes Werkzeug, die Trainernamenliste abzuklopfen.
 *   - `quiz/round-state.ts` — die Rundenfunktionen (`0009`, `0012`, `0013`). Der
 *     Rundenzustand enthält die **Lösung** der offenen Frage; er ist deshalb für
 *     niemanden sonst lesbar (AC-32).
 *   - `leaderboard/queries.ts` — die Ranglisten-Funktion (`0015`). Sie umgeht
 *     RLS, um fremde Bestläufe herauszugeben; genau deshalb darf nur der Server
 *     sie aufrufen (PROJ-3, AC-19).
 *
 * Alles andere in dieser App läuft weiter über den normalen Client mit RLS.
 *
 * *(Diese Aufzählung stand bis zum 2026-09-08 als „Einzige Aufgabe ist der
 * Fehlversuchszähler" da und war seit den Rundenfunktionen falsch. PROJ-3 → T2
 * verlangte die Korrektur ausdrücklich, sie unterblieb beim Bau und fiel erst im
 * QA-Lauf auf.)*
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
