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

  // AC-9 — „Nochmal spielen" startet die neue Runde **unmittelbar**. Der Umweg
  // über den Startbildschirm war BUG-10 (qa-report.md 2026-09-04): ein
  // zusätzlicher Klick, der gegen das PRD-Erfolgskriterium „direkt eine zweite
  // Runde" arbeitet.
  //
  // `waitForQuestion` ist hier die eigentliche Zusicherung, und zwar bewusst als
  // *positive* Prüfung. Ein „‚Runde starten' ist nicht mehr da" wäre die
  // naheliegende Formulierung und wäre falsch: Playwright hält bei der ersten
  // erfolgreichen Messung an, und unmittelbar nach dem Klick ist der Knopf auch
  // beim alten Verhalten für einen Wimpernschlag noch nicht gerendert. Der Test
  // wäre dann ausgerechnet gegen den Fehler grün, den er fangen soll. Dass von
  // selbst eine offene Frage erscheint, kann das alte Verhalten dagegen nicht.
  await page.getByRole('button', { name: 'Nochmal spielen' }).click()

  // --- Runde 2: sofort falsch, also Serie 0 ---------------------------------
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

  // AC-1 — die gespeicherte Bestleistung steht auf dem Startbildschirm. Seit AC-9
  // die neue Runde direkt startet, führt der Weg dorthin über `/` — genau so, wie
  // AC-1 es formuliert („Angenommen ein angemeldeter Nutzer öffnet `/`").
  //
  // Diese eine Prüfung trägt drei Aussagen auf einmal: Runde 1 wurde überhaupt
  // gespeichert (AC-11), sie erscheint auf dem Startbildschirm (AC-1), und die
  // schlechtere Runde 2 hat den Rekord **nicht** überschrieben (AC-8).
  await page.goto('/')
  await expect(page.getByText('Deine Bestleistung')).toBeVisible()
  await expect(page.getByText(/Serie\s*2/)).toBeVisible()
})
