import { expect, test } from './fixtures'
import { register } from './helpers'

/**
 * Journey 2 — der neue Spieler, der noch keinen gewerteten Lauf hat.
 *
 * Der erste Bildschirm, den ein frisch registrierter Spieler auf der Rangliste
 * sieht. Er beantwortet „wo stehe ich?" mit „noch nirgends" — und muss im
 * selben Atemzug sagen, was zu tun ist, sonst ist die Seite für genau den
 * Nutzer eine Sackgasse, den das Produkt gerade gewonnen hat.
 *
 * Deckt AC-9 (Hinweis, wie man in die Wertung kommt, samt „Runde starten"),
 * AC-14 (die Aktion ist da) und AC-15 (die Shell aus PROJ-2). Der Weg dorthin
 * führt bewusst über den Bestenlisten-Zugang der Kopfzeile — das ist der Weg,
 * den ein Spieler nimmt, der **nicht** aus einer Runde kommt.
 *
 * **Warum der Hinweistext und nicht der Zustand zugesichert wird.** AC-9 wird
 * von zwei Komponenten getragen: Ist überhaupt niemand gewertet, trägt ihn der
 * Leerzustand aus AC-17 (`leaderboard-empty.tsx`); gibt es eine Liste, aber
 * dieser Spieler steht nicht darin, trägt ihn `NoRankedRunHint`. Welcher der
 * beiden gilt, hängt am globalen Datenbestand, den die parallel laufenden
 * Journeys mitfüllen — zusicherbar ist deshalb die **Aussage**, die
 * `design.md` beiden Komponenten gemeinsam gibt, nicht die Komponente.
 */

test('Ohne gewerteten Lauf sagt die Rangliste, was zu tun ist (AC-9, AC-14, AC-15)', async ({
  page,
}) => {
  await register(page, 'e2eNeu')

  // Der Weg des Spielers, der nicht aus einer Runde kommt: über die Kopfzeile.
  // Dass dieser Zugang überhaupt existiert, hängt an `LEADERBOARD_PAGE_EXISTS`
  // (PROJ-2 AC-21) — bis PROJ-3 gebaut war, wäre er ein toter Link gewesen.
  await page.getByRole('link', { name: 'Bestenliste' }).click()
  await page.waitForURL('/leaderboard')

  // AC-15 — dieselbe Shell, keine zweite Navigation.
  await expect(page.getByRole('banner')).toHaveCount(1)
  await expect(page.getByRole('contentinfo')).toHaveCount(1)

  // AC-9 — der Hinweis nennt die Bedingung, und zwar die richtige: **eine
  // Frage richtig**, nicht „eine Runde spielen". Der Unterschied ist der ganze
  // Inhalt von AC-5 (Nullrunden kommen nicht in die Wertung), und er wäre
  // genau die Stelle, an der eine spätere Textänderung ihn still verliert.
  await expect(page.getByText(/mindestens/).first()).toBeVisible()
  await expect(page.getByText(/eine Frage richtig/).first()).toBeVisible()

  // Dieser Spieler hat noch keine gewertete Runde — es darf also keine
  // hervorgehobene eigene Zeile geben. Die Zusicherung ist datenunabhängig:
  // Sie gilt, ganz gleich wie viele fremde Zeilen daneben stehen.
  await expect(
    page.locator('main section li').filter({ has: page.getByText('Du', { exact: true }) }),
    'Ein Spieler ohne gewerteten Lauf hat eine eigene Zeile in der Rangliste'
  ).toHaveCount(0)

  // AC-14 — genau **eine** Primär-Aktion, nie zwei untereinander. Im
  // Leerzustand trägt die Karte den Knopf selbst, sonst steht er unter ihr;
  // `page.tsx` unterdrückt den zweiten ausdrücklich (`cardCarriesTheAction`).
  const startRound = page.getByRole('link', { name: 'Runde starten' })
  await expect(startRound, 'Es steht nicht genau eine „Runde starten"-Aktion auf der Seite').toHaveCount(1)

  await startRound.click()
  await page.waitForURL('/')
  await expect(page.getByRole('button', { name: 'Runde starten' })).toBeVisible()
})
