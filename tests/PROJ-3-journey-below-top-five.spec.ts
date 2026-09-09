import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { expect, test } from './fixtures'
import { register } from './helpers'

/**
 * Journey 3 — der Spieler außerhalb der Top-5.
 *
 * Die zweite User Story der Spec wörtlich: „Als Spieler außerhalb der Top-5
 * möchte ich meine eigene Platzierung und den Abstand zur Top-5 sehen, damit
 * ich ein erreichbares Ziel habe statt einer Liste von Fremden." Für die
 * überwiegende Mehrheit der Spieler ist **das** die Rangliste — die Top-5 sieht
 * jeder, die eigene Zeile darunter ist das, was ihn wiederkommen lässt.
 *
 * Deckt AC-7 (abgesetzte Zeile mit „Platz N — noch X bis Top 5"), AC-10 (auch
 * diese Zeile ist hervorgehoben) und EC-2 (der Wortlaut und die Rechnung
 * dahinter). Und beiläufig AC-4: Der Platz in der abgesetzten Zeile und die
 * Zahl im Satz darunter stammen aus **einer** Nummerierung — laufen sie
 * auseinander, ist es hier sichtbar.
 *
 * **Warum dieser Test Daten sät.** Außerhalb der Top-5 zu stehen setzt fünf
 * bessere Läufe voraus. Sie zu erspielen wäre nicht nur langsam, sondern
 * unzuverlässig: Die Serie hängt daran, wie viele Fragen die Maschine in der
 * Zeit schafft. Die fünf Gegner entstehen deshalb über den
 * Administrationszugang — denselben Weg, den `PROJ-3-leaderboard-db-guard`
 * schon nimmt.
 *
 * **Was dabei bewusst NICHT zugesichert wird: der Platz 6.** EC-2 nennt ihn
 * wörtlich, aber die Suite läuft parallel in drei Browser-Projekten gegen eine
 * Datenbank, in der andere Journeys gleichzeitig Läufe schreiben — auch dieser
 * Test selbst, dreimal. Ein zugesicherter Platz 6 misst die Nachbartests.
 * Zugesichert wird stattdessen das, was EC-2 tatsächlich behauptet und was bei
 * jedem Platz gelten muss: die **Form** des Satzes und die **Rechnung**
 * `X = N − 5`. Ein „noch 1", das bei Platz 12 stehen bliebe, fällt damit auf.
 */

function envFromLocalFile(key: string): string {
  const raw = readFileSync('.env.local', 'utf8')
  const line = raw.split(String.fromCharCode(10)).find((entry) => entry.startsWith(`${key}=`))
  return (line?.slice(key.length + 1).trim() ?? '') as string
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? envFromLocalFile('NEXT_PUBLIC_SUPABASE_URL'),
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? envFromLocalFile('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } }
)

/**
 * Die höchste Serie, die das Datenmodell kennt (`design.md` → Data Model:
 * „Ganzzahl, 1–386"). Fünf Läufe damit sind von keinem erspielten Lauf dieser
 * Suite einholbar — die Journeys hier beantworten zwei bis drei Fragen.
 */
const UNSCHLAGBAR = 386

async function seedCompetitor(index: number) {
  const trainer = `e2eTop_${Date.now().toString(36)}${index}${Math.floor(Math.random() * 1e4).toString(36)}`.slice(0, 20)

  const { data, error } = await admin.auth.admin.createUser({
    email: `${trainer.toLowerCase()}@example.com`,
    password: 'E2ePasswort123!',
    email_confirm: true,
    user_metadata: { trainer_name: trainer },
  })
  expect(error, `Gegner ${trainer} konnte nicht angelegt werden`).toBeNull()

  const { error: runError } = await admin.from('runs').insert({
    profile_id: data.user!.id,
    streak: UNSCHLAGBAR,
    // Verschiedene Zeiten, damit die fünf untereinander eine eindeutige
    // Reihenfolge haben und nicht die dritte Sortierstufe entscheiden muss.
    duration_ms: 1000 + index * 1000,
    round_id: crypto.randomUUID(),
  })
  expect(runError, `Lauf für ${trainer} konnte nicht gesät werden`).toBeNull()
}

test('Außerhalb der Top-5 zeigt die Rangliste den eigenen Platz und den Abstand (AC-7, AC-10, EC-2)', async ({
  page,
}) => {
  const { trainer } = await register(page, 'e2eRang')

  const { data: profile, error } = await admin
    .from('profiles')
    .select('id')
    .eq('trainer_name', trainer)
    .single()
  expect(error, 'Das eben registrierte Profil ist nicht auffindbar').toBeNull()

  // Ein eigener, gewerteter, aber schwacher Lauf — er bringt den Spieler in die
  // Wertung, ohne ihn in die Nähe der Top-5 zu bringen.
  const { error: eigenerLauf } = await admin.from('runs').insert({
    profile_id: profile!.id,
    streak: 1,
    duration_ms: 900_000,
    round_id: crypto.randomUUID(),
  })
  expect(eigenerLauf, 'Der eigene Lauf konnte nicht gesät werden').toBeNull()

  // Fünf unschlagbare Gegner. Damit ist Platz ≥ 6 zugesichert, egal was sonst
  // in der Datenbank steht.
  for (let i = 0; i < 5; i += 1) await seedCompetitor(i)

  await page.goto('/leaderboard')

  const listen = page.locator('main section ul')

  // AC-6 — die Liste hat genau fünf Plätze. Sechs `li`, weil die
  // Spaltenüberschriften dasselbe Raster benutzen und deshalb als Zeile im
  // Baum stehen (`aria-hidden`, für Screenreader unsichtbar).
  await expect(listen.first().locator('li')).toHaveCount(6)

  // AC-7 — der eigene Name steht **nicht** in der Liste, sondern darunter.
  // Stünde er in beiden, sähe der Spieler sich zweimal.
  await expect(
    listen.first().getByText(trainer, { exact: true }),
    'Der eigene Name steht in der Top-5, obwohl fünf bessere Läufe existieren'
  ).toHaveCount(0)

  // Die abgesetzte Zeile: eigenes `ul` unterhalb der Liste, genau eine Zeile.
  const eigeneZeile = listen.nth(1).locator('li')
  await expect(eigeneZeile, 'Es gibt keine abgesetzte eigene Zeile unter der Liste').toHaveCount(1)
  await expect(eigeneZeile).toContainText(trainer)

  // AC-10 — auch außerhalb der Top-5 ist die eigene Zeile hervorgehoben.
  await expect(
    eigeneZeile.getByText('Du', { exact: true }),
    'Die abgesetzte eigene Zeile ist nicht als eigene markiert'
  ).toHaveCount(1)

  // EC-2 — Wortlaut und Rechnung. Der Satz muss diese Form haben; „noch X
  // Plätze bis Top 5" wäre inhaltlich richtig und trotzdem nicht der Vertrag
  // (das war BUG-C im QA-Lauf vom 2026-09-08).
  const satz = page.getByText(/^Platz \d+ — noch \d+ bis Top 5$/)
  await expect(satz, 'Der Satz „Platz N — noch X bis Top 5" steht nicht in dieser Form da').toHaveCount(1)

  const text = await satz.innerText()
  const treffer = text.match(/^Platz (\d+) — noch (\d+) bis Top 5$/)
  expect(treffer, `Unerwarteter Wortlaut: ${text}`).not.toBeNull()

  const platz = Number(treffer![1])
  const abstand = Number(treffer![2])

  expect(platz, 'Der eigene Platz liegt trotz fünf besserer Läufe in der Top-5').toBeGreaterThan(5)
  expect(abstand, `Bei Platz ${platz} müssten ${platz - 5} Plätze bis Top 5 fehlen, angezeigt sind ${abstand}`).toBe(
    platz - 5
  )

  // AC-4 — der Platz in der Zeile und die Zahl im Satz stammen aus derselben
  // Nummerierung. Zwei getrennte Berechnungen liefen bei einem Gleichstand
  // auseinander, und genau das ist der Fehler, der erst im Betrieb auffällt.
  await expect(
    eigeneZeile.locator('> span').nth(0),
    'Der Platz in der Zeile weicht vom Platz im Satz darunter ab'
  ).toHaveText(String(platz))
})
