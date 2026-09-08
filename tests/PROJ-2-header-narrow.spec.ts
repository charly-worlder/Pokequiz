import { expect, test } from './fixtures'
import { register } from './helpers'

/**
 * PROJ-2 — die Kopfzeile auf schmalen Geräten (spec.md AC-24, AC-43, EC-16).
 *
 * **Warum dieser Test elementzahl-unabhängig formuliert ist.** Er entstand am
 * 2026-09-08 auf einem Branch von `main`, wo `LEADERBOARD_PAGE_EXISTS` auf
 * `false` steht — die Kopfzeile trägt dort nur **zwei** Bedienelemente, passt
 * bei 320 px und würde jede Prüfung trivial bestehen. Ein Test, der „der
 * Abmelden-Knopf liegt im Bild" behauptet, wäre hier grün und beim Merge von
 * PROJ-3 immer noch grün, obwohl sich die Bedingung geändert hat.
 *
 * Deshalb prüft er **jedes** Bedienelement, das die Kopfzeile gerade enthält.
 * Damit ist er heute wahr und bekommt mit dem dritten Element von selbst Zähne,
 * statt nachgezogen werden zu müssen.
 *
 * Der abschließende Beweis — drei Elemente bei 320 px im echten Zusammenspiel —
 * steht erst nach dem Merge von PROJ-3 an. Beim Bau wurde er vorweggenommen,
 * indem der Schalter lokal umgelegt und wieder zurückgedreht wurde; die Zahlen
 * stehen in `design.md` → Notizen aus dem Bau.
 */

const SCHMALE_BREITEN = [320, 360, 375]

/** Alles, was in der Kopfzeile angeklickt oder angetippt werden kann. */
type Control = { label: string; left: number; right: number; height: number; isBrand: boolean }

async function headerControls(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const hdr = document.querySelector('header')
    if (!hdr) return { viewport: 0, controls: [] as Control[] }
    const controls = [...hdr.querySelectorAll('a, button')].map((el) => {
      const r = el.getBoundingClientRect()
      const label = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30)
      return {
        label,
        left: Math.round(r.left),
        right: Math.round(r.right),
        height: Math.round(r.height),
        // Der Link auf die Startseite: trägt die Wortmarke, ist kein Knopf.
        isBrand: label.startsWith('Pokémon Quiz'),
      }
    })
    return { viewport: document.documentElement.clientWidth, controls }
  })
}

async function erwarteKeinUeberlauf(page: import('@playwright/test').Page, wo: string) {
  const overflow = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }))
  expect(
    overflow.scrollW,
    `${wo}: die Seite ist ${overflow.scrollW} px breit bei ${overflow.clientW} px sichtbar — sie scrollt waagerecht (AC-43)`
  ).toBeLessThanOrEqual(overflow.clientW)

  const { viewport, controls } = await headerControls(page)
  expect(controls.length, `${wo}: die Kopfzeile hat gar kein Bedienelement`).toBeGreaterThan(0)

  for (const c of controls) {
    expect(
      c.right,
      `${wo}: „${c.label}" endet bei ${c.right} px und ragt damit über die sichtbaren ${viewport} px hinaus (AC-24, EC-16)`
    ).toBeLessThanOrEqual(viewport)
    expect(c.left, `${wo}: „${c.label}" beginnt links außerhalb (${c.left} px)`).toBeGreaterThanOrEqual(0)

    // Die Sparmaßnahmen unter 400 px wirken ausschließlich waagerecht — eine
    // flachere Trefferfläche wäre auf einem Touchgerät die falsche Ersparnis
    // (design.md → zwei Untergrenzen).
    //
    // **Gilt für die Knöpfe, nicht für die Wortmarke.** Deren Link ist mit dem
    // Ball-Motiv 28 px hoch, war das vor diesem Fix schon und wird von ihm nicht
    // angefasst; die Untergrenze im Design ist ausdrücklich eine „Knopfhöhe".
    // Sie hier trotzdem zu erzwingen, hieße den Umfang dieses Fixes still zu
    // erweitern — und der Test wäre rot geworden, ohne dass etwas kaputt ist.
    if (!c.isBrand) {
      expect(c.height, `${wo}: „${c.label}" ist nur ${c.height} px hoch`).toBeGreaterThanOrEqual(36)
    }
  }
}

test.describe('PROJ-2 — die Kopfzeile ab 320 px', () => {
  for (const width of SCHMALE_BREITEN) {
    test(`angemeldet passt bei ${width} px alles in die Kopfzeile (AC-24, AC-43, EC-16)`, async ({
      page,
    }) => {
      // Voller Trainername: Die Reduktionsstufen dürfen nicht an seiner Länge
      // hängen. Unter 640 px zeigt der Chip ohnehin nur die Initiale — genau das
      // macht die Zusage prüfbar. Ein Aufbau, der den Namen dort wieder
      // einblendet, hielte sie für „Ash" und bräche sie hier.
      //
      // **Warum das Präfix genau sieben Zeichen hat.** `uniqueTrainer` baut
      // `<Präfix>_<Zeitstempel><Zufall>` und **kürzt auf 20 Zeichen** (Grenze aus
      // Migration 0001). Sieben plus Trennzeichen plus zwölf ergibt exakt 20 —
      // der Name schöpft die Grenze aus **und** bleibt eindeutig. Ein längeres
      // Präfix schneidet den eindeutigen Teil weg: Beim ersten Anlauf hier
      // wollten alle drei parallelen Tests denselben Namen registrieren, und der
      // Fehlschlag sah aus wie ein Zeitproblem („waitForURL timeout"), nicht wie
      // ein vergebener Name.
      await register(page, 'hdrWide')
      await page.setViewportSize({ width, height: 700 })
      await page.waitForTimeout(150)

      await erwarteKeinUeberlauf(page, `angemeldet auf / bei ${width} px`)
    })

    test(`ausgeloggt passt bei ${width} px alles in die Kopfzeile (AC-22, AC-43)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 700 })
      await page.goto('/login')
      await expect(page.getByRole('button', { name: 'Einloggen' })).toBeVisible()

      await erwarteKeinUeberlauf(page, `ausgeloggt auf /login bei ${width} px`)
    })
  }

  test('unter 400 px zeigt die Wortmarke nur das Ball-Motiv, darüber den Schriftzug (AC-21, AC-24)', async ({
    page,
  }) => {
    await register(page, 'hdrMark')

    const schriftzugSichtbar = () =>
      page.evaluate(() => {
        const el = [...document.querySelectorAll('header a span span')].find((s) =>
          (s.textContent ?? '').includes('Pokémon')
        )
        // `hidden` nimmt das Element aus dem Layout: keine Breite, keine Höhe.
        return el ? el.getBoundingClientRect().width > 0 : false
      })

    await page.setViewportSize({ width: 399, height: 700 })
    await page.waitForTimeout(150)
    expect(await schriftzugSichtbar(), 'bei 399 px darf kein Schriftzug stehen').toBe(false)

    await page.setViewportSize({ width: 400, height: 700 })
    await page.waitForTimeout(150)
    expect(await schriftzugSichtbar(), 'ab 400 px gehört der Schriftzug zurück').toBe(true)

    // Das Ball-Motiv bleibt in beiden Fällen der Link auf die Startseite —
    // die Reduktion nimmt der Marke den Text, nicht ihre Funktion.
    await page.setViewportSize({ width: 320, height: 700 })
    const home = page.getByRole('link', { name: 'Pokémon Quiz — Startseite' })
    await expect(home).toBeVisible()
  })
})
