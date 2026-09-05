import { THROTTLED_MESSAGE, WRONG_CREDENTIALS_MESSAGE } from '../src/lib/auth/error-mapping'
import { expect, test } from './fixtures'
import { PASSWORD, register } from './helpers'

/**
 * Die Drosselung der Anmeldung — der Wächter über BUG-29 und BUG-39.
 *
 * `.claude/rules/security.md` verlangt eine Drosselung auf jedem Pfad, der
 * Zugangsdaten prüft: „Ein unbegrenzter Login ist ein funktionierender Login, den
 * jeder erraten kann." Gebaut ist sie in `src/lib/auth/throttle.ts`.
 *
 * Was hier geprüft wird und in den Unit-Tests nicht zu haben ist: dass der Zähler
 * **auf dem Weg durch die echte Server Action und die echte Datenbank** erreicht
 * wird. Genau das war der Kern von BUG-30 und BUG-31 — eine Schranke, die an der
 * falschen Stelle saß und sich umgehen ließ, während ihre Tests grün blieben.
 *
 * Beide Tests treten bewusst als **eine einzige** Verbindung auf. Alle übrigen
 * Tests der Suite bekommen über `fixtures.ts` je eine eigene Adresse, damit sie
 * sich nicht gegenseitig aussperren; hier ist die geteilte Adresse der Gegenstand
 * der Prüfung.
 */

/** Falsch, aber formal gültig — die Eingabevalidierung soll nicht vorher greifen. */
const WRONG_PASSWORD = 'FalschesPasswort123!'

/** `LIMITS.credentialsPerIp` aus `src/lib/auth/throttle.ts`: 5 Anfragen je Minute. */
const CREDENTIALS_PER_IP = 5

/**
 * Füllt das Anmeldeformular und schickt es ab.
 *
 * Beide Felder sind kontrollierte React-Felder. Wird vor der Hydration gefüllt,
 * setzt der erste Render sie wieder leer — das Formular ginge leer raus und
 * antwortete mit einem Validierungsfehler, der wie ein Anwendungsfehler aussieht
 * (dieselbe Falle wie `fillStable` in der Reset-Journey).
 */
async function submitLogin(
  page: import('@playwright/test').Page,
  email: string,
  password: string
) {
  const emailField = page.getByLabel('E-Mail')
  const passwordField = page.getByLabel('Passwort', { exact: true })

  await expect(async () => {
    await emailField.fill(email)
    await passwordField.fill(password)
    await expect(emailField).toHaveValue(email)
    await expect(passwordField).toHaveValue(password)
  }).toPass({ timeout: 15_000 })

  await page.getByRole('button', { name: 'Einloggen', exact: true }).click()
}

test('Der sechste Fehlversuch derselben Verbindung wird abgewiesen (BUG-29)', async ({ page }) => {
  // Eine Adresse, die es nicht gibt: Der Zähler soll zählen, ohne dass am Ende
  // ein echtes Konto in einem gedrosselten Zustand zurückbleibt.
  const email = `e2ethrottle_${Date.now().toString(36)}@example.com`

  await page.goto('/login')

  for (let attempt = 1; attempt <= CREDENTIALS_PER_IP; attempt++) {
    await submitLogin(page, email, WRONG_PASSWORD)

    // Die erlaubten Versuche kommen bis zur Passwortprüfung durch. Geprüft wird
    // die **Abwesenheit** der Drosselmeldung: Die Meldung über falsche
    // Zugangsdaten steht ab dem ersten Versuch da und wäre danach ein Treffer,
    // der nichts mehr aussagt.
    await expect(
      page.getByText(THROTTLED_MESSAGE),
      `Versuch ${attempt} von ${CREDENTIALS_PER_IP} wurde bereits gedrosselt`
    ).toHaveCount(0)
    await expect(page.getByText(WRONG_CREDENTIALS_MESSAGE)).toBeVisible()
  }

  await submitLogin(page, email, WRONG_PASSWORD)
  await expect(page.getByText(THROTTLED_MESSAGE)).toBeVisible()

  // Und die Absage tritt **an die Stelle** der Zugangsdaten-Prüfung, statt neben
  // ihr zu stehen: Ab hier wird das Passwort gar nicht mehr angefasst.
  await expect(page.getByText(WRONG_CREDENTIALS_MESSAGE)).toHaveCount(0)
})

/**
 * Der Abnahmetest zu **BUG-39** — und er prüft absichtlich das ganze Szenario,
 * nicht die Zeile, die geändert wurde.
 *
 * Ein Test wie „nach einem erfolgreichen Login ist der Konto-Zähler leer" wäre
 * **auch gegen den kaputten Code grün gewesen**: Dort wurde der Konto-Zähler ja
 * ebenfalls geleert. Der Fehler saß daneben — der IP-Zähler wurde mitgelöscht,
 * und damit konnte ein Angreifer mit **einem einzigen eigenen Konto** seine
 * eigene Bremse beliebig oft lösen. Gemessen: 24 Passwortversuche gegen 24
 * verschiedene Konten von einer IP in 3,6 Sekunden, null abgewiesen.
 *
 * Rot werden muss deshalb die **Schleife**: raten, sich selbst anmelden, weiter
 * raten. Genau das steht hier.
 *
 * Warum gegen Passwort-Spraying nur dieser Zähler hilft: Ein gängiges Passwort
 * gegen viele Konten gibt jedem Opferkonto genau **einen** Versuch — der
 * Konto-Zähler (20 pro 15 Minuten) sieht davon nichts. Der IP-Zähler ist dort
 * die einzige Bremse.
 */
test('Ein eigener erfolgreicher Login setzt den IP-Zähler NICHT zurück (BUG-39)', async ({
  page,
}) => {
  // Das eigene Konto des Angreifers. Die Registrierung zählt auf einen eigenen
  // Schlüssel (`register:ip:…`) und rührt den Login-Zähler nicht an.
  const { email: ownAccount } = await register(page, 'e2eSpray')

  await page.getByRole('button', { name: 'Abmelden' }).click()
  await page.waitForURL('/login')

  // Vier Rateversuche gegen **fremde** Konten. Der Login-Zähler dieser Adresse
  // steht danach auf 4 von 5.
  for (let attempt = 1; attempt <= CREDENTIALS_PER_IP - 1; attempt++) {
    await submitLogin(page, `opfer${attempt}_${Date.now().toString(36)}@example.com`, WRONG_PASSWORD)
    await expect(
      page.getByText(THROTTLED_MESSAGE),
      `Versuch ${attempt} wurde zu früh gedrosselt`
    ).toHaveCount(0)
    await expect(page.getByText(WRONG_CREDENTIALS_MESSAGE)).toBeVisible()
  }

  // Der Zug, der vorher alles zurücksetzte: ein **erfolgreicher** Login mit dem
  // eigenen Konto. Er ist selbst der fünfte Versuch auf dem IP-Zähler — der
  // Zähler läuft vor der Passwortprüfung, also zählt auch der geglückte Login.
  await submitLogin(page, ownAccount, PASSWORD)
  await page.waitForURL('/')
  await expect(page.getByRole('button', { name: 'Runde starten' })).toBeVisible()

  await page.getByRole('button', { name: 'Abmelden' }).click()
  await page.waitForURL('/login')

  // Und jetzt die eigentliche Zusage: Der nächste Rateversuch derselben
  // Verbindung gegen ein **weiteres** fremdes Konto muss abgewiesen werden.
  // Vor dem Fix lief er durch — der IP-Zähler stand nach dem eigenen Login
  // wieder auf 0, und die Schleife war beliebig oft wiederholbar.
  await submitLogin(page, `opfer5_${Date.now().toString(36)}@example.com`, WRONG_PASSWORD)

  await expect(page.getByText(THROTTLED_MESSAGE)).toBeVisible()
  await expect(page.getByText(WRONG_CREDENTIALS_MESSAGE)).toHaveCount(0)

  // Gegenprobe, damit der Test nicht bloß „irgendetwas ist gesperrt" behauptet:
  // Auch das **richtige** Passwort des eigenen Kontos kommt jetzt nicht mehr
  // durch. Der IP-Zähler ist voll, und er gilt für jeden auf dieser Verbindung —
  // das ist der benannte Preis dieser Entscheidung, nicht ein Nebeneffekt.
  await submitLogin(page, ownAccount, PASSWORD)
  await expect(page.getByText(THROTTLED_MESSAGE)).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})
