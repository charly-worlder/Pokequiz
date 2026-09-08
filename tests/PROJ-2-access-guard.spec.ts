import { expect, test } from './fixtures'
import { register } from './helpers'

/**
 * Journey 2 — der Zugangsschutz.
 *
 * Bricht dieser Ablauf still, passiert eines von zwei Dingen: Angemeldete kommen
 * nicht mehr ins Spiel, oder das Spiel steht Nicht-Angemeldeten offen und die
 * Rangliste wird wertlos. Beides fällt in der Oberfläche nicht auf.
 *
 * Deckt AC-13, AC-21, AC-22 und AC-23.
 */

test('Ohne Anmeldung führt jede geschützte Route nach /login (AC-13, AC-22, AC-23)', async ({
  page,
}) => {
  // AC-13 — die Startseite ist nur angemeldet erreichbar.
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: 'Einloggen' })).toBeVisible()

  // Dasselbe für die Bestenliste, die PROJ-3 später füllt.
  await page.goto('/leaderboard')
  await expect(page).toHaveURL(/\/login$/)

  // AC-22 — ausgeloggt trägt die Kopfzeile die Zeile statt des Nutzer-Chips.
  await expect(page.getByRole('banner')).toContainText('Deutsche Namen · Serie · Weltrangliste')
  await expect(page.getByRole('banner').getByText('Abmelden')).toHaveCount(0)

  // AC-23 — die Fußzeile steht auch ausgeloggt, und sie zeigt keinen toten
  // Rechts-Link, solange PROJ-4 die Seiten nicht gebaut hat.
  const footer = page.getByRole('contentinfo')
  await expect(footer).toBeVisible()
  await expect(footer.getByRole('link')).toHaveCount(0)
})

test('Angemeldet ins Spiel, nach dem Abmelden wieder gesperrt (AC-13, AC-21)', async ({ page }) => {
  const { trainer } = await register(page, 'e2eGate')

  // AC-21 — die Kopfzeile führt den Trainernamen und den Zugang zur Bestenliste.
  //
  // **Umgedreht am 2026-09-08, als PROJ-3 die Seite gebaut hat.** Bis dahin stand
  // hier `toHaveCount(0)`: Der Zugang durfte nicht da sein, weil er auf eine 404
  // geführt hätte (BUG-23). AC-21 ist bedingt formuliert — „genau dann, wenn die
  // Ranglisten-Seite existiert" —, es ist also dasselbe Kriterium, nur der andere
  // Zweig. Der Test war ausdrücklich als Stolperdraht für diesen Moment gebaut
  // und hat ausgelöst: Er wurde rot, sobald `LEADERBOARD_PAGE_EXISTS` umsprang.
  const header = page.getByRole('banner')
  const access = header.getByRole('link', { name: 'Bestenliste' })
  await expect(access).toBeVisible()
  await expect(access).toHaveAttribute('href', '/leaderboard')
  await expect(header).toContainText(trainer)

  // Eine gültige Sitzung wird von /login weggeschickt, statt das Formular zu zeigen.
  await page.goto('/login')
  await expect(page).toHaveURL(/localhost:3000\/$/)

  // AC-21 — das Abmelden sitzt im Nutzer-Chip.
  await page.getByRole('button', { name: 'Abmelden' }).click()
  await expect(page).toHaveURL(/\/login$/)

  // AC-13 — nach dem Abmelden greift der Schutz sofort wieder.
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: 'Runde starten' })).toHaveCount(0)
})
