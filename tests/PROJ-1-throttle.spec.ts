import { THROTTLED_MESSAGE, WRONG_CREDENTIALS_MESSAGE } from '../src/lib/auth/error-mapping'
import { expect, test } from './fixtures'

/**
 * Die Drosselung der Anmeldung — der Wächter über BUG-29.
 *
 * `.claude/rules/security.md` verlangt eine Drosselung auf jedem Pfad, der
 * Zugangsdaten prüft: „Ein unbegrenzter Login ist ein funktionierender Login, den
 * jeder erraten kann." Gebaut ist sie in `src/lib/auth/throttle.ts`, geprüft
 * bisher nur von Unit-Tests gegen die Zählfunktion.
 *
 * Was hier dazukommt und dort nicht zu haben ist: dass der Zähler **auf dem Weg
 * durch die echte Server Action** überhaupt erreicht wird. Genau das war der
 * Kern von BUG-30 und BUG-31 — eine Schranke, die an der falschen Stelle saß und
 * sich umgehen ließ, während ihre Tests grün blieben.
 *
 * Der Test steht bewusst allein und nicht in einer Journey: Er ist der einzige,
 * der seine eigene Adresse absichtlich vollmacht. Alle anderen Tests bekommen
 * über `fixtures.ts` je eine eigene, damit sie sich nicht gegenseitig aussperren.
 */

/** Falsch, aber formal gültig — die Eingabevalidierung soll nicht vorher greifen. */
const WRONG_PASSWORD = 'FalschesPasswort123!'

/** `LIMITS.credentialsPerIp` aus `src/lib/auth/throttle.ts`: 5 Anfragen je Minute. */
const CREDENTIALS_PER_IP = 5

test('Der sechste Fehlversuch derselben Verbindung wird abgewiesen (BUG-29)', async ({ page }) => {
  // Eine Adresse, die es nicht gibt: Der Zähler soll zählen, ohne dass am Ende
  // ein echtes Konto in einem gedrosselten Zustand zurückbleibt.
  const email = `e2ethrottle_${Date.now().toString(36)}@example.com`

  await page.goto('/login')

  const emailField = page.getByLabel('E-Mail')
  const passwordField = page.getByLabel('Passwort', { exact: true })

  /**
   * Beide Felder sind kontrollierte React-Felder. Wird vor der Hydration
   * gefüllt, setzt der erste Render sie wieder leer — das Formular ginge leer
   * raus und antwortete mit einem Validierungsfehler, der wie ein Anwendungs-
   * fehler aussieht (dieselbe Falle wie `fillStable` in der Reset-Journey).
   */
  const submit = async () => {
    await expect(async () => {
      await emailField.fill(email)
      await passwordField.fill(WRONG_PASSWORD)
      await expect(emailField).toHaveValue(email)
      await expect(passwordField).toHaveValue(WRONG_PASSWORD)
    }).toPass({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Einloggen', exact: true }).click()
  }

  for (let attempt = 1; attempt <= CREDENTIALS_PER_IP; attempt++) {
    await submit()

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

  await submit()
  await expect(page.getByText(THROTTLED_MESSAGE)).toBeVisible()

  // Und die Absage tritt **an die Stelle** der Zugangsdaten-Prüfung, statt neben
  // ihr zu stehen: Ab hier wird das Passwort gar nicht mehr angefasst.
  await expect(page.getByText(WRONG_CREDENTIALS_MESSAGE)).toHaveCount(0)
})
