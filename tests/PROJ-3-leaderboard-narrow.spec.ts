import { expect, test } from './fixtures'
import { register } from './helpers'

/**
 * PROJ-3 — die Ranglisten-Zeile auf schmalen Geräten (spec.md AC-18, EC-9).
 *
 * **Anlass:** Bei 320 px lief die Spaltenüberschrift „TRAINER" (braucht rund
 * 57 px) aus ihrer nur ~45 px breiten Spalte in den Abstand hinein und berührte
 * „SERIE" — auf dem Bildschirm stand „TRAINERSERIE". Gefunden am 2026-09-08,
 * und zwar **auf einem Bildschirmfoto**, nicht von einem Test: Beide Suiten
 * waren grün. Genau deshalb steht die Prüfung jetzt hier.
 *
 * Geprüft wird die **Geometrie**, nicht der Wortlaut: dass sich zwei
 * Spaltenüberschriften nicht überlappen, bleibt richtig, auch wenn jemand die
 * Beschriftungen später ändert.
 */

const SCHMALE_BREITEN = [320, 360, 375]

/**
 * **Gemessen wird die Ausdehnung des gemalten Textes, nicht die der Zelle.**
 *
 * Das ist der Punkt, an dem die erste Fassung dieses Tests wertlos war: Ein
 * Text, der aus seiner Rasterzelle läuft, wird *außerhalb* gemalt — die Zelle
 * selbst behält ihre Breite. Ein Vergleich der Element-Rechtecke findet deshalb
 * nie eine Überlappung, und die Gegenprobe blieb grün, obwohl der Fehler wieder
 * eingebaut war.
 *
 * Ein `Range` über den Textinhalt liefert dagegen das Rechteck der Glyphen und
 * ragt mit ihnen heraus. Erst damit ist „TRAINERSERIE" messbar.
 */
async function spaltenGeometrie(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const kopf = document.querySelector('main section ul li')
    if (!kopf) return null
    const zellen = [...kopf.children].map((el) => {
      const zelle = el.getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(el)
      const text = range.getBoundingClientRect()
      return {
        text: (el.textContent ?? '').trim(),
        zelleLinks: Math.round(zelle.left),
        zelleRechts: Math.round(zelle.right),
        textLinks: Math.round(text.left),
        textRechts: Math.round(text.right),
        // Ragt der Text aus seiner Zelle? Ohne `truncate` läuft er heraus, mit
        // `truncate` wird er gekürzt — beides soll hier nicht vorkommen.
        ragtHeraus: Math.round(text.right) > Math.round(zelle.right) + 1,
        gekuerzt: el.scrollWidth > el.clientWidth + 1,
      }
    })
    return { zellen, viewport: document.documentElement.clientWidth }
  })
}

test.describe('PROJ-3 — die Ranglisten-Zeile ab 320 px', () => {
  for (const width of SCHMALE_BREITEN) {
    test(`bei ${width} px überlappen sich die Spaltenüberschriften nicht (AC-18)`, async ({
      page,
    }) => {
      await register(page, 'lbNarrow')
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/leaderboard')

      // **Nicht auf die Überschrift warten.** `loading.tsx` rendert dieselbe
      // Überschrift „Weltrangliste" wie die fertige Seite — bewusst, damit beim
      // Eintreffen der Daten nichts springt (AC-16). Sie ist damit kein Signal
      // dafür, dass die Liste steht. Die erste Fassung dieses Tests hat genau
      // deshalb die **Skelettzeilen** vermessen und leere Texte mit Breite 0
      // gefunden.
      await page.waitForFunction(() => {
        const kopf = document.querySelector('main section ul li')
        return !!kopf && (kopf.textContent ?? '').trim().length > 0
      })
      await page.waitForTimeout(150)

      const geo = await spaltenGeometrie(page)
      expect(geo, 'Die Kopfzeile der Liste wurde nicht gefunden').not.toBeNull()

      // Der eigentliche Nachweis: Der gemalte Text einer Überschrift darf den
      // gemalten Text der nächsten nicht berühren. Genau das war „TRAINERSERIE".
      for (let i = 1; i < geo!.zellen.length; i += 1) {
        const links = geo!.zellen[i - 1]
        const rechts = geo!.zellen[i]
        expect(
          rechts.textLinks,
          `bei ${width} px stößt der Text „${links.text}" (endet ${links.textRechts}) an „${rechts.text}" (beginnt ${rechts.textLinks}) — die Überschriften berühren sich`
        ).toBeGreaterThan(links.textRechts)
      }

      for (const zelle of geo!.zellen) {
        expect(
          zelle.ragtHeraus,
          `bei ${width} px ragt die Überschrift „${zelle.text}" aus ihrer Spalte heraus`
        ).toBe(false)
        // `truncate` ist der Schutz gegen die Fehlerklasse, nicht der gewollte
        // Normalzustand: Eine abgeschnittene Spaltenüberschrift ist selbst ein Mangel.
        expect(
          zelle.gekuerzt,
          `bei ${width} px wird die Überschrift „${zelle.text}" abgeschnitten — die Spalte ist zu schmal für sie`
        ).toBe(false)
      }

      // AC-18 — und die Seite scrollt dabei nicht waagerecht.
      const overflow = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }))
      expect(overflow.scrollW, `bei ${width} px scrollt die Ranglisten-Seite waagerecht`).toBeLessThanOrEqual(
        overflow.clientW
      )
    })
  }
})
