import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'

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


/**
 * Der Zugang, über den die Suite die richtige Antwort erfährt.
 *
 * **Das ist der Kern der Umstellung vom 2026-09-06.** Bis dahin las der Test die
 * Pokémon-Nummer aus der Bildadresse und schlug den deutschen Namen bei der
 * PokeAPI nach — genau der Weg, den ein Betrüger genommen hätte, und genau
 * deshalb ist er weg (spec.md AC-32). Die Wahrheit steht jetzt nur noch in der
 * Datenbank, und der Test kommt an sie ausschließlich mit dem Service-Role-
 * Schlüssel — also über einen Kanal, den ein Browser nie hat.
 *
 * Dass dieser Umweg überhaupt nötig ist, ist die Aussage: Aus der Seite allein
 * lässt sich die Lösung nicht mehr gewinnen.
 */
function envFromLocalFile(key: string): string {
  const raw = readFileSync('.env.local', 'utf8')
  const line = raw
    .split(String.fromCharCode(10))
    .find((entry) => entry.startsWith(`${key}=`))
  const value = line?.slice(key.length + 1).trim()
  expect(value, `${key} fehlt in .env.local — ohne ihn kann die Suite keine Runde spielen`).toBeTruthy()
  return value as string
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? envFromLocalFile('NEXT_PUBLIC_SUPABASE_URL'),
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? envFromLocalFile('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } }
)

/** Das Frage-Token der gezeigten Frage — undurchsichtig, ohne Pokémon-Nummer (AC-32). */
export async function currentToken(page: Page) {
  const src = await questionImage(page).getAttribute('src')
  const token = src?.match(new RegExp('/api/question/([0-9a-f-]{36})/image'))?.[1]
  expect(token, `Kein Frage-Token in der Bildadresse: ${src}`).toBeTruthy()
  return token as string
}

/** Die richtige Position zu einem Frage-Token, gelesen aus dem Rundenzustand. */
export async function correctIndexFor(token: string) {
  const { data, error } = await admin
    .from('active_runs')
    .select('current_correct_index')
    .eq('current_token', token)
    .maybeSingle()

  expect(error, `Rundenzustand nicht lesbar: ${error?.message}`).toBeNull()
  expect(data, `Kein offener Zustand zum Token ${token}`).toBeTruthy()
  return (data as { current_correct_index: number }).current_correct_index
}

/** Beantwortet die offene Frage richtig und gibt die gewählte Position zurück. */
export async function answerCorrectly(page: Page) {
  await waitForQuestion(page)
  const token = await currentToken(page)
  const index = await correctIndexFor(token)
  const german = await optionLabelAt(page, index)
  await answerOptions(page).nth(index).click()
  return { token, index, german }
}

/** Beantwortet die offene Frage falsch und gibt die richtige Position zurück. */
export async function answerWrongly(page: Page) {
  await waitForQuestion(page)
  const token = await currentToken(page)
  const index = await correctIndexFor(token)
  const german = await optionLabelAt(page, index)
  const wrong = index === 0 ? 1 : 0
  await answerOptions(page).nth(wrong).click()
  return { token, index, german, chosen: wrong }
}

/** Der sichtbare Name hinter einer Antwort-Position (`aria-label` ist „Antwort A: <Name>"). */
export async function optionLabelAt(page: Page, index: number) {
  const label = await answerOptions(page).nth(index).getAttribute('aria-label')
  return (label ?? '').replace(/^Antwort [A-D]: /, '')
}
