import { expect, test } from './fixtures'
import {
  answerCorrectly,
  answerWrongly,
  currentToken,
  questionImage,
  register,
  waitForQuestion,
} from './helpers'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

/**
 * Journey 4 — die serverseitige Autorität (spec.md AC-12, AC-14, AC-32, AC-33;
 * EC-1, EC-7, EC-15).
 *
 * Diese Datei prüft nicht, ob das Spiel funktioniert — das tun die anderen drei.
 * Sie prüft, ob es sich **fälschen** lässt. Der Anlass steht in `spec.md` →
 * Decision Log: Bis zum 2026-09-06 genügte ein von Hand gebauter Aufruf, um
 * Serie 386 einzutragen, und die Rangliste wäre damit dauerhaft wertlos gewesen.
 */

function envFromLocalFile(key: string): string {
  const raw = readFileSync('.env.local', 'utf8')
  const line = raw
    .split(String.fromCharCode(10))
    .find((entry) => entry.startsWith(`${key}=`))
  return (line?.slice(key.length + 1).trim() ?? '') as string
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? envFromLocalFile('NEXT_PUBLIC_SUPABASE_URL'),
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? envFromLocalFile('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } }
)

async function profileIdFor(trainer: string) {
  const { data } = await admin.from('profiles').select('id').eq('trainer_name', trainer).maybeSingle()
  expect(data, `Kein Profil zu ${trainer}`).toBeTruthy()
  return (data as { id: string }).id
}

test('Der Browser schickt kein Ergebnis — er kann keines schicken (AC-12, AC-33)', async ({
  page,
}) => {
  const { trainer } = await register(page, 'e2eAuth')

  // Jeder ausgehende Rumpf dieser Runde wird mitgeschrieben.
  const bodies: string[] = []
  page.on('request', (req) => {
    if (req.method() === 'POST') bodies.push(req.postData() ?? '')
  })

  await page.getByRole('button', { name: 'Runde starten' }).click()
  await waitForQuestion(page)
  await answerCorrectly(page)
  await waitForQuestion(page)
  await answerCorrectly(page)
  await waitForQuestion(page)

  await answerWrongly(page)
  await expect(page.getByRole('status')).toContainText('Richtig wäre')
  await page.getByRole('button', { name: 'Weiter zum Ergebnis' }).click()

  // Kein Rumpf trägt eine Serie, eine Dauer oder eine Runden-Kennung. Es gibt
  // schlicht kein Feld, in das ein Fälscher etwas eintragen könnte.
  const all = bodies.join('\n')
  expect(all, 'Der Browser schickt keine Serie mit').not.toContain('streak')
  expect(all, 'Der Browser schickt keine Dauer mit').not.toContain('durationMs')
  expect(all, 'Der Browser vergibt kein Runden-Kennzeichen mehr').not.toContain('RoundId')

  // Und die gespeicherte Zeile trägt genau das, was gespielt wurde.
  const profileId = await profileIdFor(trainer)
  const { data: runs } = await admin
    .from('runs')
    .select('streak, duration_ms')
    .eq('profile_id', profileId)

  expect(runs).toHaveLength(1)
  expect(runs?.[0].streak, 'Zwei richtige Antworten, also Serie 2 (AC-33)').toBe(2)
  expect(runs?.[0].duration_ms, 'Die Zeit misst der Server (AC-34)').toBeGreaterThan(0)
})

test('Der Rundenzustand ist nach dem Rundenende gelöscht (AC-39)', async ({ page }) => {
  const { trainer } = await register(page, 'e2eState')
  const profileId = await profileIdFor(trainer)

  await page.getByRole('button', { name: 'Runde starten' }).click()
  await waitForQuestion(page)

  const during = await admin.from('active_runs').select('profile_id').eq('profile_id', profileId)
  expect(during.data, 'Während der Runde gibt es einen Zustand').toHaveLength(1)

  await answerWrongly(page)
  await expect(page.getByRole('status')).toContainText('Richtig wäre')
  await page.getByRole('button', { name: 'Weiter zum Ergebnis' }).click()
  await expect(page.getByText('Runde beendet')).toBeVisible()

  const after = await admin.from('active_runs').select('profile_id').eq('profile_id', profileId)
  expect(after.data, 'Nach dem Rundenende ist er weg — im selben Vorgang (AC-39)').toHaveLength(0)
})

test('Die Bildadresse verrät die Pokémon-Nummer nicht (AC-32)', async ({ page }) => {
  await register(page, 'e2eOpaque')
  await page.getByRole('button', { name: 'Runde starten' }).click()
  await waitForQuestion(page)

  const src = (await questionImage(page).getAttribute('src')) ?? ''
  expect(src).toMatch(new RegExp('^/api/question/[0-9a-f-]{36}/image$'))

  // Weder die Nummer noch die CDN-Adresse stehen irgendwo im Dokument.
  const html = await page.content()
  expect(html).not.toContain('official-artwork')
  expect(html).not.toContain('githubusercontent')
  expect(html).not.toContain('_next/image')
})

test('Ein erfundenes Frage-Token liefert kein Bild (AC-32)', async ({ page }) => {
  await register(page, 'e2eToken')
  await page.getByRole('button', { name: 'Runde starten' }).click()
  await waitForQuestion(page)

  // Formal gültig (Version 4, richtige Variante) und trotzdem fremd — sonst
  // scheitert die Anfrage schon am Schema und sagt nichts über die Token-Prüfung.
  // Genau daran war dieser Test bis zur Rot-Gegenprobe am 2026-09-06 falsch-grün.
  const invented = await page.request.get('/api/question/11111111-2222-4333-8444-555555555555/image')
  expect(invented.status(), 'Ein fremdes Token darf kein Bild ergeben').toBe(404)

  const notEvenAToken = await page.request.get('/api/question/25/image')
  expect(notEvenAToken.status(), 'Und eine Pokémon-Nummer erst recht nicht').toBe(404)
})

test('Eine Antwort aus einem verwaisten Tab wird abgewiesen (AC-36, EC-15)', async ({
  page,
  context,
}) => {
  await register(page, 'e2eTabs')

  await page.getByRole('button', { name: 'Runde starten' }).click()
  await waitForQuestion(page)
  const firstToken = await currentToken(page)

  // Zweiter Tab derselben Sitzung startet eine neue Runde — die erste ist damit
  // verworfen (AC-36).
  const second = await context.newPage()
  await second.goto('/')
  await second.getByRole('button', { name: 'Runde starten' }).click()
  await waitForQuestion(second)
  expect(await currentToken(second)).not.toBe(firstToken)

  // Der erste Tab antwortet auf seine — jetzt tote — Frage.
  await page.getByRole('group', { name: 'Vier Antwortmöglichkeiten' }).getByRole('button').first().click()

  await expect(page.getByText('Diese Runde ist nicht mehr offen')).toBeVisible()
  await second.close()
})

/**
 * **Was dieser Test belegt — und was nicht.** Die Rot-Gegenprobe am 2026-09-06 hat
 * ihn als falsch-grün entlarvt: Nimmt man die Sitzungsprüfung aus der Bild-Route
 * heraus, bleibt er trotzdem grün, weil der Proxy unangemeldete Aufrufe schon
 * vorher auf die Anmeldung umleitet. Er zeigt also: **Ein Fremder bekommt kein
 * Bild** — nicht, dass die Route selbst prüft.
 *
 * Dass sie selbst prüft, hält der Unit-Test der Route fest ('weist einen Aufruf ohne
 * Sitzung ab'); dieser Test ist dort rot, wenn die Prüfung fehlt. Beide zusammen
 * decken EC-7 ab, keiner allein.
 */
test('Ein Fremder bekommt kein Bild und keine Runde (EC-7, AC-13)', async ({ page, browser }) => {
  await register(page, 'e2eNoSession')
  await page.getByRole('button', { name: 'Runde starten' }).click()
  await waitForQuestion(page)
  const token = await currentToken(page)

  // Bewusst ein **frischer** Kontext: Der eigene Tab hat das Bild schon geladen
  // und dürfte es aus seinem Cache nehmen (AC-10 will genau das). Geprüft werden
  // soll hier aber der Server, nicht der Cache.
  const stranger = await browser.newContext()
  const response = await stranger.request.get(`http://localhost:3000/api/question/${token}/image`)
  // Entweder 401 direkt aus der Route, oder die Umleitung des Proxys auf die
  // Anmeldung — Playwright folgt ihr. Beides ist richtig; ein Bild ist es nicht.
  expect(response.headers()['content-type'] ?? '', 'Ein Fremder bekommt kein Bild').not.toContain(
    'image/'
  )
  expect([401, 200]).toContain(response.status())
  if (response.status() === 200) expect(response.url()).toContain('/login')
  await stranger.close()

  // Und der abgemeldete Nutzer kommt nicht mehr an die Runde.
  await page.getByRole('button', { name: /Abmelden/ }).click()
  await page.waitForURL('/login')
  await page.goto('/')
  await page.waitForURL(new RegExp('/login'))
})
