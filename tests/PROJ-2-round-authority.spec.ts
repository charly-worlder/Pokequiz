import { expect, test } from './fixtures'
import {
  answerCorrectly,
  answerWrongly,
  currentToken,
  questionImage,
  PASSWORD,
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

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? envFromLocalFile('NEXT_PUBLIC_SUPABASE_URL')
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? envFromLocalFile('NEXT_PUBLIC_SUPABASE_ANON_KEY')

const admin = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? envFromLocalFile('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } }
)

/** Die Kennung der gerade laufenden Runde — der Browser kennt sie auch, sie verrät nichts. */
async function activeRoundId(profileId: string) {
  const { data } = await admin
    .from('active_runs')
    .select('round_id')
    .eq('profile_id', profileId)
    .maybeSingle()
  return (data as { round_id: string } | null)?.round_id ?? null
}

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

/**
 * spec.md AC-12 — **die Prüfung, die dem Bau gefehlt hat.**
 *
 * Die übrigen Tests dieser Datei fragen die Anwendung durch ihre eigene
 * Oberfläche: Sie belegen, dass der *Browser* kein Ergebnis schickt. Der Angriff
 * aus BUG-110 geht daran vorbei — er redet direkt mit der Datenschnittstelle,
 * mit dem öffentlichen Zugangsschlüssel und einer gewöhnlichen Sitzung. Ein Test,
 * der die App nur durch ihre Vordertür befragt, kann eine offene Seitentür nicht
 * sehen; deshalb setzt dieser hier ausdrücklich von außen an.
 */
test('Ein Ergebnis lässt sich nicht an der Runde vorbei einreichen (AC-12, BUG-110)', async ({
  page,
  request,
}) => {
  const { trainer, email } = await register(page, 'e2eForge')
  const profileId = await profileIdFor(trainer)

  // Zugangstoken holen, wie ein Angreifer es täte: öffentlicher Schlüssel,
  // eigenes Konto, kein Umweg über die Anwendung.
  const auth = await request.post(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    headers: { apikey: ANON_KEY },
    data: { email, password: PASSWORD },
  })
  expect(auth.status(), 'Anmeldung an der Datenschnittstelle').toBe(200)
  const jwt = (await auth.json()).access_token as string

  // Der Einreichversuch: eine perfekte Runde, in null Millisekunden.
  const forged = await request.post(SUPABASE_URL + '/rest/v1/runs', {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}` },
    data: {
      profile_id: profileId,
      streak: 386,
      duration_ms: 0,
      round_id: '11111111-2222-4333-8444-555555555555',
    },
  })

  expect(
    forged.status(),
    'Ein fertiges Ergebnis darf über keine Schnittstelle hereinkommen (AC-12)'
  ).toBe(403)

  // Und es darf auch nichts angekommen sein.
  const { data } = await admin.from('runs').select('streak').eq('profile_id', profileId)
  expect(data, 'Keine Zeile aus dem Einreichversuch').toHaveLength(0)

  // Gegenprobe: Lesen muss weiterhin gehen — die persönliche Bestleistung (AC-8)
  // und das Nachlesen eines verlorenen Ergebnisses (EC-3) hängen daran.
  const read = await request.get(SUPABASE_URL + '/rest/v1/runs?select=streak', {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}` },
  })
  expect(read.status(), 'Eigene Runden bleiben lesbar (AC-8, EC-3)').toBe(200)
})

/**
 * **Die zweite Schicht, nicht nur die erste (BUG-122, BUG-131).**
 *
 * Der Test oben belegt, dass ein Schreibversuch abgewiesen wird — aber nicht,
 * **wodurch**. Genau das war die Lücke: `0011` hatte auf `runs` nur
 * `insert, update, delete` entzogen und TRUNCATE, TRIGGER und REFERENCES stehen
 * lassen; `profiles` gewährte `anon` und `authenticated` sogar alle Rechte und
 * hielt allein durch Row Level Security. Beides war nicht ausnutzbar, und beides
 * wäre von einer einzigen versehentlich hinzugefügten Policy geöffnet worden.
 *
 * Unterscheidbar sind die zwei Schichten am **Wortlaut der Abweisung**: Fehlt
 * das Tabellenrecht, sagt Postgres `permission denied for table`; greift nur die
 * Policy, sagt es `violates row-level security policy`. Der Test pinnt deshalb
 * die Meldung, nicht den Statuscode — ein wiederhergestelltes `grant` bliebe
 * sonst unbemerkt, weil die Policy den Versuch weiterhin abfinge.
 *
 * `.claude/rules/security.md`: „Two independent checks, because sooner or later
 * one of them gets bypassed."
 */
test('Schreibrechte auf runs und profiles fehlen schon vor der Policy (BUG-122, BUG-131)', async ({
  page,
  request,
}) => {
  const { trainer, email } = await register(page, 'e2eGrants')
  const profileId = await profileIdFor(trainer)

  const auth = await request.post(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    headers: { apikey: ANON_KEY },
    data: { email, password: PASSWORD },
  })
  const jwt = (await auth.json()).access_token as string
  const asUser = { apikey: ANON_KEY, Authorization: `Bearer ${jwt}` }

  const schreibversuche = [
    {
      was: 'INSERT auf profiles',
      antwort: await request.post(SUPABASE_URL + '/rest/v1/profiles', {
        headers: asUser,
        data: { id: '00000000-0000-4000-8000-0000000000ff', trainer_name: 'Schmuggel' },
      }),
    },
    {
      was: 'UPDATE auf profiles',
      antwort: await request.patch(SUPABASE_URL + `/rest/v1/profiles?id=eq.${profileId}`, {
        headers: asUser,
        data: { trainer_name: 'Uebernommen' },
      }),
    },
    {
      was: 'DELETE auf profiles',
      antwort: await request.delete(SUPABASE_URL + `/rest/v1/profiles?id=eq.${profileId}`, {
        headers: asUser,
      }),
    },
    {
      was: 'UPDATE auf runs',
      antwort: await request.patch(SUPABASE_URL + `/rest/v1/runs?profile_id=eq.${profileId}`, {
        headers: asUser,
        data: { streak: 386 },
      }),
    },
  ]

  for (const { was, antwort } of schreibversuche) {
    expect(antwort.status(), `${was} muss abgewiesen werden`).toBe(403)
    expect(
      await antwort.text(),
      `${was} muss am Tabellenrecht scheitern, nicht erst an der Policy`
    ).toContain('permission denied for table')
  }

  // Der Trainername ist unverändert — nicht nur die Antwort war ein Nein.
  const { data: unversehrt } = await admin
    .from('profiles')
    .select('trainer_name')
    .eq('id', profileId)
    .single()
  expect(unversehrt?.trainer_name, 'Der Trainername steht unverändert (AC-2)').toBe(trainer)

  // Gegenprobe: Lesen bleibt erlaubt — die Kopfzeile zeigt den eigenen
  // Trainernamen über genau diesen Weg (AC-21).
  const gelesen = await request.get(
    SUPABASE_URL + `/rest/v1/profiles?id=eq.${profileId}&select=trainer_name`,
    { headers: asUser }
  )
  expect(gelesen.status(), 'Das eigene Profil bleibt lesbar (AC-21)').toBe(200)
  expect(await gelesen.text()).toContain(trainer)
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

/**
 * spec.md AC-18, AC-36, EC-15 — **der veraltete Tab, direkt hergestellt.**
 *
 * Der Zustand wird hier nicht über die Oberfläche erspielt, sondern gesetzt: zwei
 * Runden nacheinander, die zweite verdrängt die erste (AC-36). Danach wird das
 * Rundenende so ausgelöst, wie der veraltete Tab es täte — mit **seiner** alten
 * Runden-Kennung.
 *
 * Vor dem Fix beendete das die laufende Runde des anderen Tabs und lieferte
 * dessen Ergebnis zurück (BUG-120).
 */
test('Ein veralteter Tab beendet nicht die laufende Runde des anderen (AC-36, BUG-120)', async ({
  page,
  context,
}) => {
  const { trainer } = await register(page, 'e2eStale')
  const profileId = await profileIdFor(trainer)

  // Runde A — der Tab, der gleich veraltet
  await page.getByRole('button', { name: 'Runde starten' }).click()
  await waitForQuestion(page)
  const roundA = await activeRoundId(profileId)

  // Runde B verdrängt sie (AC-36)
  const second = await context.newPage()
  await second.goto('/')
  await second.getByRole('button', { name: 'Runde starten' }).click()
  await waitForQuestion(second)
  const roundB = await activeRoundId(profileId)
  expect(roundB, 'Die zweite Runde muss eine andere sein').not.toBe(roundA)

  // Der veraltete Tab beendet „seine" Runde.
  const stale = await admin.rpc('finish_round', { p_profile: profileId, p_round_id: roundA })
  expect(stale.error).toBeNull()
  expect(
    stale.data?.[0]?.written,
    'Eine Runde, die es nicht mehr gibt, lässt sich nicht beenden'
  ).toBe(false)

  // Und Runde B lebt unverändert weiter.
  expect(await activeRoundId(profileId), 'Runde B läuft weiter').toBe(roundB)
  const { data: written } = await admin.from('runs').select('round_id').eq('profile_id', profileId)
  expect(written, 'Es wurde nichts geschrieben').toHaveLength(0)

  // Gegenprobe: Mit der richtigen Kennung geht es sehr wohl.
  const proper = await admin.rpc('finish_round', { p_profile: profileId, p_round_id: roundB })
  expect(proper.data?.[0]?.written).toBe(true)

  await second.close()
})

/**
 * spec.md AC-36, EC-15, AC-10 — **dieselbe Frage eine Tür weiter (BUG-130).**
 *
 * Der Fix für BUG-120 hat die Runden-Kennung nur beim Rundenende nachgezogen.
 * Vorbereiten und Verwerfen banden sich weiterhin allein an das Profil, und die
 * zugehörigen Server Actions nahmen überhaupt kein Argument — ein veralteter Tab
 * konnte seine Runde also gar nicht nennen und veränderte damit die laufende
 * Runde des anderen: Ihre vorbereitete Frage wurde ausgetauscht, ihr Token
 * gewechselt und ihr Ziehungsvorrat verkürzt. Der spielende Tab hatte das Bild
 * des alten Tokens vorgeladen — das war damit wertlos (AC-10).
 *
 * Geprüft wird auf der Ebene, auf der die Autorität sitzt: den Datenbank-
 * Funktionen. Die Server Action darüber reicht die Kennung nur durch.
 */
test('Ein veralteter Tab verändert die vorbereitete Frage der laufenden Runde nicht (AC-36, BUG-130)', async ({
  page,
  context,
}) => {
  const { trainer } = await register(page, 'e2eStalePrep')
  const profileId = await profileIdFor(trainer)

  await page.getByRole('button', { name: 'Runde starten' }).click()
  await waitForQuestion(page)
  const roundA = await activeRoundId(profileId)

  const second = await context.newPage()
  await second.goto('/')
  await second.getByRole('button', { name: 'Runde starten' }).click()
  await waitForQuestion(second)
  const roundB = await activeRoundId(profileId)
  expect(roundB, 'Die zweite Runde muss eine andere sein').not.toBe(roundA)

  const before = await admin
    .from('active_runs')
    .select('prepared_answer_id, prepared_token, seen_ids')
    .eq('profile_id', profileId)
    .single()

  // Der veraltete Tab will „seine" vorbereitete Frage ersetzen.
  const discarded = await admin.rpc('discard_prepared_question', {
    p_profile: profileId,
    p_round_id: roundA,
  })
  expect(discarded.error).toBeNull()

  const replaced = await admin.rpc('set_prepared_question', {
    p_profile: profileId,
    p_round_id: roundA,
    p_answer_id: 300,
    p_correct_index: 1,
    p_also_seen: [301, 302],
  })
  expect(replaced.error).toBeNull()
  expect(replaced.data, 'Eine fremde Runde gibt kein Token zurück').toBeNull()

  // Runde B ist Feld für Feld unverändert — das ist der eigentliche Nachweis.
  const after = await admin
    .from('active_runs')
    .select('prepared_answer_id, prepared_token, seen_ids')
    .eq('profile_id', profileId)
    .single()
  expect(after.data, 'Die laufende Runde bleibt unberührt').toEqual(before.data)

  // Gegenprobe: Mit der eigenen Kennung wirkt derselbe Aufruf sehr wohl —
  // sonst wäre das Abweisen oben kein Beleg, sondern eine kaputte Funktion.
  const proper = await admin.rpc('set_prepared_question', {
    p_profile: profileId,
    p_round_id: roundB,
    p_answer_id: 300,
    p_correct_index: 1,
    p_also_seen: [301, 302],
  })
  expect(proper.data, 'Die eigene Runde lässt sich weiterhin vorbereiten').not.toBeNull()

  await second.close()
})

/**
 * spec.md EC-9, AC-36 — **gleichzeitige Rundenstarts (BUG-123).**
 *
 * `start_round` löschte und fügte in getrennten Anweisungen ein. Zwei
 * gleichzeitige Starts sahen die Löschung der jeweils anderen nicht, beide
 * fügten ein, und der zweite lief in `duplicate key value violates unique
 * constraint "active_runs_pkey"` — für den Spieler eine Sackgasse, aus der nur
 * Neuladen half. Aus einem Tab verhinderte ein Riegel im Client das; aus zwei
 * Tabs oder zwei Geräten nicht, und genau die nennt EC-9.
 */
test('Fünf gleichzeitige Rundenstarts ergeben eine Runde und keinen Fehler (EC-9, BUG-123)', async ({
  page,
}) => {
  const { trainer } = await register(page, 'e2eRace')
  const profileId = await profileIdFor(trainer)

  const starts = await Promise.all(
    [10, 20, 30, 40, 50].map((id) =>
      admin.rpc('start_round', {
        p_profile: profileId,
        p_answer_id: id,
        p_correct_index: 0,
        p_prepared_answer_id: id + 1,
        p_prepared_correct_index: 1,
        p_also_seen: [],
      })
    )
  )

  for (const [i, start] of starts.entries()) {
    expect(start.error, `Aufruf ${i + 1} darf nicht scheitern`).toBeNull()
  }

  const { data: rows } = await admin
    .from('active_runs')
    .select('round_id, streak, accumulated_ms')
    .eq('profile_id', profileId)
  expect(rows, 'Genau eine laufende Runde (AC-36)').toHaveLength(1)
  // Der Aktualisierungszweig muss eine frische Runde ergeben, keine halb
  // übernommene: Eine stehengebliebene Serie wäre der Fehler, den man hier macht.
  expect(rows?.[0]?.streak, 'Serie beginnt bei 0').toBe(0)
  expect(rows?.[0]?.accumulated_ms, 'Zeit beginnt bei 0').toBe(0)

  const { data: written } = await admin.from('runs').select('round_id').eq('profile_id', profileId)
  expect(written, 'Eine verdrängte Runde wird nicht gespeichert').toHaveLength(0)
})

/**
 * spec.md AC-35, EC-2 — **der erschöpfte Ziehungsvorrat, direkt hergestellt.**
 *
 * Durch die Oberfläche wäre dieser Zustand erst nach rund 380 Fragen erreichbar.
 * Hier wird er gesetzt: Die Ausschlussliste der laufenden Runde bekommt alle 386
 * Nummern, die vorbereitete Frage wird entfernt. Der Spieler beantwortet dann
 * seine letzte offene Frage — und danach gibt es nichts mehr zu ziehen.
 *
 * Erwartet wird, dass **der Server** die Runde wertet und schreibt (AC-35). Vor
 * dem Fix hing das an einem zusätzlichen Aufruf des Browsers; blieb der aus, war
 * das Ergebnis verloren (BUG-119).
 */
test('Erschöpfter Vorrat: der Server wertet die Runde (AC-35, EC-2)', async ({ page }) => {
  const { trainer } = await register(page, 'e2eDrained')
  const profileId = await profileIdFor(trainer)

  await page.getByRole('button', { name: 'Runde starten' }).click()
  await waitForQuestion(page)

  // Der Vorrat ist auf: alle 386 Nummern gezogen, nichts vorbereitet.
  const drain = await admin
    .from('active_runs')
    .update({
      seen_ids: Array.from({ length: 386 }, (_, i) => i + 1),
      prepared_answer_id: null,
      prepared_correct_index: null,
      prepared_token: null,
    })
    .eq('profile_id', profileId)
  expect(drain.error).toBeNull()

  // Die letzte offene Frage wird richtig beantwortet.
  await answerCorrectly(page)

  // Der Server beendet die Runde und schreibt sie — der Browser zeigt sie nur.
  await expect(page.getByText('Runde beendet')).toBeVisible({ timeout: 15_000 })

  const { data: written } = await admin
    .from('runs')
    .select('streak')
    .eq('profile_id', profileId)
  expect(written, 'Genau eine gewertete Runde').toHaveLength(1)
  expect(written?.[0].streak, 'Die eine richtige Antwort zählt').toBe(1)

  const { data: open } = await admin
    .from('active_runs')
    .select('profile_id')
    .eq('profile_id', profileId)
  expect(open, 'Kein Rundenzustand bleibt zurück (AC-39)').toHaveLength(0)
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
