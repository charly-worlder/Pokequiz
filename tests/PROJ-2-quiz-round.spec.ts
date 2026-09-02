import { expect, test } from '@playwright/test'
import {
  answerCorrectly,
  answerWrongly,
  answerOptions,
  clockValue,
  register,
  runSavedResponse,
  streakValue,
  waitForQuestion,
} from './helpers'

/**
 * Journey 1 — die Kernschleife: die Runde, für die dieses Produkt existiert.
 *
 * Startbildschirm → Runde starten → richtig antworten (Serie steigt) → falsch
 * antworten (Auflösung mit dem deutschen Namen) → Ergebnis → Ergebnis gespeichert.
 *
 * Deckt AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-11 und EC-1.
 */

test('Kernschleife: Runde spielen bis zum gespeicherten Ergebnis (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-11, EC-1)', async ({
  page,
  request,
}) => {
  await register(page, 'e2eRun')

  // AC-1 — der Startbildschirm erklärt das Spiel und bietet die Primär-Aktion.
  await expect(page.getByRole('heading', { name: /Erkennst du sie am Bild/ })).toBeVisible()
  const start = page.getByRole('button', { name: 'Runde starten' })
  await expect(start).toBeVisible()

  // AC-2 — erste Frage in unter 3 Sekunden, gemessen bis zum geladenen Bild.
  const startedAt = Date.now()
  await start.click()
  await waitForQuestion(page)
  const timeToFirstQuestion = Date.now() - startedAt
  expect(
    timeToFirstQuestion,
    `Erste Frage brauchte ${timeToFirstQuestion} ms, erlaubt sind 3000 ms (AC-2)`
  ).toBeLessThan(3000)

  // AC-3 — genau vier Optionen, alle verschieden.
  await expect(answerOptions(page)).toHaveCount(4)
  const labels = await answerOptions(page).evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('aria-label') ?? '')
  )
  expect(new Set(labels).size, 'Die vier Optionen müssen verschieden sein (AC-3)').toBe(4)

  // AC-4 — jede richtige Antwort erhöht die Serie um genau 1.
  await expect(streakValue(page)).toHaveText('0')
  const seen: string[] = []
  for (let answered = 1; answered <= 3; answered++) {
    const { id } = await answerCorrectly(page, request)
    seen.push(id)
    await expect(streakValue(page)).toHaveText(String(answered))
  }

  // AC-5 — kein Pokémon kommt innerhalb einer Runde zweimal als Lösung vor.
  expect(new Set(seen).size, `Pokémon doppelt gezogen: ${seen.join(', ')} (AC-5)`).toBe(seen.length)

  // AC-6 — die falsche Antwort löst auf und beendet die Runde, ohne weiterzuspringen.
  await waitForQuestion(page)
  const { german } = await answerWrongly(page, request)

  const resolution = page.getByRole('status')
  await expect(resolution).toContainText('Richtig wäre')
  await expect(resolution).toContainText(german)

  // Ab hier steht die Uhr. Der Wert wird bewusst *nach* der Antwort abgelesen:
  // AC-6 sagt „die Uhr stoppt", nicht „sie stand schon vorher still" — zwischen
  // einem früheren Ablesen und dem Klick läuft sie zu Recht weiter.
  const clockWhenStopped = await clockValue(page).innerText()

  // EC-1 — nach der Antwort ist keine Option mehr anklickbar.
  for (const option of await answerOptions(page).all()) {
    await expect(option).toBeDisabled()
  }

  // AC-6 — die Uhr steht still, solange die Auflösung zu sehen ist.
  await page.waitForTimeout(1500)
  await expect(clockValue(page)).toHaveText(clockWhenStopped)
  await expect(page.getByRole('button', { name: 'Weiter zum Ergebnis' })).toBeVisible()

  // AC-7 — der Spieler klickt selbst weiter und sieht Serie, Zeit und beide Aktionen.
  const runSaved = runSavedResponse(page)
  await page.getByRole('button', { name: 'Weiter zum Ergebnis' }).click()
  await runSaved
  await expect(page.getByText('Runde beendet')).toBeVisible()
  await expect(page.getByText('richtige Antworten in')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nochmal spielen' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Zur Bestenliste' })).toBeVisible()

  // AC-11 — das Ergebnis wird automatisch gespeichert. Sichtbar wird das über die
  // Gegenprobe: der Hinweis aus EC-3 darf nicht erscheinen, und die Bestleistung
  // steht anschließend auf dem Startbildschirm — sie kann nur aus einer
  // gespeicherten Zeile stammen.
  await expect(page.getByText('konnte noch nicht gespeichert werden')).toHaveCount(0)
  await page.getByRole('button', { name: 'Nochmal spielen' }).click()
  await expect(page.getByText('Deine Bestleistung')).toBeVisible()
})
