import { describe, expect, it } from 'vitest'

import { formatLeaderboardDuration, ranksToTopFive, TOP_RANKS } from './format'

/**
 * spec.md AC-1 verlangt das Format `mm:ss,s` wörtlich — zweistellige Minuten,
 * zweistellige Sekunden, ein Zehntel nach dem Komma. Die Tests pinnen genau
 * diese Zeichen, nicht „irgendeine Zeitdarstellung": Ein Wechsel auf `m:ss` oder
 * auf den Dezimalpunkt wäre der Fehler, den man hier macht, und er sähe im
 * Vorbeigehen richtig aus.
 */
describe('formatLeaderboardDuration', () => {
  it('schreibt Minuten und Sekunden zweistellig, mit einem Zehntel nach dem Komma', () => {
    expect(formatLeaderboardDuration(83_400)).toBe('01:23,4')
  })

  it('füllt kurze Zeiten links auf, statt einstellig zu bleiben', () => {
    expect(formatLeaderboardDuration(4_200)).toBe('00:04,2')
    expect(formatLeaderboardDuration(0)).toBe('00:00,0')
  })

  it('rundet auf das nächste Zehntel, statt abzuschneiden', () => {
    // Abschneiden ergäbe 01:23,9 — eine Zeit, die besser ist als die gelaufene.
    expect(formatLeaderboardDuration(83_990)).toBe('01:24,0')
    expect(formatLeaderboardDuration(83_449)).toBe('01:23,4')
    expect(formatLeaderboardDuration(83_450)).toBe('01:23,5')
  })

  it('trägt den Übertrag von 59,96 s auf die volle Minute', () => {
    // Der Fehler, den eine Formel mit getrennt gerundeten Sekunden macht:
    // sie schriebe 00:60,0.
    expect(formatLeaderboardDuration(59_960)).toBe('01:00,0')
  })

  it('lässt das Minutenfeld über 99 Minuten wachsen, statt zu überlaufen', () => {
    expect(formatLeaderboardDuration(6_000_000)).toBe('100:00,0')
  })

  it('behandelt einen negativen Wert als null, statt ein Minuszeichen zu zeigen', () => {
    expect(formatLeaderboardDuration(-1)).toBe('00:00,0')
  })
})

/**
 * spec.md AC-7 und EC-2. EC-2 nennt den Wert wörtlich: „Platz 6 — noch 1 bis
 * Top 5."
 */
describe('ranksToTopFive', () => {
  it('ergibt für Platz 6 genau 1 (EC-2)', () => {
    expect(ranksToTopFive(6)).toBe(1)
  })

  it('zählt den Abstand für größere Ränge weiter hoch', () => {
    expect(ranksToTopFive(12)).toBe(7)
  })

  it('ergibt 0 innerhalb der Top-5 — dort gibt es nichts aufzuholen (AC-8)', () => {
    expect(ranksToTopFive(5)).toBe(0)
    expect(ranksToTopFive(1)).toBe(0)
  })

  it('hält die Grenze der Liste bei 5', () => {
    expect(TOP_RANKS).toBe(5)
  })
})
