import { test as base, expect } from '@playwright/test'

/**
 * Der gemeinsame `test` dieser Suite: wie Playwrights eigener, aber jeder Test
 * tritt als **eigener Client** auf.
 *
 * **Warum das nötig ist.** Seit BUG-29 drosseln die Zugangsdaten-Pfade pro IP —
 * 5 Anfragen je Minute (`src/lib/auth/throttle.ts` → `LIMITS`). Jeder Journey
 * hier registriert sein eigenes Konto, und alle 24 Tests aus drei Browser-
 * Projekten kommen bei Playwright von derselben Adresse. Gemessen am 2026-09-05:
 * 8 von 24 rot, alle mit „Zu viele Versuche von dieser Verbindung" auf dem
 * Registrierungsformular. Das war die Drosselung bei der Arbeit, kein Produkt-
 * fehler — aber ohne getrennte Adressen misst die Suite von da an nur noch, wie
 * schnell sie selbst ihr eigenes Limit erreicht.
 *
 * **Warum das nichts verdeckt.** Dass die Drosselung überhaupt greift, prüft
 * `PROJ-1-throttle.spec.ts` ausdrücklich — von einer einzigen Adresse aus und
 * gegen die Grenze. Diese Trennung ist Absicht: Ein Journey soll an seiner
 * Journey scheitern, nicht an einem Zähler, den ein Nachbartest gefüllt hat.
 *
 * **Warum `x-forwarded-for` hier überhaupt zieht.** `clientIp()` nimmt den ersten
 * Eintrag des Headers, weil in Produktion ein Reverse Proxy davorsteht, der ihn
 * setzt und clientseitige Werte verwirft. Lokal steht keiner davor — genau die
 * Schwäche, die `throttle.ts` benennt und die beim Deploy hostseitig zu schließen
 * ist (dieselbe Hausaufgabe wie BUG-18). Die Suite nutzt sie, um zu sein, was sie
 * ohnehin ist: viele verschiedene Clients.
 */

/**
 * Zähler je Worker-Prozess. Zusammen mit dem Worker-Index ergibt das eine
 * eindeutige Adresse pro Test — ohne Zufall, der bei 24 Tests kollidieren kann.
 *
 * Der Adressraum ist `2001:db8::/32`, laut RFC 3849 für Dokumentation reserviert
 * und damit garantiert kein echter Client.
 */
let sequence = 0

/**
 * Eine Kennung, die für **diesen Lauf** gilt und im nächsten eine andere ist.
 *
 * Warum das nötig ist, und zwar nachgemessen: Ohne sie hieß die erste Adresse in
 * jedem Lauf `2001:db8:0::1`. Die Zählerzeilen leben aber 60 Sekunden in der
 * Datenbank weiter — zwei Läufe kurz hintereinander erbten also den Zähler des
 * vorigen. Aufgefallen ist es beim Abnahmetest zu BUG-39, der seinen Zähler
 * absichtlich bis an die Grenze füllt: Beim zweiten Lauf innerhalb einer Minute
 * meldete schon der **erste** Versuch „Zu viele Versuche" — ein Fehlschlag, der
 * nichts über die App aussagt und beim Suchen in die Irre führt.
 */
const runId = Math.floor(Math.random() * 0xffff)
  .toString(16)
  .padStart(4, '0')

/**
 * Zum zweiten Parameter: Playwright nennt ihn in seiner Dokumentation `use`.
 * Er ist positionell, der Name also frei — und hier heißt er `provide`, weil
 * `react-hooks/rules-of-hooks` sonst den gleichnamigen React-Hook zu erkennen
 * glaubt und `npm run lint` mit zwei Fehlern abbricht.
 */
export const test = base.extend<{ clientIp: string }>({
  clientIp: async ({}, provide, testInfo) => {
    sequence += 1
    await provide(
      `2001:db8:${runId}:${testInfo.workerIndex.toString(16)}::${sequence.toString(16)}`
    )
  },

  /**
   * Jeder Kontext des Tests trägt dessen Adresse. Kontexte, die eine Spec selbst
   * über `browser.newContext()` aufmacht (das „andere Gerät" aus EC-7), gehen an
   * dieser Stelle vorbei und bekommen `clientIp` ausdrücklich mitgegeben.
   */
  context: async ({ context, clientIp }, provide) => {
    await context.setExtraHTTPHeaders({ 'x-forwarded-for': clientIp })
    await provide(context)
  },
})

export { expect }
