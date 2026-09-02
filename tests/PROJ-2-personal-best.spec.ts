import { expect, test } from '@playwright/test'
import {
  answerCorrectly,
  answerWrongly,
  clockValue,
  register,
  runSavedResponse,
  streakValue,
  waitForQuestion,
} from './helpers'

/**
 * Journey 4 — zweite Runde und persönliche Bestleistung.
 *
 * Das PRD macht „startet jemand nach einem beendeten Lauf direkt eine zweite
 * Runde?" zum wichtigsten Erfolgskriterium, und der eigene Rekord ist der Anreiz
 * dafür. Bricht der Vergleich, verliert das Produkt seinen Wiederholungsgrund —
 * ohne dass irgendetwas nach einem Fehler aussieht.
 *
 * Deckt AC-1 (Bestleistung auf dem Startbildschirm), AC-8 und AC-9.
 */

test('Erste Runde setzt den Rekord, die schlechtere zweite nicht (AC-1, AC-8, AC-9)', async ({
  page,
  request,
}) => {
  await register(page, 'e2eBest')

  // --- Runde 1: zwei richtige Antworten, dann ein Fehler ---------------------
  await page.getByRole('button', { name: 'Runde starten' }).click()
  await answerCorrectly(page, request)
  await expect(streakValue(page)).toHaveText('1')
  await answerCorrectly(page, request)
  await expect(streakValue(page)).toHaveText('2')

  await waitForQuestion(page)
  await answerWrongly(page, request)
  const firstRunSaved = runSavedResponse(page)
  await page.getByRole('button', { name: 'Weiter zum Ergebnis' }).click()
  await firstRunSaved

  // AC-8 — die allererste Runde ist immer eine persönliche Bestleistung.
  await expect(page.getByText('Runde beendet')).toBeVisible()
  await expect(page.getByText('Neue persönliche Bestleistung')).toBeVisible()

  // AC-9 — „Nochmal spielen" führt auf den Startbildschirm zurück.
  await page.getByRole('button', { name: 'Nochmal spielen' }).click()
  const start = page.getByRole('button', { name: 'Runde starten' })
  await expect(start).toBeVisible()

  // AC-1 — dort steht jetzt die gespeicherte Bestleistung mit Serie 2.
  await expect(page.getByText('Deine Bestleistung')).toBeVisible()
  await expect(page.getByText(/Serie\s*2/)).toBeVisible()

  // --- Runde 2: sofort falsch, also Serie 0 ---------------------------------
  await start.click()
  await waitForQuestion(page)

  // AC-9 — die neue Runde beginnt bei Serie 0 mit zurückgesetzter Uhr.
  await expect(streakValue(page)).toHaveText('0')
  await expect(clockValue(page)).toHaveText(/^0:0[0-2]$/)

  await answerWrongly(page, request)
  const secondRunSaved = runSavedResponse(page)
  await page.getByRole('button', { name: 'Weiter zum Ergebnis' }).click()
  await secondRunSaved
  await expect(page.getByText('Runde beendet')).toBeVisible()

  // AC-8 — eine schlechtere Runde wird NICHT als Rekord ausgewiesen. Das ist die
  // Richtung, die still bricht: „immer Rekord" fällt niemandem auf.
  //
  // Das Abzeichen erscheint zusammen mit der Antwort von `saveRun`, die oben
  // abgewartet wurde — die Abwesenheit ist damit eine Aussage über den fertigen
  // Zustand und nicht über einen zu früh abgelesenen.
  await expect(page.getByText('Neue persönliche Bestleistung')).toHaveCount(0)

  // Und der alte Rekord steht unverändert, ist also nicht überschrieben worden.
  await page.getByRole('button', { name: 'Nochmal spielen' }).click()
  await expect(page.getByText(/Serie\s*2/)).toBeVisible()
})
