import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, render } from '@testing-library/react'
import { ImageProbe, PokemonImage, questionImageUrl } from './pokemon-image'

/**
 * Die **Frist** des Bildes (spec.md AC-15, AC-16).
 *
 * Warum es diese Datei gibt (BUG-118, qa-report.md 2026-09-07): `onLoad` und
 * `onError` waren getestet, die Zeitgrenze nicht. Sie ist aber der einzige
 * Schutz gegen ein Bild, das **gar nicht antwortet** — der Fall, für den es
 * kein Ereignis gibt. Ein Umbau hätte `IMAGE_TIMEOUT_MS` entfernen oder
 * verstellen können, ohne dass etwas rot wird.
 *
 * Die Tests pinnen deshalb den **Zahlenwert**, nicht nur „es gibt eine Frist":
 * bei 4999 ms darf nichts geschehen, bei 5000 ms muss es geschehen. Eine
 * Änderung auf 10 s oder auf 1 s macht sie rot.
 */

const TIMEOUT_MS = 5_000

/** Das sichtbare Bild trägt einen alt-Text, die Sonde ist mit `alt=""` dekorativ. */
function visibleImage(container: HTMLElement) {
  return container.querySelector('img[alt="Welches Pokémon ist das?"]')
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('questionImageUrl', () => {
  it('bildet die Adresse aus dem Token, nie aus der Pokémon-Nummer (AC-32)', () => {
    expect(questionImageUrl('9f1c3a7e-0000-4000-8000-000000000001')).toBe(
      '/api/question/9f1c3a7e-0000-4000-8000-000000000001/image',
    )
  })
})

describe('PokemonImage — die 5-Sekunden-Frist der angezeigten Frage (AC-15)', () => {
  it('lädt nach genau 5 s still ein zweites Mal und meldet erst nach dem zweiten Fehlschlag', () => {
    const onFailed = vi.fn()
    const { container } = render(
      <PokemonImage src="/api/question/tok/image" alt="Welches Pokémon ist das?" onFailed={onFailed} />,
    )

    const first = visibleImage(container)
    expect(first).not.toBeNull()

    // Kurz vor der Frist darf nichts geschehen — das pinnt die Zahl nach unten.
    advance(TIMEOUT_MS - 1)
    expect(visibleImage(container)).toBe(first)
    expect(onFailed).not.toHaveBeenCalled()

    // Mit der Frist hängt React das Bild über den geänderten `key` neu ein:
    // der zweite Versuch aus AC-15, für den Nutzer unsichtbar.
    advance(1)
    const second = visibleImage(container)
    expect(second).not.toBe(first)
    expect(onFailed).not.toHaveBeenCalled()

    // Auch der zweite Versuch bekommt volle 5 s, bevor der Fehler feststeht.
    advance(TIMEOUT_MS - 1)
    expect(onFailed).not.toHaveBeenCalled()

    advance(1)
    expect(onFailed).toHaveBeenCalledTimes(1)
  })

  it('meldet nach dem Laden nie einen Fehlschlag, egal wie lange die Frage steht', () => {
    const onFailed = vi.fn()
    const onReady = vi.fn()
    const { container } = render(
      <PokemonImage
        src="/api/question/tok/image"
        alt="Welches Pokémon ist das?"
        onReady={onReady}
        onFailed={onFailed}
      />,
    )

    act(() => {
      visibleImage(container)!.dispatchEvent(new Event('load'))
    })
    // spec.md AC-2 — die angezeigte Uhr startet mit dem sichtbaren Bild.
    expect(onReady).toHaveBeenCalledTimes(1)
    const loadedNode = visibleImage(container)

    // Eine stehende Frage darf nicht nach 5 s in die Fehlerkarte kippen, nur
    // weil der Spieler nachdenkt. Schrittweise vorgerückt, **eine Frist je
    // Schritt**: Ein einziger großer Sprung würde React zwischen den Timern
    // nicht neu rendern lassen — der zweite Versuch käme dann gar nicht
    // zustande und der Test wäre grün, ohne etwas zu belegen.
    for (let i = 0; i < 4; i++) {
      advance(TIMEOUT_MS)
      // Kein stiller zweiter Versuch: Das Bild bleibt dasselbe Element.
      expect(visibleImage(container)).toBe(loadedNode)
      expect(onFailed).not.toHaveBeenCalled()
    }
  })

  it('behandelt eine abgelehnte Anfrage wie eine abgelaufene Frist: erst der zweite Fehlschlag zählt', () => {
    const onFailed = vi.fn()
    const { container } = render(
      <PokemonImage src="/api/question/tok/image" alt="Welches Pokémon ist das?" onFailed={onFailed} />,
    )

    act(() => {
      visibleImage(container)!.dispatchEvent(new Event('error'))
    })
    expect(onFailed).not.toHaveBeenCalled()

    act(() => {
      visibleImage(container)!.dispatchEvent(new Event('error'))
    })
    expect(onFailed).toHaveBeenCalledTimes(1)
  })
})

describe('ImageProbe — dieselbe Frist für die vorgeladene Frage (AC-10, EC-6)', () => {
  it('meldet den Fehlschlag erst nach zwei vollen Fristen', () => {
    const onFail = vi.fn()
    const onOk = vi.fn()
    render(<ImageProbe src="/api/question/tok/image" onOk={onOk} onFail={onFail} />)

    advance(TIMEOUT_MS - 1)
    expect(onFail).not.toHaveBeenCalled()

    advance(1)
    expect(onFail).not.toHaveBeenCalled()

    advance(TIMEOUT_MS - 1)
    expect(onFail).not.toHaveBeenCalled()

    advance(1)
    expect(onFail).toHaveBeenCalledTimes(1)
    expect(onOk).not.toHaveBeenCalled()
  })

  it('startet die Frist bei einer neuen Adresse frisch, statt den alten Zähler weiterzuführen', () => {
    const onFail = vi.fn()
    const { rerender } = render(
      <ImageProbe src="/api/question/erste/image" onOk={vi.fn()} onFail={onFail} />,
    )

    // Erste Adresse verbraucht ihren ersten Versuch …
    advance(TIMEOUT_MS)
    expect(onFail).not.toHaveBeenCalled()

    // … dann kommt eine andere Frage. Sie muss wieder zwei Fristen bekommen,
    // sonst würde sie den halb verbrauchten Zähler der vorigen erben.
    rerender(<ImageProbe src="/api/question/zweite/image" onOk={vi.fn()} onFail={onFail} />)
    advance(TIMEOUT_MS)
    expect(onFail).not.toHaveBeenCalled()

    advance(TIMEOUT_MS)
    expect(onFail).toHaveBeenCalledTimes(1)
  })
})
