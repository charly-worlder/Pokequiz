import { expect, test } from './fixtures'
import { answerCorrectly, answerWrongly, register, streakValue, waitForQuestion } from './helpers'

/**
 * Journey 1 — von der gespielten Runde in die Weltrangliste.
 *
 * Der Weg, für den es dieses Feature gibt: Ein Spieler beendet eine Runde und
 * will wissen, ob sie gezählt hat. Bricht er, ist die Rangliste für den
 * Spieler, der gerade gespielt hat, wertlos — und das ist genau der Moment, in
 * dem das PRD sein wichtigstes Erfolgskriterium ansetzt („startet er eine
 * zweite Runde?").
 *
 * Deckt AC-1 (Zeile mit Platz, Name, Serie, Zeit im Format `mm:ss,s`),
 * AC-10 (die eigene Zeile ist hervorgehoben), AC-11 (ein Sekunden alter Lauf
 * steht drin, nichts wird zwischengespeichert), AC-14 („Runde starten" als
 * Aktion der Seite) und AC-15 (die Shell aus PROJ-2, keine zweite Navigation).
 *
 * **Warum die eigene Zeile über das „Du"-Abzeichen gesucht wird und nicht über
 * einen Platz.** Die Suite läuft parallel in drei Browser-Projekten gegen
 * **eine** Datenbank, in der gleichzeitig andere Journeys Runden schreiben. Ob
 * dieser Spieler mit Serie 2 in der Top-5 landet oder in der abgesetzten Zeile
 * darunter, hängt damit am Fremdbestand — ein Test, der „Platz 3" zusichert,
 * misst die Nachbartests. Das Abzeichen trägt die eigene Zeile in **beiden**
 * Fällen (AC-8 und AC-7 laufen hier zusammen), und genau das sagt AC-10 zu.
 */

/** Die eine Zeile der Rangliste, die dem Betrachter gehört — in der Liste oder darunter. */
function ownRow(page: import('@playwright/test').Page) {
  return page.locator('main section li').filter({ has: page.getByText('Du', { exact: true }) })
}

test('Eine gespielte Runde steht sofort in der Rangliste (AC-1, AC-10, AC-11, AC-14, AC-15)', async ({
  page,
}) => {
  const { trainer } = await register(page, 'e2eJourney')

  // --- Eine Runde mit zwei richtigen Antworten, dann ein Fehler -------------
  await page.getByRole('button', { name: 'Runde starten' }).click()
  await answerCorrectly(page)
  await expect(streakValue(page)).toHaveText('1')
  await answerCorrectly(page)
  await expect(streakValue(page)).toHaveText('2')

  await waitForQuestion(page)
  await answerWrongly(page)
  await page.getByRole('button', { name: 'Weiter zum Ergebnis' }).click()
  await expect(page.getByText('Runde beendet')).toBeVisible()

  // --- Der Weg, den der Spieler nimmt (PROJ-2 AC-7) -------------------------
  await page.getByRole('link', { name: 'Zur Bestenliste' }).click()
  await page.waitForURL('/leaderboard')

  // AC-15 — die Rangliste benutzt die Shell aus PROJ-2. Genau eine Kopfzeile,
  // genau eine Fußzeile: Eine zweite Navigation wäre das Muster, das
  // `docs/app-shell.md` ausdrücklich verbietet, und sie fiele in einem
  // Screenshot auf, aber in keinem Unit-Test.
  await expect(page.getByRole('banner')).toHaveCount(1)
  await expect(page.getByRole('contentinfo')).toHaveCount(1)

  // AC-11 — dieses Konto ist Sekunden alt und hat genau eine gewertete Runde.
  // Dass seine Zeile hier steht, ist die Zusicherung: Es wird keine
  // zwischengespeicherte Fassung ausgeliefert, sonst fehlte sie.
  const row = ownRow(page)
  await expect(row, 'Die eigene Zeile ist nicht auffindbar — weder in der Top-5 noch darunter').toHaveCount(1)

  // AC-10 — hervorgehoben, und zwar an der Zeile selbst. Das Abzeichen ist der
  // sichtbare Teil davon; der Rahmen daneben (`ring-1 ring-primary/25`) ist
  // Gestaltung und wird bewusst nicht zugesichert.
  await expect(row).toBeVisible()

  // AC-1 — die vier Werte in ihrer Reihenfolge. Die Spalten sind die direkten
  // Kinder der Zeile; sie einzeln zu prüfen pinnt zugleich, dass keine davon
  // verschwindet oder die Plätze tauscht.
  const columns = row.locator('> span')
  await expect(columns).toHaveCount(4)

  await expect(columns.nth(0), 'Die Platz-Spalte trägt keine Zahl').toHaveText(/^\d+$/)
  await expect(columns.nth(1)).toContainText(trainer)
  await expect(columns.nth(2), 'Die Serie der gerade gespielten Runde steht nicht in der Zeile').toHaveText('2')

  // Das Format aus AC-1 wörtlich: zwei Stellen Minuten, zwei Sekunden, ein
  // Zehntel nach dem Komma. Der Wert selbst ist nicht zusicherbar — er hängt
  // daran, wie schnell die Maschine die Bilder geladen hat.
  await expect(columns.nth(3)).toHaveText(/^\d{2}:\d{2},\d$/)

  // AC-24 — der Datenschutz-Satz steht ohne Klick da. Hier nur als Beifang der
  // Journey; die Prüfung in allen vier Zuständen leistet
  // `PROJ-3-leaderboard-page-guard.spec.ts`.
  await expect(page.getByText(/immer nur deinen besten Lauf/)).toBeVisible()

  // AC-14 — die Antwort auf „wo stehe ich" ist die nächste Runde, und sie steht
  // auf derselben Seite statt zwei Klicks entfernt.
  await page.getByRole('link', { name: 'Runde starten' }).click()
  await page.waitForURL('/')
  await expect(page.getByRole('button', { name: 'Runde starten' })).toBeVisible()
})
