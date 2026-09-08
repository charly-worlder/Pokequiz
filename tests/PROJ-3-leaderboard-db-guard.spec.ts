import { expect, test } from './fixtures'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

/**
 * PROJ-3 — die Datenschicht der Weltrangliste (spec.md AC-2, AC-3, AC-5, AC-6,
 * AC-19, AC-20; EC-1, EC-5, EC-7).
 *
 * Diese Datei prüft nicht, wie die Rangliste **aussieht** — das tut
 * `PROJ-3-leaderboard-page-guard.spec.ts`. Sie prüft, ob die Datenbank hergibt,
 * was sie hergeben soll, und **nichts darüber hinaus**.
 *
 * Sie steht bewusst direkt hinter der Migration und nicht am Ende des Bauplans:
 * Offen gebliebene Tabellen- und Funktionsrechte sind in diesem Projekt zweimal
 * erst spät aufgefallen (BUG-110 — die Insert-Policy überlebte den Umbau der
 * Runde; BUG-122 — `revoke` erwischte drei Verben statt aller). Beide Male war
 * der Fehler nicht die Logik, sondern ein Recht, an das niemand mehr dachte.
 *
 * **Was hier bewusst NICHT geprüft wird, und warum.** Die Suite läuft parallel
 * in drei Browser-Projekten gegen **eine** Datenbank, in der gleichzeitig die
 * PROJ-2-Journeys Runden schreiben. Absolute Plätze („Alpha steht auf 1") sind
 * darin nicht zusicherbar — ein solcher Test misst die Nachbartests. Geprüft
 * wird deshalb zweierlei, beides unabhängig vom Fremdbestand:
 *   - **Invarianten**, die für jede Ausgabe gelten müssen, egal welche Daten es
 *     sonst gibt (Sortierung, Zeilenzahl, Eindeutigkeit der Plätze).
 *   - **Aussagen über das eigene, frisch angelegte Konto**, das kein anderer
 *     Test anfasst.
 * Die vierstufige Sortierregel gegen einen kontrollierten Bestand ist beim Bau
 * am 2026-09-08 in SQL nachgewiesen worden (100.000 Runden, 4.008 Spieler; der
 * Beleg steht in `design.md` → Technical Decisions und im Kopf von
 * `0015_leaderboard.sql`).
 */

function envFromLocalFile(key: string): string {
  const raw = readFileSync('.env.local', 'utf8')
  const line = raw.split(String.fromCharCode(10)).find((entry) => entry.startsWith(`${key}=`))
  return (line?.slice(key.length + 1).trim() ?? '') as string
}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? envFromLocalFile('NEXT_PUBLIC_SUPABASE_URL')
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? envFromLocalFile('NEXT_PUBLIC_SUPABASE_ANON_KEY')

const admin = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? envFromLocalFile('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const PASSWORD = 'E2ePasswort123!'

type Row = {
  rank: number
  trainer_name: string
  streak: number
  duration_ms: number
  is_self: boolean
}

/**
 * Ein frisches Konto samt Profil. Über den Administrationszugang statt über das
 * Registrierungsformular: Diese Datei prüft die Datenschicht, der Umweg über die
 * Oberfläche brächte nur die Drosselung aus PROJ-1 ins Spiel.
 */
async function makePlayer(prefix: string) {
  const trainer = `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`.slice(0, 20)
  const email = `${trainer.toLowerCase()}@example.com`

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { trainer_name: trainer },
  })
  expect(error, `Konto ${trainer} konnte nicht angelegt werden`).toBeNull()

  return { id: data.user!.id, trainer, email }
}

async function addRun(profileId: string, streak: number, durationMs: number) {
  const { error } = await admin
    .from('runs')
    .insert({ profile_id: profileId, streak, duration_ms: durationMs, round_id: crypto.randomUUID() })
  expect(error, 'Runde konnte nicht gesät werden').toBeNull()
}

async function leaderboardFor(profileId: string): Promise<Row[]> {
  const { data, error } = await admin.rpc('leaderboard_page', { p_profile: profileId })
  expect(error, 'leaderboard_page hat einen Fehler geliefert').toBeNull()
  return (data ?? []) as Row[]
}

test.describe('PROJ-3 — Zugriff auf die Ranglisten-Daten', () => {
  test('die Ranglisten-Funktion ist aus einer gewöhnlichen Sitzung nicht aufrufbar (AC-19)', async () => {
    const player = await makePlayer('guard')

    // Genau der Weg, den ein Angreifer nähme: der öffentliche Schlüssel, den
    // jeder Besucher im ausgelieferten JavaScript findet, plus eine echte,
    // selbst erworbene Sitzung.
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: signInError } = await asUser.auth.signInWithPassword({
      email: player.email,
      password: PASSWORD,
    })
    expect(signInError, 'Der Testaufbau selbst ist kaputt: Anmeldung fehlgeschlagen').toBeNull()

    const { error } = await asUser.rpc('leaderboard_page', { p_profile: player.id })

    // Der Nachweis ist der Fehler. Käme hier `null`, wäre die Rangliste mit
    // beliebigen Kennungen abklopfbar — und die Funktion umgeht RLS.
    expect(error, 'leaderboard_page war aus einer Nutzersitzung heraus aufrufbar').not.toBeNull()
  })

  test('fremde Runden bleiben über die Tabelle unlesbar (AC-19)', async () => {
    const mine = await makePlayer('own')
    const other = await makePlayer('other')
    await addRun(other.id, 7, 30_000)

    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await asUser.auth.signInWithPassword({ email: mine.email, password: PASSWORD })

    const { data } = await asUser.from('runs').select('id').eq('profile_id', other.id)

    // Die Lesepolicy `runs_select_own` (0002) liefert hier keine Zeilen — nicht
    // einen Fehler, sondern eine leere Menge. Beides wäre recht; eine gefüllte
    // wäre die vollständige Historie eines fremden Spielers.
    expect(data ?? []).toHaveLength(0)
  })
})

test.describe('PROJ-3 — Invarianten jeder Ausgabe', () => {
  test('die Reihenfolge ist Serie absteigend, bei Gleichstand Zeit aufsteigend (AC-3)', async () => {
    const player = await makePlayer('order')
    await addRun(player.id, 12, 45_000)

    const rows = await leaderboardFor(player.id)
    expect(rows.length).toBeGreaterThan(0)

    // Gilt für jede beliebige Datenlage — deshalb ist der Test gegen die
    // parallel schreibenden Nachbartests unempfindlich.
    for (let i = 1; i < rows.length; i += 1) {
      const above = rows[i - 1]
      const below = rows[i]
      const inOrder =
        above.streak > below.streak ||
        (above.streak === below.streak && above.duration_ms <= below.duration_ms)
      expect(inOrder, `Zeile ${i} steht falsch: ${JSON.stringify(above)} vor ${JSON.stringify(below)}`).toBe(true)
    }
  })

  test('höchstens fünf Listenplätze und höchstens eine eigene Zeile (AC-6, AC-8)', async () => {
    const player = await makePlayer('shape')
    await addRun(player.id, 3, 20_000)

    const rows = await leaderboardFor(player.id)

    expect(rows.filter((r) => r.rank <= 5).length).toBeLessThanOrEqual(5)
    expect(rows.filter((r) => r.is_self).length).toBeLessThanOrEqual(1)
    // Die Plätze sind lückenlos aufsteigend und nie doppelt — es gibt genau eine
    // Nummerierung (AC-4).
    expect(rows.map((r) => r.rank)).toEqual([...rows.map((r) => r.rank)].sort((a, b) => a - b))
    expect(new Set(rows.map((r) => r.rank)).size).toBe(rows.length)
  })

  test('die Ausgabe enthält keine Konto-Kennung und keine E-Mail-Adresse (AC-20)', async () => {
    const player = await makePlayer('fields')
    await addRun(player.id, 4, 25_000)

    const rows = await leaderboardFor(player.id)
    expect(rows.length).toBeGreaterThan(0)

    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([
        'duration_ms',
        'is_self',
        'rank',
        'streak',
        'trainer_name',
      ])
    }
    // Zusätzlich gegen den Rohtext, damit eine später hinzugefügte Spalte
    // auffällt, auch wenn sie anders heißt.
    expect(JSON.stringify(rows)).not.toContain(player.id)
    expect(JSON.stringify(rows)).not.toContain('@')
  })
})

test.describe('PROJ-3 — Regeln am eigenen Konto', () => {
  test('von vielen Runden erscheint genau der beste Lauf, genau einmal (AC-2, EC-5, EC-7)', async () => {
    const player = await makePlayer('best')
    await addRun(player.id, 5, 90_000)
    await addRun(player.id, 9, 70_000) // der beste
    await addRun(player.id, 7, 10_000) // schneller, aber kürzere Serie
    await addRun(player.id, 9, 70_000) // stellt den besten exakt ein (EC-5)

    const mine = (await leaderboardFor(player.id)).filter((r) => r.is_self)

    expect(mine, 'Der Spieler muss genau eine Zeile haben').toHaveLength(1)
    expect(mine[0].streak).toBe(9)
    expect(mine[0].duration_ms).toBe(70_000)
  })

  test('ein Konto mit ausschließlich Serie 0 kommt nicht in die Wertung (AC-5)', async () => {
    const player = await makePlayer('zero')
    await addRun(player.id, 0, 3_000)
    await addRun(player.id, 0, 1_000)

    const rows = await leaderboardFor(player.id)

    expect(rows.filter((r) => r.is_self)).toHaveLength(0)
    expect(rows.some((r) => r.trainer_name === player.trainer)).toBe(false)
  })

  test('zwei Aufrufe hintereinander liefern denselben eigenen Stand (EC-1)', async () => {
    const player = await makePlayer('stable')
    await addRun(player.id, 6, 55_000)

    const first = (await leaderboardFor(player.id)).find((r) => r.is_self)
    const second = (await leaderboardFor(player.id)).find((r) => r.is_self)

    expect(first).toBeDefined()
    // Bewusst die eigene Zeile und nicht die ganze Liste: Ein Nachbartest, der
    // zwischen den beiden Aufrufen eine bessere Runde schreibt, würde die Liste
    // zu Recht verändern. Der eigene Eintrag bleibt davon unberührt.
    expect(second).toEqual(first)
  })
})
