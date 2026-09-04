import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { register, PASSWORD } from './helpers'

/**
 * spec.md AC-11, AC-12, EC-7 — der Passwort-Reset über den echten Mail-Link.
 *
 * Warum dieser Test existiert und warum er den Link **aus der Mail** nimmt:
 *
 * Zwei aufeinanderfolgende Fehler haben genau hier gesteckt, und beide haben
 * jede Prüfung überlebt, die eine selbstgebaute URL benutzt hat.
 *
 * - BUG-6: Der Link war an das anfordernde Gerät gebunden (PKCE-`code_verifier`
 *   im Cookie). Wer die Mail auf einem anderen Gerät öffnete, kam nicht weiter.
 * - BUG-16: Nach dem Fix stimmte der Host nicht mehr — die Mail zeigte auf
 *   `127.0.0.1`, die Weiterleitung ging auf `localhost`, das Cookie blieb auf
 *   dem einen Host und die Zielseite lag auf dem anderen.
 *
 * Beide sind unsichtbar, sobald der Test die URL selbst zusammensetzt statt sie
 * aus der Mail zu holen: Dann prüft er die eigene Konstruktion und nicht das,
 * was der Nutzer tatsächlich bekommt. Deshalb öffnet dieser Test **exakt den
 * Link, der in der Mail steht**.
 *
 * Und er öffnet ihn in einem **frischen Browser-Kontext ohne jedes Cookie** —
 * das ist die Zusage aus EC-7: „Anfrage am Rechner, Mail am Handy".
 *
 * Was dieser Test *nicht* abdeckt: einen Wechsel des Hosts zwischen Mail-Link
 * und Anwendung. Lokal wie in Produktion sind Site-URL und App-Domain dieselbe
 * Adresse (siehe `supabase/config.toml` → `site_url`), es gibt hier also keinen
 * Host-Wechsel nachzustellen. Dass die Weiterleitung trotzdem host-unabhängig
 * bleibt, sichern die Unit-Tests in `src/app/auth/confirm/route.test.ts` ab —
 * an der Stelle, an der die Entscheidung wirklich fällt.
 */

const MAILPIT = 'http://127.0.0.1:54324'

/**
 * Füllt das Passwortfeld und stellt sicher, dass der Wert auch stehen bleibt.
 *
 * Das Feld ist ein kontrolliertes React-Feld. Wird es befüllt, bevor die Seite
 * hydratisiert ist, überschreibt React den DOM-Wert beim ersten Render wieder
 * mit seinem leeren Anfangszustand — das Formular wird dann leer abgeschickt und
 * antwortet mit „Mindestens 8 Zeichen", was wie ein Fehler der Anwendung
 * aussieht und keiner ist. In Chromium fällt das nicht auf, in WebKit
 * reproduzierbar schon: Dort dauert die Hydration länger.
 *
 * `toPass` wiederholt Eingabe **und** Prüfung, bis der Wert hält.
 */
async function fillStable(page: Page, label: string, value: string, exact = false) {
  const field = page.getByLabel(label, { exact })

  await expect(async () => {
    await field.fill(value)
    await expect(field).toHaveValue(value)
  }).toPass({ timeout: 15_000 })
}

const fillPassword = (page: Page, value: string) => fillStable(page, 'Neues Passwort', value)

/** Holt den Reset-Link aus der zuletzt an diese Adresse zugestellten Mail. */
async function resetLinkFor(request: APIRequestContext, email: string) {
  // Mailpit stellt asynchron zu; kurz abwarten statt blind zu greifen.
  //
  // Das Fenster ist bewusst großzügig (30 s). Bei voller Parallelität — 16
  // Worker über drei Browser-Projekte gegen einen Dev-Server — dauert die
  // Zustellung spürbar länger als im Einzellauf, und mit 10 s fiel dieser Test
  // etwa in jedem zweiten Volllauf aus, während er allein zuverlässig grün war.
  // Ein Test, der von der Auslastung des Rechners abhängt, meldet Rauschen
  // statt Befunden.
  for (let attempt = 0; attempt < 60; attempt++) {
    const list = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(email)}`)
    const body = (await list.json()) as { messages: { ID: string }[] }

    if (body.messages?.length) {
      const message = await request.get(`${MAILPIT}/api/v1/message/${body.messages[0].ID}`)
      const text = JSON.stringify(await message.json())
      const link = text.match(/https?:\/\/[^"\\\s<>]*\/auth\/confirm[^"\\\s<>]*/)?.[0]

      if (link) {
        // Im JSON stehen die Query-Trenner als &.
        return link.replace(/\\u0026/g, '&')
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Keine Reset-Mail für ${email} in Mailpit gefunden`)
}

test('Passwort-Reset über den echten Mail-Link, geöffnet auf einem anderen Gerät (EC-7)', async ({
  page,
  request,
  browser,
}) => {
  const { email } = await register(page, 'e2eRst')

  await page.getByRole('button', { name: 'Abmelden' }).click()
  await page.waitForURL('/login')

  await page.getByRole('button', { name: 'Passwort vergessen?' }).click()
  await page.getByLabel('E-Mail').fill(email)
  await page.getByRole('button', { name: 'Link senden' }).click()
  await expect(page.getByText(/Falls diese Adresse registriert ist/)).toBeVisible()

  const link = await resetLinkFor(request, email)

  // Der Link muss auf /auth/confirm zeigen, nicht auf den PKCE-Standardpfad —
  // sonst ist die Vorlage aus T15 nicht aktiv und BUG-6 wäre zurück.
  expect(link).toContain('/auth/confirm')
  expect(link).toContain('token_hash=')

  // Das „andere Gerät": eigener Kontext, kein Cookie aus der Anfrage-Sitzung.
  const otherDevice = await browser.newContext()
  const phone = await otherDevice.newPage()

  await phone.goto(link)

  // Kein Fehlerzustand — der Link ist frisch und gültig.
  await expect(phone.getByText('Dieser Link ist ungültig oder abgelaufen.')).toHaveCount(0)
  await expect(phone.getByLabel('Neues Passwort')).toBeVisible()

  const newPassword = `${PASSWORD}-neu`
  await fillPassword(phone, newPassword)
  await phone.getByRole('button', { name: 'Passwort setzen' }).click()
  await phone.waitForURL((url) => url.pathname === '/')

  await otherDevice.close()

  // Das neue Passwort gilt, das alte nicht mehr — sonst wäre der Reset nur
  // scheinbar durchgelaufen.
  const check = await browser.newContext()
  const fresh = await check.newPage()

  await fresh.goto('/login')
  await fillStable(fresh, 'E-Mail', email)
  await fillStable(fresh, 'Passwort', PASSWORD, true)
  await fresh.getByRole('button', { name: 'Einloggen' }).click()
  await expect(fresh.getByText('E-Mail-Adresse oder Passwort ist falsch.')).toBeVisible()

  await fillStable(fresh, 'Passwort', newPassword, true)
  await fresh.getByRole('button', { name: 'Einloggen' }).click()
  await fresh.waitForURL('/')
  await expect(fresh.getByRole('button', { name: 'Runde starten' })).toBeVisible()

  await check.close()
})

test('Ein bereits benutzter Reset-Link führt in den Fehlerzustand (AC-12)', async ({
  page,
  request,
  browser,
}) => {
  const { email } = await register(page, 'e2eRs2')

  await page.getByRole('button', { name: 'Abmelden' }).click()
  await page.waitForURL('/login')

  await page.getByRole('button', { name: 'Passwort vergessen?' }).click()
  await page.getByLabel('E-Mail').fill(email)
  await page.getByRole('button', { name: 'Link senden' }).click()
  await expect(page.getByText(/Falls diese Adresse registriert ist/)).toBeVisible()

  const link = await resetLinkFor(request, email)

  const first = await browser.newContext()
  const firstPage = await first.newPage()
  await firstPage.goto(link)
  await fillPassword(firstPage, `${PASSWORD}-x`)
  await firstPage.getByRole('button', { name: 'Passwort setzen' }).click()
  await firstPage.waitForURL((url) => url.pathname === '/')
  await first.close()

  // Derselbe Link ein zweites Mal, wieder ohne Vorbelastung.
  const second = await browser.newContext()
  const secondPage = await second.newPage()
  await secondPage.goto(link)

  await expect(secondPage.getByText('Dieser Link ist ungültig oder abgelaufen.')).toBeVisible()
  await expect(secondPage.getByRole('link', { name: 'Neuen Link anfordern' })).toBeVisible()
  await expect(secondPage.getByLabel('Neues Passwort')).toHaveCount(0)

  await second.close()
})

test('Der Reset-Link zeigt auf /auth/confirm, nicht auf den PKCE-Standardpfad', async ({
  page,
  request,
}) => {
  // Wächter über die E-Mail-Vorlage (T15). Verschickt Supabase wieder seinen
  // Standard-Link mit `?code=`, ist die Geräte-Bindung aus BUG-6 zurück — und
  // zwar ohne dass irgendein anderer Test rot würde, weil der Ablauf im
  // anfordernden Browser weiterhin funktioniert. Genau diese Lücke macht den
  // Fehler so langlebig.
  const { email } = await register(page, 'e2eRs3')

  await page.getByRole('button', { name: 'Abmelden' }).click()
  await page.waitForURL('/login')

  await page.getByRole('button', { name: 'Passwort vergessen?' }).click()
  await page.getByLabel('E-Mail').fill(email)
  await page.getByRole('button', { name: 'Link senden' }).click()

  const link = await resetLinkFor(request, email)

  expect(link).toContain('/auth/confirm')
  expect(link).toContain('token_hash=')
  expect(link).not.toContain('?code=')
})
