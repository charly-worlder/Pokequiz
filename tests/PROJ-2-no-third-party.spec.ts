import { expect, test } from './fixtures'
import { answerCorrectly, questionImage, register, waitForQuestion } from './helpers'

/**
 * Journey 3 — die Zusage, dass der Browser niemals einen Dritten anfragt.
 *
 * Das ist der Ablauf, der am leisesten bricht: Ein Umbau, der die Sprites wieder
 * direkt vom CDN lädt oder eine Schrift von Google einbindet, sieht in der
 * Oberfläche identisch aus. Sichtbar wird er erst an der IP-Adresse, die dabei in
 * ein Drittland geht — und dann steht schon eine Drittlandübermittlung im Raum,
 * für die es weder Einwilligung noch Transfermechanismus gibt.
 *
 * Deckt AC-20, AC-29 und AC-30.
 *
 * Der Test läuft gegen die Entwicklungsumgebung, in der auch Supabase lokal
 * liegt. Erlaubt ist deshalb genau der eigene Rechner; jeder andere Host ist ein
 * Fehler. Nach dem Deploy prüft `/security-check` dasselbe gegen die Live-URL.
 */

const isOwnHost = (url: string) => {
  try {
    const { hostname } = new URL(url)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  } catch {
    return true // data:- und blob:-URLs verlassen den Browser nicht
  }
}

test('Eine ganze Runde ohne eine einzige Anfrage an einen fremden Host (AC-20, AC-29, AC-30)', async ({
  page,
  request,
}) => {
  const foreign: string[] = []
  page.on('request', (req) => {
    if (!isOwnHost(req.url())) foreign.push(`${req.method()} ${req.url()}`)
  })

  await register(page, 'e2eCdn')
  await page.getByRole('button', { name: 'Runde starten' }).click()
  await waitForQuestion(page)

  // AC-20 — das Bild kommt über die Bild-Optimierung der eigenen Domain, nicht
  // vom CDN. Die CDN-Adresse steckt als Parameter darin — der Server holt sie,
  // nicht der Browser.
  const src = await questionImage(page).getAttribute('src')
  expect(src, 'Das Pokémon-Bild muss über die eigene Domain kommen (AC-20)').toMatch(
    /^\/_next\/image\?/
  )

  // Drei Fragen weit spielen, damit auch die nachgeladenen und vorgeladenen
  // Bilder mit im Mitschnitt sind — nicht nur das erste.
  for (let i = 0; i < 3; i++) {
    await answerCorrectly(page, request)
    await waitForQuestion(page)
  }

  // AC-29 / AC-30 — nichts im ausgelieferten Dokument zeigt nach außen: keine
  // Tracking-Ressource, keine Schrift von einem fremden CDN.
  const externalResources = await page.evaluate(() =>
    [...document.querySelectorAll('script[src], link[href], img[src]')]
      .map((node) => (node as HTMLScriptElement).src || (node as HTMLLinkElement).href)
      .filter((url) => url && !url.startsWith(location.origin))
  )
  expect(externalResources, 'Keine externe Ressource im Dokument (AC-29, AC-30)').toEqual([])

  // Der Mitschnitt ist die eigentliche Zusage: keine einzige Anfrage nach außen.
  expect(foreign, `Anfragen an fremde Hosts:\n${foreign.join('\n')}`).toEqual([])
})
