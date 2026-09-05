import type { Page } from '@playwright/test'
import { THROTTLED_MESSAGE, WRONG_CREDENTIALS_MESSAGE } from '../src/lib/auth/error-mapping'
import { expect, test } from './fixtures'
import { PASSWORD, register } from './helpers'

/**
 * Die Drosselung der Anmeldung — der Wächter über BUG-29, BUG-39 und BUG-54.
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
 * **Die drei Tests hier gehören zusammen und dürfen nicht einzeln gelesen
 * werden.** Der IP-Zähler ist zweimal in Folge in die jeweils andere Richtung
 * gekippt: Erst löschte ein erfolgreicher Login ihn ganz (BUG-39, Angreifer
 * schaltet sich selbst frei), dann ließ der Fix ihn stehen (BUG-54, geteilte
 * Anschlüsse sperren legitime Spieler aus). Jeder einzelne Test wäre auch für
 * eine dieser beiden falschen Fassungen grün gewesen — erst zusammen spannen sie
 * die Zusage auf: **Gezählt werden Fehlversuche, sonst nichts.**
 *
 * Alle drei treten bewusst als **eine einzige** Verbindung auf. Die übrigen Tests
 * der Suite bekommen über `fixtures.ts` je eine eigene Adresse, damit sie sich
 * nicht gegenseitig aussperren; hier ist die geteilte Adresse der Gegenstand.
 */

/** Falsch, aber formal gültig — die Eingabevalidierung soll nicht vorher greifen. */
const WRONG_PASSWORD = 'FalschesPasswort123!'

/** `LIMITS.credentialsPerIp` aus `src/lib/auth/throttle.ts`: 5 Anfragen je Minute. */
const CREDENTIALS_PER_IP = 5

/** Eine Adresse, die es nicht gibt — ein „Opferkonto" beim Durchprobieren. */
const stranger = (n: number) => `opfer${n}_${Date.now().toString(36)}@example.com`

/**
 * Füllt das Anmeldeformular und schickt es ab.
 *
 * Beide Felder sind kontrollierte React-Felder. Wird vor der Hydration gefüllt,
 * setzt der erste Render sie wieder leer — das Formular ginge leer raus und
 * antwortete mit einem Validierungsfehler, der wie ein Anwendungsfehler aussieht
 * (dieselbe Falle wie `fillStable` in der Reset-Journey).
 */
async function submitLogin(page: Page, email: string, password: string) {
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

/** Ein Fehlversuch, der noch durchkommen muss — bis zur Passwortprüfung. */
async function expectAllowedFailure(page: Page, email: string, note: string) {
  await submitLogin(page, email, WRONG_PASSWORD)
  // Geprüft wird die **Abwesenheit** der Drosselmeldung: Die Meldung über
  // falsche Zugangsdaten steht ab dem ersten Versuch da und wäre danach ein
  // Treffer, der nichts mehr aussagt.
  await expect(page.getByText(THROTTLED_MESSAGE), note).toHaveCount(0)
  await expect(page.getByText(WRONG_CREDENTIALS_MESSAGE)).toBeVisible()
}

/** Ein Versuch, der abgewiesen werden muss — und zwar statt der Passwortprüfung. */
async function expectThrottled(page: Page, email: string, password: string, note: string) {
  await submitLogin(page, email, password)
  await expect(page.getByText(THROTTLED_MESSAGE), note).toBeVisible()
  await expect(page.getByText(WRONG_CREDENTIALS_MESSAGE)).toHaveCount(0)
}

/** Meldet ein bekanntes Konto an und wieder ab — der geglückte Durchlauf. */
async function loginAndOut(page: Page, email: string) {
  await submitLogin(page, email, PASSWORD)
  await page.waitForURL('/')
  await expect(page.getByRole('button', { name: 'Runde starten' })).toBeVisible()

  await page.getByRole('button', { name: 'Abmelden' }).click()
  await page.waitForURL('/login')
}

test('Der sechste Fehlversuch derselben Verbindung wird abgewiesen (BUG-29)', async ({ page }) => {
  // Eine Adresse, die es nicht gibt: Der Zähler soll zählen, ohne dass am Ende
  // ein echtes Konto in einem gedrosselten Zustand zurückbleibt.
  const email = `e2ethrottle_${Date.now().toString(36)}@example.com`

  await page.goto('/login')

  for (let attempt = 1; attempt <= CREDENTIALS_PER_IP; attempt++) {
    await expectAllowedFailure(page, email, `Versuch ${attempt} wurde zu früh gedrosselt`)
  }

  await expectThrottled(
    page,
    email,
    WRONG_PASSWORD,
    `Versuch ${CREDENTIALS_PER_IP + 1} kam durch, obwohl das Limit erreicht war`
  )
})

/**
 * Der Abnahmetest zu **BUG-39** — er prüft das ganze Szenario, nicht die Zeile,
 * die geändert wurde.
 *
 * Ein Test wie „nach einem erfolgreichen Login ist der Konto-Zähler leer" wäre
 * auch gegen den kaputten Code grün gewesen: Dort wurde der Konto-Zähler ja
 * ebenfalls geleert. Der Fehler saß daneben — der IP-Zähler wurde **gelöscht**,
 * und damit konnte ein Angreifer mit einem einzigen eigenen Konto seine eigene
 * Bremse beliebig oft lösen. Gemessen: 24 Passwortversuche gegen 24 verschiedene
 * Konten von einer IP in 3,6 Sekunden, null abgewiesen.
 *
 * Rot werden muss deshalb die **Schleife**: raten, sich selbst anmelden, weiter
 * raten. Der eigene Login darf dem Angreifer **keinen einzigen** zusätzlichen
 * Rateversuch einbringen — er hat mit ihm genauso viele Fehlversuche wie ohne.
 */
test('Ein eigener erfolgreicher Login bringt dem Angreifer keinen Rateversuch (BUG-39)', async ({
  page,
}) => {
  // Das eigene Konto des Angreifers. Die Registrierung zählt auf einen eigenen
  // Schlüssel (`register:ip:…`) und rührt den Login-Zähler nicht an.
  const { email: ownAccount } = await register(page, 'e2eSpray')

  await page.getByRole('button', { name: 'Abmelden' }).click()
  await page.waitForURL('/login')

  // Vier Rateversuche gegen fremde Konten: Fehlversuche 1 bis 4 von 5.
  for (let attempt = 1; attempt <= CREDENTIALS_PER_IP - 1; attempt++) {
    await expectAllowedFailure(page, stranger(attempt), `Versuch ${attempt} wurde zu früh gedrosselt`)
  }

  // Der Zug, der vorher alles zurücksetzte: ein erfolgreicher Login mit dem
  // eigenen Konto. Er kostet den Angreifer nichts — und bringt ihm nichts.
  await loginAndOut(page, ownAccount)

  // Der fünfte und letzte erlaubte Fehlversuch. Käme er nicht durch, wäre der
  // eigene Login mitgezählt worden — das war BUG-54.
  await expectAllowedFailure(
    page,
    stranger(CREDENTIALS_PER_IP),
    'Der eigene Login hat einen Fehlversuch mitverbraucht (BUG-54)'
  )

  // Und hier die Zusage aus BUG-39: Das Budget ist aufgebraucht, obwohl
  // dazwischen ein erfolgreicher Login lag. Vorher stand der Zähler nach diesem
  // Login wieder auf 0 und die Schleife war beliebig oft wiederholbar.
  await expectThrottled(
    page,
    stranger(CREDENTIALS_PER_IP + 1),
    WRONG_PASSWORD,
    'Der eigene Login hat den IP-Zähler zurückgesetzt (BUG-39)'
  )

  // Gegenprobe, damit der Test nicht bloß „irgendetwas ist gesperrt" behauptet:
  // Jetzt kommt auch das **richtige** Passwort des eigenen Kontos nicht mehr
  // durch. Der Zähler gilt für die Verbindung, nicht für ein Konto.
  await expectThrottled(page, ownAccount, PASSWORD, 'Die Sperre gilt nicht für die ganze Verbindung')
})

/**
 * Der Abnahmetest zu **BUG-54** — die Gegenrichtung, und ohne sie wäre der Fix
 * für BUG-39 eine Verschlechterung für alle, die nichts getan haben.
 *
 * Gezählt wird **vor** der Passwortprüfung. Solange ein geglückter Login sein
 * Budget behielt, teilten sich alle Nutzer einer geteilten Adresse — Haushalt,
 * Schul-NAT, Mobilfunk-CGNAT — fünf Anmeldungen pro Minute. Gemessen: acht
 * Spieler mit **richtigem** Passwort, fünf kamen hinein, drei sahen „Zu viele
 * Versuche von dieser Verbindung". Die Zielgruppe im PRD schließt Kinder und
 * damit Familien- und Schulanschlüsse ausdrücklich ein.
 *
 * Der Test fährt beide Hälften nacheinander, weil nur beide zusammen die Zusage
 * beschreiben: **Erfolge kosten nichts — und die Bremse ist trotzdem da.**
 */
test('Erfolgreiche Anmeldungen verbrauchen kein Budget, die Bremse bleibt (BUG-54)', async ({
  page,
}) => {
  const { email } = await register(page, 'e2eNat')

  await page.getByRole('button', { name: 'Abmelden' }).click()
  await page.waitForURL('/login')

  // Erste Hälfte: mehr erfolgreiche Anmeldungen, als das Limit an Versuchen
  // zulässt. Mit gezählten Erfolgen wäre spätestens hier Schluss — vor dem Fix
  // wurde genau der sechste Durchlauf abgewiesen.
  for (let round = 1; round <= CREDENTIALS_PER_IP + 1; round++) {
    await loginAndOut(page, email)
    await expect(
      page.getByText(THROTTLED_MESSAGE),
      `Anmeldung ${round} wurde gedrosselt, obwohl das Passwort stimmte (BUG-54)`
    ).toHaveCount(0)
  }

  // Zweite Hälfte — und sie ist der Grund, warum dieser Test nicht allein für
  // sich steht: Die Bremse muss trotzdem greifen. Sonst hätte man BUG-54 gelöst,
  // indem man die Drosselung abgeschafft hat.
  for (let attempt = 1; attempt <= CREDENTIALS_PER_IP; attempt++) {
    await expectAllowedFailure(page, stranger(attempt), `Fehlversuch ${attempt} wurde zu früh gedrosselt`)
  }

  await expectThrottled(
    page,
    stranger(CREDENTIALS_PER_IP + 1),
    WRONG_PASSWORD,
    'Nach sechs Fehlversuchen wurde nicht gedrosselt — die Bremse fehlt'
  )
})
