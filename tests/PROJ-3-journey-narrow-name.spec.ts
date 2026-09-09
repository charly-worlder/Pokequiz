import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { expect, test } from './fixtures'
import { register } from './helpers'

/**
 * Journey 4 — die eigene Zeile auf 320 px, mit einem Trainernamen voller Länge.
 *
 * **Das ist die Lücke, die beide QA-Läufe zu PROJ-3 ausdrücklich offen gelassen
 * und hierher verwiesen haben:** AC-18 und EC-9 sind „NICHT GEPRÜFT — kein
 * Browser in `/qa`". Der Mechanismus war aus dem Markup abgelesen, gesehen hat
 * ihn niemand. Genau diese Klasse Fehler ist in diesem Projekt schon einmal an
 * allen Tests vorbei gelaufen: „TRAINERSERIE" bei 320 px wurde am 2026-09-08
 * auf einem Bildschirmfoto gefunden, während beide Suiten grün waren.
 *
 * Der Unterschied zu `PROJ-3-leaderboard-narrow.spec.ts`: Dort geht es um die
 * **Spaltenüberschriften** und ihre Geometrie zueinander. Hier geht es um die
 * **Datenzeile** eines echten Spielers mit einem Namen, der die erlaubten 20
 * Zeichen (Migration 0001) voll ausschöpft — der Fall, den EC-9 beschreibt.
 *
 * Deckt AC-18 (Platz, Name, Serie und Zeit ohne waagerechtes Scrollen sichtbar)
 * und EC-9 (der Name kürzt, die drei Zahlen bleiben vollständig).
 */

const SCHMAL = 320

function envFromLocalFile(key: string): string {
  const raw = readFileSync('.env.local', 'utf8')
  const line = raw.split(String.fromCharCode(10)).find((entry) => entry.startsWith(`${key}=`))
  return (line?.slice(key.length + 1).trim() ?? '') as string
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? envFromLocalFile('NEXT_PUBLIC_SUPABASE_URL'),
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? envFromLocalFile('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } }
)

test('Ein 20 Zeichen langer Name kürzt, die drei Zahlen bleiben ganz (AC-18, EC-9)', async ({
  page,
}) => {
  // Das Präfix ist 11 Zeichen lang — zusammen mit Trenner und Zeitstempel
  // erreicht `uniqueTrainer` damit immer die Obergrenze und schneidet auf
  // genau 20 ab. Die Zusicherung darunter ist keine Formalie: Fällt der Name
  // kürzer aus, prüft dieser Test den Fall aus EC-9 gar nicht mehr, und das
  // wäre ein Test, der grün ist, weil er nichts mehr tut.
  const { trainer } = await register(page, 'e2eSchmalXY')
  expect(
    trainer.length,
    `Der Testaufbau greift nicht: Der Name ist ${trainer.length} Zeichen lang, EC-9 verlangt die vollen 20`
  ).toBe(20)

  const { data: profile, error } = await admin
    .from('profiles')
    .select('id')
    .eq('trainer_name', trainer)
    .single()
  expect(error, 'Das eben registrierte Profil ist nicht auffindbar').toBeNull()

  // Ein gewerteter Lauf, damit es überhaupt eine eigene Zeile gibt. Erspielt
  // wäre er hier kein Mehrwert — geprüft wird die Darstellung der Zeile, nicht
  // ihr Zustandekommen (das leistet Journey 1).
  const { error: lauf } = await admin.from('runs').insert({
    profile_id: profile!.id,
    streak: 4,
    duration_ms: 754_300,
    round_id: crypto.randomUUID(),
  })
  expect(lauf, 'Der Lauf konnte nicht gesät werden').toBeNull()

  await page.setViewportSize({ width: SCHMAL, height: 900 })
  await page.goto('/leaderboard')

  const zeile = page
    .locator('main section li')
    .filter({ has: page.getByText('Du', { exact: true }) })
  await expect(zeile, 'Die eigene Zeile ist nicht auffindbar').toHaveCount(1)

  const spalten = zeile.locator('> span')
  const nameZelle = spalten.nth(1).locator('span').first()

  // EC-9 — der vollständige Name hängt als `title` an der Zelle. Das ist die
  // Zusage, die die Kürzung überhaupt vertretbar macht: Die Information ist
  // nicht weg, sie ist nur nicht gemalt.
  await expect(nameZelle).toHaveAttribute('title', trainer)

  // EC-9 — und er kürzt auch wirklich. `scrollWidth > clientWidth` ist der
  // einzige Weg, das zuzusichern: Der DOM-Text ist immer vollständig, sichtbar
  // ist er es nicht. Wäre `truncate` oder das `min-w-0` am Elternteil entfernt,
  // stünden die beiden Werte gleich — und die Zelle spränge stattdessen aus
  // ihrer Spalte.
  const gekuerzt = await nameZelle.evaluate(
    (el) => el.scrollWidth > el.clientWidth
  )
  expect(
    gekuerzt,
    'Der 20-Zeichen-Name wird bei 320 px nicht gekürzt — er sprengt seine Spalte, statt abzuschneiden'
  ).toBe(true)

  // AC-18 — Platz, Serie und Zeit bleiben **vollständig** im Bild. Der Name
  // ist bewusst ausgenommen: Er ist das Feld, das nachgibt.
  for (const [index, name] of [
    [0, 'Platz'],
    [2, 'Serie'],
    [3, 'Zeit'],
  ] as const) {
    const box = await spalten.nth(index).boundingBox()
    expect(box, `Die Spalte ${name} wird gar nicht dargestellt`).not.toBeNull()
    expect(box!.x, `Die Spalte ${name} beginnt links außerhalb des Bildschirms`).toBeGreaterThanOrEqual(-0.5)
    expect(
      box!.x + box!.width,
      `Die Spalte ${name} endet bei ${Math.round(box!.x + box!.width)} px und ragt damit über die ${SCHMAL} px hinaus`
    ).toBeLessThanOrEqual(SCHMAL + 0.5)
  }

  // Die Zahlen stehen auch inhaltlich noch da — eine Spalte, die im Bild liegt
  // aber leer ist, wäre von der Messung oben nicht zu unterscheiden.
  await expect(spalten.nth(2)).toHaveText('4')
  await expect(spalten.nth(3)).toHaveText('12:34,3')

  // AC-18 — kein waagerechtes Scrollen. Die Seite als Ganzes, nicht nur die
  // Zeile: Eine Zeile kann sauber sitzen, während die Karte daneben den
  // Viewport sprengt.
  const seitenbreite = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(
    seitenbreite,
    `Die Seite ist ${seitenbreite} px breit bei ${SCHMAL} px sichtbar — sie lässt sich waagerecht scrollen`
  ).toBeLessThanOrEqual(SCHMAL + 1)
})
