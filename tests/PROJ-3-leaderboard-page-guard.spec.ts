import { expect, test } from './fixtures'
import { register } from './helpers'

/**
 * PROJ-3 — was die **Seite** ausliefert und was nicht (spec.md AC-13, AC-20,
 * AC-23; EC-8).
 *
 * Das Gegenstück zu `PROJ-3-leaderboard-db-guard.spec.ts`: Dort ging es darum,
 * was die Datenbank hergibt, hier darum, was davon tatsächlich beim Browser
 * ankommt. Die Trennung ist kein Selbstzweck — eine Funktion kann sauber
 * abgeriegelt sein und die Seite trotzdem zu viel ausliefern, etwa weil eine
 * Kennung für die Hervorhebung der eigenen Zeile mitgeschickt wird. Genau das
 * verhindert `is_self`, und genau das wird hier nachgemessen.
 */

test.describe('PROJ-3 — Zugang zur Ranglisten-Seite', () => {
  test('ausgeloggt gibt es keine Trainernamen, sondern /login (AC-13, AC-23)', async ({ page }) => {
    const response = await page.goto('/leaderboard')

    await expect(page).toHaveURL(/\/login$/)

    // Nicht nur die Adresse: Auch der ausgelieferte Text darf nichts von der
    // Rangliste enthalten. Eine Umleitung, die den Inhalt vorher schon
    // gerendert hat, wäre kein Schutz.
    //
    // **Nicht** auf das Wort „Weltrangliste" prüfen — das steht auch in der
    // ausgeloggten Kopfzeile („Deutsche Namen · Serie · Weltrangliste", PROJ-2
    // AC-22) und hat mit dieser Seite nichts zu tun. Ein solcher Test wäre schon
    // vor dem Bau von PROJ-3 rot gewesen und hätte nichts über den Schutz
    // ausgesagt. Geprüft wird deshalb auf zwei Zeichenfolgen, die es
    // ausschließlich auf der Ranglisten-Seite gibt.
    const body = (await response?.text()) ?? (await page.content())
    expect(body).not.toContain('Andere angemeldete Spieler sehen hier')
    expect(body).not.toContain('Sortiert nach Serie, bei Gleichstand entscheidet die Zeit')
    expect(await page.getByRole('heading', { name: 'Weltrangliste' }).count()).toBe(0)
  })

  test('die Seite verbietet die Aufnahme in den Suchindex (AC-23)', async ({ page }) => {
    await register(page, 'lbrobots')
    await page.goto('/leaderboard')

    const robots = page.locator('meta[name="robots"]')
    await expect(robots).toHaveAttribute('content', /noindex/)
    await expect(robots).toHaveAttribute('content', /nofollow/)
  })

  test('eine abgelaufene Sitzung führt auf /login, nicht auf eine halbe Liste (EC-8)', async ({
    page,
    context,
  }) => {
    await register(page, 'lbstale')
    await page.goto('/leaderboard')
    await expect(page.getByRole('heading', { name: 'Weltrangliste' })).toBeVisible()

    // Die Sitzung verschwindet unter der geöffneten Seite — genau der Fall aus
    // EC-8. Der Reload muss auf /login enden.
    await context.clearCookies()
    await page.reload()

    await expect(page).toHaveURL(/\/login$/)
    expect(await page.getByRole('heading', { name: 'Weltrangliste' }).count()).toBe(0)
  })
})

test.describe('PROJ-3 — was den Browser erreicht', () => {
  test('die ausgelieferte Seite enthält keine Konto-Kennung und keine E-Mail (AC-20)', async ({
    page,
  }) => {
    const { email } = await register(page, 'lbfields')

    // Die eigene Kennung aus der Sitzung holen — sie darf im Ranglisten-Markup
    // nirgends auftauchen, auch nicht für die Hervorhebung der eigenen Zeile.
    const ownId = await page.evaluate(() => {
      const raw = Object.keys(localStorage)
        .filter((k) => k.includes('auth-token'))
        .map((k) => localStorage.getItem(k))
        .join('')
      const match = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)
      return match?.[0] ?? null
    })

    await page.goto('/leaderboard')
    await expect(page.getByRole('heading', { name: 'Weltrangliste' })).toBeVisible()

    const html = await page.content()

    expect(html).not.toContain(email)
    // Keine UUID im Markup der Rangliste — weder die eigene noch eine fremde.
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)
    if (ownId) expect(html).not.toContain(ownId)
  })

  test('der Datenschutz-Satz steht ohne Klick auf der Seite (AC-24)', async ({ page }) => {
    await register(page, 'lbprivacy')
    await page.goto('/leaderboard')

    const note = page.getByText(/Andere angemeldete Spieler sehen hier/)
    await expect(note).toBeVisible()

    /**
     * **Genau einmal, und zwar verlässlich geprüft.**
     *
     * Am 2026-09-08 stand der Satz kurzzeitig **doppelt** im DOM: `loading.tsx`
     * zeigte denselben Text wie die fertige Seite, und im Streaming-Fenster
     * stehen Fallback und Inhalt gleichzeitig da. Die `toBeVisible`-Zusage oben
     * hat das zwar aufgedeckt (strict mode, „resolved to 2 elements"), aber nur
     * in etwa 3 von 10 Aufrufen — ein Gate, das je nach Zeitpunkt rot wird, ist
     * kein Gate.
     *
     * Deshalb mehrere Aufrufe hintereinander, jeder direkt nach `goto` gezählt:
     * Das Fenster ist kurz, aber es tritt bei genügend Versuchen zuverlässig auf.
     */
    for (let versuch = 0; versuch < 5; versuch += 1) {
      await page.goto('/leaderboard')
      const anzahl = await page
        .locator('p')
        .filter({ hasText: 'Andere angemeldete Spieler sehen hier' })
        .count()
      expect(
        anzahl,
        `Aufruf ${versuch + 1}: Der Datenschutz-Satz steht ${anzahl}× im DOM — er gehört genau einmal dorthin (AC-24). Zwei Knoten heißen: der Ladezustand wiederholt den fertigen Text.`
      ).toBe(1)
    }
    // Beide Aussagen, die AC-24 verlangt: welche Daten, und dass nur der beste
    // Lauf erscheint.
    await expect(note).toContainText('Trainernamen')
    await expect(note).toContainText('nur deinen besten Lauf')
  })
})

test.describe('PROJ-3 — der Zugang aus der Shell (PROJ-2 AC-7, AC-21)', () => {
  test('der Bestenlisten-Zugang in der Kopfzeile führt auf eine echte Seite', async ({ page }) => {
    await register(page, 'lbheader')

    // Bis zum 2026-09-08 stand `LEADERBOARD_PAGE_EXISTS` auf `false` und dieser
    // Knopf fehlte. Der positive Zweig von PROJ-2 AC-21 war damit nie geprüft —
    // das letzte Mal, dass er sichtbar war, war er der tote Link aus BUG-23.
    const access = page.getByRole('link', { name: 'Bestenliste' })
    await expect(access).toBeVisible()

    await access.click()
    await expect(page).toHaveURL(/\/leaderboard$/)
    await expect(page.getByRole('heading', { name: 'Weltrangliste' })).toBeVisible()
  })
})
