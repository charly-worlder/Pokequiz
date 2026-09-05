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

  // AC-21 — die Kopfzeile führt den Trainernamen; der Zugang zur Bestenliste
  // erscheint erst, wenn PROJ-3 die Seite gebaut hat. Vorher war er da und
  // führte jeden angemeldeten Nutzer auf eine 404 (BUG-23) — dieselbe Regel,
  // die AC-23 eine Zeile weiter unten für die Fußzeile durchsetzt.
  //
  // Dieser Test dreht sich um, sobald PROJ-3 liefert: dann muss der Link da
  // sein. Genau deshalb steht er hier und nicht nur als Kommentar im Code.
  const header = page.getByRole('banner')
  await expect(header.getByRole('link', { name: 'Bestenliste' })).toHaveCount(0)
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
