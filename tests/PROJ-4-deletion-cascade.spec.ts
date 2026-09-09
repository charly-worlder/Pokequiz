import { expect, test } from './fixtures'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

/**
 * PROJ-4 — die Löschkette (spec.md AC-10, AC-13, AC-17, AC-18, AC-22; EC-2,
 * EC-3, EC-5, EC-6, EC-10).
 *
 * **Warum diese Datei die wichtigste des Features ist.** Die Löschung verlässt
 * sich auf vier Fremdschlüssel und einen Trigger, die in **drei verschiedenen
 * Migrationen** stehen (`0001`, `0002`, `0005`, `0007`) und bis heute **nie im
 * Löschfall zusammen ausgelöst** wurden. `0002` trägt seit dem 30.08. den
 * Kommentar, die Löschung erreiche die Runden — geprüft hatte das niemand.
 * Dieses Projekt hat mit BUG-36 und BUG-56 zweimal erlebt, was eine Zusage im
 * Kommentar ohne Code dahinter wert ist.
 *
 * **Beide Richtungen, und das ist der Punkt.** Ein Test, der nur „gelöscht"
 * prüft, übersieht den Fall, an dem EC-3 hängt: Scheitert die Löschung, muss
 * **alles** stehen bleiben. Der zweite Block erzwingt das Scheitern mit einem
 * absichtlich werfenden Trigger und zählt danach jede der fünf Spuren nach.
 *
 * Kein Browser nötig — geprüft wird die Datenbank, nicht die Anzeige.
 */

function envFromLocalFile(key: string): string {
  const raw = readFileSync('.env.local', 'utf8')
  const line = raw.split(String.fromCharCode(10)).find((entry) => entry.startsWith(`${key}=`))
  return (line?.slice(key.length + 1).trim() ?? '') as string
}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? envFromLocalFile('NEXT_PUBLIC_SUPABASE_URL')

const admin = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? envFromLocalFile('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const PASSWORD = 'E2ePasswort123!'

/**
 * Führt SQL mit Server-Rechten aus.
 *
 * **Warum über den Container und nicht über einen Postgres-Client:** Das Projekt
 * hat keinen als Abhängigkeit, und einen für einen einzigen Test hinzuzufügen
 * wäre Scope-Ausweitung. Der Containername wird aus `supabase/config.toml`
 * abgeleitet statt festgeschrieben — sonst bricht der Test, sobald jemand das
 * Projekt umbenennt.
 *
 * Gebraucht wird das **nur** für den Fehlschlag-Block: Einen Trigger anzulegen,
 * der die Löschung zum Scheitern bringt, geht über keine Datenschnittstelle.
 */
function dbContainer(): string {
  const toml = readFileSync('supabase/config.toml', 'utf8')
  const match = toml.match(/^project_id\s*=\s*"([^"]+)"/m)
  if (!match) throw new Error('project_id nicht in supabase/config.toml gefunden')
  return `supabase_db_${match[1]}`
}

function runSql(sql: string) {
  execFileSync(
    'docker',
    ['exec', '-i', dbContainer(), 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { stdio: 'pipe' }
  )
}

/** Eindeutig je Lauf und je Test — die Suite läuft parallel gegen eine Datenbank. */
function unique(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
}

/** Legt ein Konto mit Profil, zwei Runden, laufender Runde und Zählerzeilen an. */
async function seedPlayer() {
  const trainerName = unique('Del')
  const email = `${trainerName.toLowerCase()}@example.de`

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { trainer_name: trainerName },
  })
  expect(createError, 'Konto anlegen').toBeNull()
  const userId = created!.user!.id

  // Zwei abgeschlossene Runden — eine gewertete und eine Nullrunde, damit die
  // Löschung beide Sorten erfassen muss.
  const { error: runsError } = await admin.from('runs').insert([
    { profile_id: userId, streak: 7, duration_ms: 40_000, round_id: crypto.randomUUID() },
    { profile_id: userId, streak: 0, duration_ms: 1_200, round_id: crypto.randomUUID() },
  ])
  expect(runsError, 'Runden anlegen').toBeNull()

  // Eine **laufende** Runde (EC-2): Sie muss mitgehen, nicht nur die fertigen.
  const { error: activeError } = await admin
    .from('active_runs')
    .insert({ profile_id: userId, streak: 3, accumulated_ms: 9_000 })
  expect(activeError, 'laufende Runde anlegen').toBeNull()

  // Alle vier Konto-Scopes, darunter der neue aus AC-15. Genau er wäre der
  // Aufzählung in `0005` entgangen — das ist der Grund für Migration `0017`.
  const accountKeys = [
    `login:account:${email}`,
    `register:account:${email}`,
    `password-reset:account:${email}`,
    `account-delete:account:${email}`,
  ]
  const { error: throttleError } = await admin
    .from('auth_throttle')
    .insert(accountKeys.map((key) => ({ key, attempts: 2 })))
  expect(throttleError, 'Zählerzeilen anlegen').toBeNull()

  return { userId, email, trainerName, accountKeys }
}

async function countRows(table: string, userId: string) {
  const { count, error } = await admin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', userId)
  expect(error, `${table} zählen`).toBeNull()
  return count ?? -1
}

async function countThrottleKeys(keys: string[]) {
  const { count, error } = await admin
    .from('auth_throttle')
    .select('*', { count: 'exact', head: true })
    .in('key', keys)
  expect(error, 'Zählerzeilen zählen').toBeNull()
  return count ?? -1
}

async function authUserExists(userId: string) {
  const { data } = await admin.auth.admin.getUserById(userId)
  return Boolean(data?.user)
}

test.describe('PROJ-4 — Löschkette', () => {
  test('gelingt sie, ist jede der fünf Spuren weg (AC-10, AC-17, AC-22)', async () => {
    const player = await seedPlayer()

    // Eine fremde Zählerzeile und eine IP-Zeile, die **überleben** müssen.
    const foreignKey = `login:account:${unique('fremd')}@example.de`
    const ipKey = `login:ip:${unique('203.0.113.')}`
    await admin.from('auth_throttle').insert([
      { key: foreignKey, attempts: 4 },
      { key: ipKey, attempts: 4 },
    ])

    // Vorher: alles da.
    expect(await authUserExists(player.userId)).toBe(true)
    expect(await countRows('runs', player.userId)).toBe(2)
    expect(await countRows('active_runs', player.userId)).toBe(1)
    expect(await countThrottleKeys(player.accountKeys)).toBe(4)

    const { error } = await admin.auth.admin.deleteUser(player.userId)
    expect(error, 'harte Löschung').toBeNull()

    // Nachher: jede Tabelle einzeln nachgezählt — nicht "die Aktion warf nicht".
    expect(await authUserExists(player.userId), 'Auth-Konto').toBe(false)
    const { count: profileCount } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('id', player.userId)
    expect(profileCount, 'Profil').toBe(0)
    expect(await countRows('runs', player.userId), 'Runden').toBe(0)
    expect(await countRows('active_runs', player.userId), 'laufende Runde').toBe(0)
    expect(await countThrottleKeys(player.accountKeys), 'Konto-Zählerzeilen').toBe(0)

    // Und was **nicht** mitgehen darf (BUG-39, und der `_`-Fallstrick aus `0017`).
    expect(await countThrottleKeys([ipKey]), 'IP-Zeile bleibt').toBe(1)
    expect(await countThrottleKeys([foreignKey]), 'fremdes Konto bleibt').toBe(1)
  })

  test('scheitert sie, bleibt jede der fünf Spuren stehen (EC-3)', async () => {
    const player = await seedPlayer()

    // Ein Trigger, der beim Löschen genau dieses Kontos wirft. Er zwingt die
    // ganze Transaktion zum Zurückrollen — der Fall, für den EC-3 geschrieben
    // ist und der sonst nie eintritt.
    const guardSql = `
      create or replace function public.proj4_fail_delete() returns trigger
        language plpgsql as $$
        begin raise exception 'PROJ-4 Testabbruch'; end; $$;
      create trigger proj4_fail_delete_trg before delete on auth.users
        for each row when (old.id = '${player.userId}') execute function public.proj4_fail_delete();
    `
    await runSql(guardSql)

    try {
      const { error } = await admin.auth.admin.deleteUser(player.userId)
      expect(error, 'Löschung muss scheitern').not.toBeNull()

      expect(await authUserExists(player.userId), 'Auth-Konto bleibt').toBe(true)
      expect(await countRows('runs', player.userId), 'Runden bleiben').toBe(2)
      expect(await countRows('active_runs', player.userId), 'laufende Runde bleibt').toBe(1)
      expect(await countThrottleKeys(player.accountKeys), 'Zählerzeilen bleiben').toBe(4)
    } finally {
      await runSql('drop trigger if exists proj4_fail_delete_trg on auth.users;')
      await admin.auth.admin.deleteUser(player.userId)
    }
  })

  test('gibt Name und Adresse wieder frei, ohne Altlast (AC-13, EC-6, EC-10)', async () => {
    const player = await seedPlayer()
    await admin.auth.admin.deleteUser(player.userId)

    const { data: reborn, error } = await admin.auth.admin.createUser({
      email: player.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { trainer_name: player.trainerName },
    })
    expect(error, 'Neuanlage mit derselben Adresse und demselben Namen').toBeNull()

    const newId = reborn!.user!.id
    expect(newId, 'neue Kennung').not.toBe(player.userId)
    expect(await countRows('runs', newId), 'keine geerbten Runden').toBe(0)
    expect(await countRows('active_runs', newId), 'keine geerbte Runde').toBe(0)

    await admin.auth.admin.deleteUser(newId)
  })

  test('nimmt den Spieler aus der Rangliste (AC-18, EC-5)', async () => {
    const player = await seedPlayer()

    const before = await admin.rpc('leaderboard_page', { p_profile: player.userId })
    expect(
      (before.data ?? []).some((row: { trainer_name: string }) => row.trainer_name === player.trainerName),
      'vorher in der Rangliste'
    ).toBe(true)

    await admin.auth.admin.deleteUser(player.userId)

    const after = await admin.rpc('leaderboard_page', { p_profile: player.userId })
    expect(after.error, 'Rangliste bleibt abrufbar').toBeNull()
    expect(
      (after.data ?? []).some((row: { trainer_name: string }) => row.trainer_name === player.trainerName),
      'nachher nicht mehr in der Rangliste'
    ).toBe(false)
  })
})

