import { test, expect } from './fixtures'
import { register } from './helpers'

/**
 * Der Wächter für BUG-87 (spec.md AC-10, EC-3).
 *
 * **Warum dieser Test an der HTTP-Antwort ansetzt und nicht an einer Funktion.**
 * Es gab schon einmal zwei grüne Unit-Tests für „die Antwort ist immer dieselbe" —
 * und die Kontoexistenz war trotzdem ablesbar. Sie prüften den Rückgabewert der
 * Zuordnungsfunktion; verraten hat es die `Set-Cookie`-Kopfzeile, die
 * `@supabase/ssr` im Fehlerfall in dieselbe Antwort schrieb. Gemessen wurden
 * damals 30 von 30 Adressen korrekt, 4,13 pro Sekunde. Eine Funktion ist nicht
 * die Antwort — deshalb vergleicht dieser Test **Status und alle Cookie-Kopfzeilen
 * der ausgehenden Antwort**, für eine existierende gegen eine erfundene Adresse.
 *
 * **Warum die Anfrage abgefangen und wiederholt wird, statt zweimal zu klicken.**
 * Der Unterschied entsteht nur, wenn die zweite Anfrage innerhalb von Supabases
 * `max_frequency` liegt (lokal 1 s, gehostet 60 s). Zwei Formular-Absendungen über
 * die Oberfläche brauchen dafür zu lange — der Test wäre dann auch gegen den
 * kaputten Stand grün, also gar kein Test. Abgefangen wird eine echte Anfrage
 * samt Action-Kennung; wiederholt wird sie in Millisekunden.
 */

/** Cookie-Name ohne den Zufallsanteil, plus ob der Wert leer ist (= Löschung). */
function cookieSignature(headers: { name: string; value: string }[]) {
  return headers
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => {
      const [name, value = ''] = h.value.split('=')
      return `${name.replace(/-flow-[^-]+-/, '-flow-<id>-')}:${value.split(';')[0] ? 'gesetzt' : 'geloescht'}`
    })
    .sort()
}

test('Die Reset-Antwort ist für ein bestehendes und ein erfundenes Konto identisch (AC-10, EC-3)', async ({
  page,
  browser,
  clientIp,
}) => {
  // Ein echtes Konto anlegen — seine Adresse ist der „existiert"-Fall.
  const { email: echteAdresse } = await register(page, 'b87')

  // Abmelden: /login leitet Angemeldete auf / um (EC-2, umgekehrte Richtung).
  await page.getByRole('button', { name: 'Abmelden' }).click()
  await page.waitForURL('/login')

  // Eine echte Reset-Anfrage abfangen, um Action-Kennung und Rumpfform zu lernen.
  await page.getByRole('button', { name: 'Passwort vergessen?' }).click()
  const platzhalter = `b87-vorlage-${Date.now()}@example.com`
  await page.getByLabel('E-Mail').fill(platzhalter)

  const vorlage = page.waitForRequest(
    (r) => r.method() === 'POST' && r.headers()['next-action'] !== undefined
  )
  await page.getByRole('button', { name: 'Link senden' }).click()
  const abgefangen = await vorlage

  const url = abgefangen.url()
  const rumpf = abgefangen.postData()

  // Die abgefangenen Kopfzeilen tragen das `x-forwarded-for` des Ursprungskontexts
  // mit. Übernähme man sie unverändert, landeten alle Sonden auf **einem**
  // Zählerschlüssel und die Drosselung selbst würde zum Unterschied — der Test
  // hätte dann gemessen, wie schnell er sein eigenes Limit erreicht.
  const kopfzeilen = Object.fromEntries(
    Object.entries(abgefangen.headers()).filter(
      ([k]) => !['x-forwarded-for', 'cookie', 'content-length'].includes(k.toLowerCase())
    )
  )
  expect(rumpf, 'Die abgefangene Anfrage muss die Adresse im Klartext tragen').toContain(
    platzhalter
  )

  /** Schickt dieselbe Anfrage zweimal kurz hintereinander, von einer Verbindung. */
  async function zweiAnfragen(adresse: string, ip: string) {
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': ip } })
    const antworten = []
    for (let i = 0; i < 2; i++) {
      const antwort = await ctx.request.post(url, {
        headers: { ...kopfzeilen, 'x-forwarded-for': ip },
        data: Buffer.from(rumpf!.replace(platzhalter, adresse), 'utf8'),
      })
      antworten.push({
        status: antwort.status(),
        cookies: cookieSignature(antwort.headersArray()),
        rumpf: await antwort.text(),
      })
    }
    await ctx.close()
    return antworten
  }

  // Getrennte Verbindungen, damit die App-eigene Grenze (3 je Verbindung und
  // 5 Minuten, AC-17) nicht selbst zum Unterschied wird.
  const echt = await zweiAnfragen(echteAdresse, `${clientIp}:e`)
  const erfunden = await zweiAnfragen(`b87-geist-${Date.now()}@example.invalid`, `${clientIp}:f`)

  for (const [i, name] of ['erste', 'zweite'].entries()) {
    expect(echt[i].status, `${name} Anfrage: Status muss gleich sein`).toBe(erfunden[i].status)
    expect(echt[i].rumpf, `${name} Anfrage: Antwortrumpf muss gleich sein`).toBe(
      erfunden[i].rumpf
    )
    expect(
      echt[i].cookies,
      `${name} Anfrage: Cookie-Kopfzeilen müssen gleich sein — hier hing BUG-87`
    ).toEqual(erfunden[i].cookies)
  }

  // Und die Stelle, an der es hing, ausdrücklich: kein PKCE-Cookie in der Antwort.
  expect(
    echt.flatMap((a) => a.cookies).filter((c) => c.includes('code-verifier')),
    'Auf diesem Pfad darf gar kein code-verifier-Cookie geschrieben werden'
  ).toEqual([])
})

test('Der Reset funktioniert weiterhin — die Mail wird verschickt (AC-10)', async ({ page }) => {
  // Gegenprobe zum Test oben: Eine Antwort, die für alle Fälle gleich aussieht,
  // wäre auch dann „identisch", wenn gar nichts mehr passierte. Hier läuft der
  // Weg deshalb einmal ganz durch.
  const { email } = await register(page, 'b87ok')

  await page.getByRole('button', { name: 'Abmelden' }).click()
  await page.waitForURL('/login')

  await page.getByRole('button', { name: 'Passwort vergessen?' }).click()
  await page.getByLabel('E-Mail').fill(email)
  await page.getByRole('button', { name: 'Link senden' }).click()

  await expect(page.getByText(/Falls diese Adresse registriert ist/i)).toBeVisible()

  const postfach = await page.request.get('http://127.0.0.1:54324/api/v1/messages?limit=50')
  const nachrichten = (await postfach.json()).messages ?? []
  const meine = nachrichten.find((m: { To?: { Address: string }[] }) =>
    (m.To ?? []).some((t) => t.Address === email)
  )

  expect(meine, `Für ${email} muss eine Reset-Mail im Postfach liegen`).toBeTruthy()
})
