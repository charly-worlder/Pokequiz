import { expect, type APIRequestContext, type Page } from '@playwright/test'

/**
 * Gemeinsame Bausteine der E2E-Journeys zu PROJ-2.
 *
 * Keine `*.spec.ts`-Datei, wird also von Playwright nicht als Test eingesammelt.
 */

export const PASSWORD = 'E2ePasswort123!'

/**
 * Jeder Test registriert sein eigenes Konto: Die Journeys laufen parallel und in
 * drei Browser-Projekten gleichzeitig, ein geteiltes Konto würde sie über die
 * gespeicherten Runden aneinander koppeln (die persönliche Bestleistung aus
 * AC-8 ist genau so ein geteilter Zustand).
 *
 * `profiles.trainer_name` erlaubt nur `[A-Za-z0-9_]{3,20}` (Migration 0001).
 */
export function uniqueTrainer(prefix: string) {
  const stamp = Date.now().toString(36)
  const noise = Math.floor(Math.random() * 1e6).toString(36)
  return `${prefix}_${stamp}${noise}`.slice(0, 20)
}

/** Registriert ein frisches Konto und landet angemeldet auf dem Startbildschirm. */
export async function register(page: Page, prefix: string) {
  const trainer = uniqueTrainer(prefix)
  const email = `${trainer.toLowerCase()}@example.com`

  await page.goto('/login')
  await page.getByRole('button', { name: 'Registrieren', exact: true }).click()
  await page.getByLabel('Trainername').fill(trainer)
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Registrieren', exact: true }).last().click()

  await page.waitForURL('/')
  await expect(page.getByRole('button', { name: 'Runde starten' })).toBeVisible()

  return { trainer, email }
}

/**
 * Wartet auf die Antwort des Aufrufs, der die Runde speichert.
 *
 * **Muss vor dem auslösenden Klick aufgerufen werden** — der Rückgabewert wird
 * danach abgewartet.
 *
 * Warum nicht `waitForLoadState('networkidle')`: Das löst auf, sobald das Netz
 * gerade ruhig ist — auch dann, wenn der Speicher-Aufruf noch gar nicht gestartet
 * ist. Eine Abwesenheitsprüfung dahinter ist immer grün und würde eine kaputte
 * Rekordlogik durchwinken. Nachgemessen: Nach `networkidle` fehlt das
 * Bestleistungs-Abzeichen selbst dann, wenn es korrekt erscheinen müsste.
 *
 * Alle Server Actions dieses Features sprechen dieselbe Adresse an; unterscheidbar
 * sind sie am Rumpf. Nur das Speichern trägt das Runden-Kennzeichen mit sich.
 */
export function runSavedResponse(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      (response.request().postData() ?? '').includes('clientRoundId')
  )
}

/** Die vier Antwort-Schaltflächen der offenen Frage. */
export function answerOptions(page: Page) {
  return page.getByRole('group', { name: 'Vier Antwortmöglichkeiten' }).getByRole('button')
}

/**
 * Das Bild der aktuellen Frage.
 *
 * Der Alt-Text ist hier der einzige verlässliche Anker: Während des Vorladens
 * (AC-10) hängt eine unsichtbare Vorlade-Komponente ein **zweites** Bild in den
 * Baum — mit `alt=""`, `aria-hidden` und im DOM sogar **vor** dem sichtbaren.
 * Ein schlichtes `main img` würde also zeitweise das Bild der *nächsten* Frage
 * treffen und den Test auf die falsche Lösung ansetzen.
 */
export function questionImage(page: Page) {
  return page.locator('main img[alt="Welches Pokémon ist das?"]')
}

/**
 * Eine Frage gilt erst als offen, wenn zwei Dinge zutreffen:
 *
 * 1. Ihr Bild ist wirklich geladen — genau der Moment, an dem AC-2 den Start der
 *    Uhr festmacht. Auf `visible` allein zu warten würde auch die noch leere
 *    Skelettfläche akzeptieren.
 * 2. Ihre Optionen sind wählbar. Direkt nach einer Antwort stehen die vier
 *    Schaltflächen der *alten* Frage noch da, gesperrt, während die nächste lädt.
 */
export async function waitForQuestion(page: Page) {
  await expect(answerOptions(page)).toHaveCount(4)
  await expect(answerOptions(page).first()).toBeEnabled()
  await expect(answerOptions(page).last()).toBeEnabled()
  await expect(questionImage(page)).toBeVisible()
  await page.waitForFunction(() => {
    const img = document.querySelector(
      'main img[alt="Welches Pokémon ist das?"]'
    ) as HTMLImageElement | null
    return !!img && img.complete && img.naturalWidth > 0
  })
}

/**
 * Der Serien-Zähler der Statusleiste. Er steht im `<p>` direkt hinter der
 * Beschriftung „Serie" — die Beschriftung ist der stabile Anker, die Klassen
 * daneben sind es nicht.
 */
export function streakValue(page: Page) {
  return page.getByText('Serie', { exact: true }).locator('xpath=following-sibling::p[1]')
}

/** Die Rundenuhr, nach demselben Muster hinter der Beschriftung „Zeit". */
export function clockValue(page: Page) {
  return page.getByText('Zeit', { exact: true }).locator('xpath=following-sibling::p[1]')
}

/** Die Pokémon-Nummer der gezeigten Frage, gelesen aus der Bildadresse. */
export async function currentPokemonId(page: Page) {
  const src = await questionImage(page).getAttribute('src')
  const id = decodeURIComponent(src ?? '').match(/\/(\d+)\.png/)?.[1]
  expect(id, `Pokémon-Nummer nicht aus der Bildadresse lesbar: ${src}`).toBeTruthy()
  return id as string
}

/**
 * Der offizielle deutsche Name zu einer Nummer.
 *
 * Der Test muss die richtige Antwort von außen kennen — die Oberfläche verrät sie
 * vor der Antwort nicht, und das ist beabsichtigt. Gefragt wird dieselbe Quelle,
 * aus der die App ihre Optionen zieht; pro Testprozess wird jede Nummer nur einmal
 * abgefragt, damit die Suite die Fair-Use-Bitte der PokeAPI nicht unterläuft
 * (spec.md AC-31).
 */
const germanNames = new Map<string, string>()

export async function germanNameFor(request: APIRequestContext, id: string) {
  const cached = germanNames.get(id)
  if (cached) return cached

  const response = await request.get(`https://pokeapi.co/api/v2/pokemon-species/${id}`)
  expect(response.ok(), `PokeAPI antwortete mit ${response.status()} für #${id}`).toBeTruthy()

  const body = (await response.json()) as { names: { language: { name: string }; name: string }[] }
  const german = body.names.find((entry) => entry.language.name === 'de')?.name
  expect(german, `Kein deutscher Name für #${id}`).toBeTruthy()

  germanNames.set(id, german as string)
  return german as string
}

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Die Schaltfläche mit genau diesem Namen — `aria-label` ist „Antwort A: <Name>". */
export function optionNamed(page: Page, label: string) {
  return page.getByRole('button', {
    name: new RegExp(`^Antwort [A-D]: ${escapeForRegExp(label)}$`),
  })
}

/** Beantwortet die offene Frage richtig und gibt den gewählten Namen zurück. */
export async function answerCorrectly(page: Page, request: APIRequestContext) {
  await waitForQuestion(page)
  const id = await currentPokemonId(page)
  const german = await germanNameFor(request, id)
  await optionNamed(page, german).click()
  return { id, german }
}

/** Beantwortet die offene Frage falsch und gibt den richtigen Namen zurück. */
export async function answerWrongly(page: Page, request: APIRequestContext) {
  await waitForQuestion(page)
  const id = await currentPokemonId(page)
  const german = await germanNameFor(request, id)

  const labels = await answerOptions(page).evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('aria-label') ?? '')
  )
  const wrong = labels.find((label) => !label.endsWith(`: ${german}`))
  expect(wrong, 'Keine falsche Option gefunden').toBeTruthy()

  await page.getByRole('button', { name: wrong as string, exact: true }).click()
  return { id, german }
}
