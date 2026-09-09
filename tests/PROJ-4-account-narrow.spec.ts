import { expect, test } from './fixtures'
import { register } from './helpers'

/**
 * PROJ-4 — Darstellung und Dialog-Bedienung (spec.md AC-7, AC-14).
 *
 * **Warum das nur hier belegbar ist:** `/qa` hat keinen Browser. Bei PROJ-2 ist
 * genau diese Lücke offen geblieben und steht dort als benanntes Restrisiko in
 * `features/INDEX.md`. Für PROJ-4 wird sie im selben Zug geschlossen, in dem das
 * Feature gebaut wird.
 */

test.describe('PROJ-4 — Kontoseite auf schmalem Gerät', () => {
  test('scrollt bei 320 px nicht waagerecht, auch mit langer Adresse (AC-7)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 })
    await register(page, 'Schmal')

    await page.goto('/account')
    await expect(page.getByRole('heading', { name: 'Dein Konto' })).toBeVisible()

    // Der Test, der wirklich etwas aussagt: Ist das Dokument breiter als das
    // Sichtfeld? Eine reine Sichtbarkeitsprüfung übersieht genau den Fall, um den
    // es geht — ein Element kann sichtbar sein und die Seite trotzdem sprengen.
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(
      overflow.scrollWidth,
      `die Seite ist ${overflow.scrollWidth} px breit bei ${overflow.clientWidth} px sichtbar`
    ).toBeLessThanOrEqual(overflow.clientWidth)

    // Die E-Mail-Adresse ist der lange Wert, an dem eine einzeilige Zeile bricht.
    // Sie muss lesbar bleiben — gekürzt oder umgebrochen, aber im Bild.
    const email = page.getByText(/@example\.com$/)
    await expect(email).toBeVisible()
    const box = await email.boundingBox()
    expect(box, 'die Adresse hat eine Ausdehnung').not.toBeNull()
    expect(box!.x, 'linke Kante im Bild').toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width, 'rechte Kante im Bild').toBeLessThanOrEqual(320)
  })

  test('öffnet und schließt den Lösch-Dialog folgenlos (AC-14)', async ({ page }) => {
    await register(page, 'Dialog')
    await page.goto('/account')

    const open = page.getByRole('button', { name: 'Konto löschen' })
    // Am Dialog verankert, nicht am Text: "nicht rückgängig machen" steht
    // absichtlich **zweimal** auf der Seite — einmal im Gefahrenbereich vor dem
    // Klick (AC-8) und einmal im Dialog als letzte Bestätigung (AC-20). Ein
    // Textanker träfe beide und der Test wäre mehrdeutig.
    const warning = page.getByRole('alertdialog')

    // Abbrechen
    await open.click()
    await expect(warning).toBeVisible()
    await page.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(warning).toBeHidden()

    // Escape
    await open.click()
    await expect(warning).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(warning).toBeHidden()

    // Und folgenlos heißt folgenlos: Das Konto ist danach noch da.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Dein Konto' })).toBeVisible()
    expect(page.url()).toContain('/account')
  })

  test('führt vom Nutzer-Chip in der Kopfzeile zum Konto (AC-1)', async ({ page }) => {
    const { trainer } = await register(page, 'Chip')

    // Kein vierter Knopf: Der Weg ist der Chip, der ohnehin schon dastand.
    await page.getByRole('link', { name: new RegExp(`Dein Konto.*${trainer}`) }).click()

    await page.waitForURL('/account')
    await expect(page.getByRole('heading', { name: 'Dein Konto' })).toBeVisible()
  })
})
