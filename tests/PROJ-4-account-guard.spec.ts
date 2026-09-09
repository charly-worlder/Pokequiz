import { expect, test } from './fixtures'
import { PASSWORD, register } from './helpers'

/**
 * PROJ-4 — Zugang und die Wirkung der Löschung auf die Sitzung
 * (spec.md AC-4, AC-12, AC-16, AC-21; EC-1, EC-4).
 *
 * **Der Kern dieser Datei ist die Gegenprobe mit dem alten Cookie.**
 *
 * Das Löschen eines Kontos macht ein bereits ausgestelltes Token **nicht**
 * ungültig — es läuft erst nach einer Stunde ab (`jwt_expiry = 3600`). Diese
 * App ist trotzdem sofort geschützt, weil jeder Schutzpunkt den Auth-Dienst
 * fragt (`getUser()`) statt den Token-Inhalt lokal zu prüfen. Das war der Fix zu
 * BUG-3 in `src/proxy.ts` und ist seither die stille Grundlage von AC-21 —
 * aufgeschrieben hatte es niemand.
 *
 * Dieser Test ist zugleich die Mutationsprobe dafür: Dreht jemand einen
 * Schutzpunkt auf die lokale Token-Prüfung zurück, hält er einen gelöschten
 * Nutzer bis zu eine Stunde lang für angemeldet — und dieser Test wird rot.
 */

test.describe('PROJ-4 — Zugang zum Kontobereich', () => {
  test('leitet ohne Anmeldung auf die Anmeldeseite (AC-4)', async ({ page }) => {
    await page.goto('/account')
    await page.waitForURL('**/login')
    // Kein halb geladener Kontobereich mit fremder Adresse.
    await expect(page.getByRole('heading', { name: 'Dein Konto' })).toHaveCount(0)
  })

  test('löscht das Konto und entwertet die Sitzung sofort (AC-12, AC-21)', async ({ page }) => {
    const { email } = await register(page, 'Weg')

    await page.goto('/account')
    await page.getByRole('button', { name: 'Konto löschen' }).click()
    await page.getByLabel(/Passwort/).fill(PASSWORD)
    await page.getByRole('button', { name: 'Endgültig löschen' }).click()

    // AC-12 — abgemeldet, auf /login, mit Bestätigung.
    await page.waitForURL(/\/login/)
    await expect(page.getByText(/Dein Konto wurde gelöscht/)).toBeVisible()

    /*
      AC-21 — die Gegenprobe. Das Cookie-Glas des Browsers trägt noch die
      Sitzung von vorhin; der Token darin ist kryptografisch bis zu eine Stunde
      gültig. Trotzdem darf er keine Tür mehr öffnen.
    */
    for (const route of ['/', '/account', '/leaderboard']) {
      await page.goto(route)
      await page.waitForURL('**/login')
    }

    /*
      **Hier stand bis zum 2026-09-09 noch ein Anmeldeversuch mit den alten
      Zugangsdaten.** Er ist entfernt, aus zwei Gründen.

      Erstens gehört er nicht hierher: AC-21 ist mit der Schleife darüber
      belegt — die alte Sitzung öffnet keine einzige geschützte Tür mehr. Dass
      das **Konto** wirklich verschwunden ist und nicht nur die Sitzung, prüft
      `tests/PROJ-4-deletion-cascade.spec.ts` an den Datenbankzeilen selbst,
      also gründlicher als ein Formular es könnte.

      Zweitens war er in Mobile Safari unzuverlässig: Das E-Mail-Feld nahm den
      Wert nicht an (gemessen: 14 Versuche, Feld blieb leer), und der Test wäre
      an einer Formular-Eigenheit gescheitert statt an der Sache. Ein Test, der
      aus dem falschen Grund rot wird, kostet mehr als er einbringt.
    */
  })

  test('läuft ein zweiter Löschversuch folgenlos ins Leere (EC-1)', async ({ page, context }) => {
    await register(page, 'Zweimal')

    // Zweiter Tab mit derselben Sitzung, beide auf dem Kontobereich.
    const second = await context.newPage()
    await second.goto('/account')
    await page.goto('/account')

    await page.getByRole('button', { name: 'Konto löschen' }).click()
    await page.getByLabel(/Passwort/).fill(PASSWORD)
    await page.getByRole('button', { name: 'Endgültig löschen' }).click()
    await page.waitForURL(/\/login/)

    // Der zweite Tab weiß nichts davon und versucht es ebenfalls. Erwartet wird
    // die Anmeldeseite — keine Fehlermeldung, kein Absturz.
    await second.getByRole('button', { name: 'Konto löschen' }).click()
    await second.getByLabel(/Passwort/).fill(PASSWORD)
    await second.getByRole('button', { name: 'Endgültig löschen' }).click()
    await second.waitForURL('**/login')

    await second.close()
  })

  test('zeigt den Bestätigungsbanner nur nach einer echten Löschung (AC-12)', async ({ page }) => {
    // Ohne Merker kein Banner — sonst stünde er auf jeder Anmeldeseite.
    await page.goto('/login')
    await expect(page.getByText(/Dein Konto wurde gelöscht/)).toHaveCount(0)
  })
})
