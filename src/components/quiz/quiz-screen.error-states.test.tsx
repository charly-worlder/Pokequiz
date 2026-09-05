import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QuizScreen } from './quiz-screen'
import type { Question } from '@/lib/quiz/question-action'

/**
 * Written by /qa for the failure paths of PROJ-2.
 *
 * These cannot be provoked from the outside: the PokeAPI is called by the
 * *server*, so blocking requests in a browser does not reach it. Here the
 * action is mocked, which is the only place the outage is reproducible.
 *
 * Covers AC-16, AC-17, AC-18, AC-19, EC-7, EC-10 — sowie die Abnahmetests zu
 * BUG-7, BUG-8, BUG-10 und BUG-13 aus dem QA-Lauf vom 2026-09-04. Alle vier
 * beschreiben Zustände, die man beim Anschauen nicht sieht: ein Ergebnis, das
 * gespeichert *aussieht*, eine Runde, die hängt, ein Klick, der nichts tut, und
 * eine Anfrageschleife, die nur im Server-Log auffällt.
 */

const { getNextQuestion, saveRun, getPersonalBest, push } = vi.hoisted(() => ({
  getNextQuestion: vi.fn(),
  saveRun: vi.fn(),
  getPersonalBest: vi.fn(),
  push: vi.fn(),
}))

vi.mock('@/lib/quiz/question-action', () => ({ getNextQuestion }))
vi.mock('@/lib/quiz/run-actions', () => ({ saveRun, getPersonalBest }))
// `unstable_rethrow` gehört zum echten Modul und wird von runClientAction
// benutzt (BUG-7). Ohne es im Mock schlüge jeder Aufruf hier fehl.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), unstable_rethrow: () => {} }))
vi.mock('next/image', () => ({
  default: ({ src, alt, onLoad, onError }: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src as string}
      alt={alt as string}
      onLoad={onLoad as () => void}
      onError={onError as () => void}
    />
  ),
}))

const question = (id: number): Question => ({
  pokemonId: id,
  imageUrl: `https://example.test/${id}.png`,
  options: [`Name${id}`, 'F1', 'F2', 'F3'],
  correctIndex: 0,
})

const images = () => Array.from(document.querySelectorAll('img'))
const loadImages = () => images().forEach((i) => fireEvent.load(i))
const failImages = () => images().forEach((i) => fireEvent.error(i))

const ERROR_TEXT = /Die nächste Frage lädt gerade nicht/

describe('QuizScreen — Fehlerpfade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saveRun.mockResolvedValue({ status: 'saved', isPersonalBest: false })
  })

  it('AC-16: zeigt die Fehlerkarte mit beiden Auswegen, wenn die Quelle nichts liefert', async () => {
    getNextQuestion.mockResolvedValue({ status: 'unavailable' })
    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))

    await waitFor(() => expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Runde beenden' })).toBeInTheDocument()
  })

  it('AC-17: „Erneut versuchen" ist unbegrenzt und setzt die Runde fort, sobald es klappt', async () => {
    getNextQuestion.mockResolvedValue({ status: 'unavailable' })
    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))
    await waitFor(() => expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument())

    // Zwei erfolglose Versuche — die Karte bleibt, es gibt keine Obergrenze.
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
      await waitFor(() => expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument())
    }

    getNextQuestion.mockResolvedValue({ status: 'ok', question: question(7) })
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))

    await waitFor(() => expect(images().length).toBeGreaterThan(0))
    loadImages()
    await waitFor(() => expect(screen.getByText('Name7')).toBeInTheDocument())
    expect(screen.queryByText(ERROR_TEXT)).not.toBeInTheDocument()
  })

  it('AC-18: „Runde beenden" wertet die Runde und speichert sie', async () => {
    getNextQuestion.mockResolvedValue({ status: 'unavailable' })
    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))
    await waitFor(() => expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Runde beenden' }))

    await waitFor(() => expect(saveRun).toHaveBeenCalledTimes(1))
    expect(saveRun.mock.calls[0][0]).toMatchObject({ streak: 0 })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nochmal spielen' })).toBeInTheDocument())
  })

  it('EC-10: nach drei verworfenen Fragen in Folge erscheint die Fehlerkarte statt weiterer Versuche', async () => {
    let served = 0
    getNextQuestion.mockImplementation(async () => ({ status: 'ok', question: question(++served) }))

    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))

    // Jedes vorgeladene Bild scheitert -> verworfen -> neue Frage, bis die Grenze greift.
    for (let i = 0; i < 6; i++) {
      await waitFor(() => expect(images().length).toBeGreaterThan(0))
      failImages()
      await new Promise((r) => setTimeout(r, 30))
      if (screen.queryByText(ERROR_TEXT)) break
    }

    await waitFor(() => expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument())
    // Die Grenze greift, bevor unbegrenzt weitergezogen wird.
    expect(getNextQuestion.mock.calls.length).toBeLessThanOrEqual(4)
  })

  it('EC-7: eine abgelaufene Sitzung führt auf /login, statt die Runde fortzusetzen', async () => {
    getNextQuestion.mockResolvedValue({ status: 'unauthenticated' })
    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'))
  })

  it('EC-7: eine abgelaufene Sitzung beim Speichern führt ebenfalls auf /login', async () => {
    getNextQuestion.mockResolvedValue({ status: 'unavailable' })
    saveRun.mockResolvedValue({ status: 'unauthenticated' })
    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))
    await waitFor(() => expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Runde beenden' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'))
  })

  // Abnahmetest zu BUG-1 (qa-report.md): AC-19 fehlte vollständig — `beforeunload`
  // kam im ganzen Quellcode nicht vor. Dieser Test war zuerst rot, danach wurde
  // der Effekt ergänzt; er hält die Warnung ab jetzt fest.
  it('AC-19: die Verlassen-Warnung greift erst ab Serie 1, nicht davor', async () => {
    // Statt addEventListener zu ersetzen (das greift auch in React ein) wird das
    // Ereignis wirklich ausgelöst: eine abgewehrte Navigation ist das Verhalten,
    // das AC-19 zusagt.
    const fireBeforeUnload = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }

    getNextQuestion.mockResolvedValue({ status: 'ok', question: question(3) })
    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))
    await waitFor(() => expect(images().length).toBeGreaterThan(0))
    loadImages()
    await waitFor(() => expect(screen.getByText('Name3')).toBeInTheDocument())

    expect(fireBeforeUnload()).toBe(false) // Serie 0 — nichts zu verlieren

    fireEvent.click(screen.getByRole('button', { name: 'Antwort A: Name3' }))
    await waitFor(() => expect(fireBeforeUnload()).toBe(true))
  })

  // Abnahmetest zu BUG-6 (qa-report.md, Lauf vom 2026-09-02): Die Warnung hing an
  // `roundInFlight`, das die Phase `loading` nicht einschloss. War die nächste Frage
  // noch nicht vorgeladen, lief die Runde zwar weiter, war aber ungeschützt —
  // gemessen ~400 ms je Runde. Der Test war zuerst rot, danach wurde die Phase
  // ergänzt; er hält die Lücke ab jetzt geschlossen.
  it('AC-19: die Warnung greift auch, während die nächste Frage noch lädt', async () => {
    const fireBeforeUnload = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }

    // Erste Frage kommt, das Vorladen bleibt hängen — nach der richtigen Antwort
    // gibt es keine Reserve, die Runde geht in die Phase `loading`.
    getNextQuestion.mockResolvedValueOnce({ status: 'ok', question: question(3) })
    getNextQuestion.mockReturnValue(new Promise(() => {}))

    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))
    await waitFor(() => expect(images().length).toBeGreaterThan(0))
    loadImages()
    await waitFor(() => expect(screen.getByText('Name3')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Antwort A: Name3' }))
    await waitFor(() => expect(fireBeforeUnload()).toBe(true))

    // Serie 1 ist erreicht, die nächste Frage lädt noch: die Runde hat etwas zu
    // verlieren, also muss die Warnung auch hier greifen.
    await waitFor(() =>
      expect(screen.getByText('Runde wird vorbereitet …')).toBeInTheDocument()
    )
    expect(fireBeforeUnload()).toBe(true)
  })

  it('EC-9: mehrfaches Klicken auf „Runde starten" startet genau eine Runde', async () => {
    getNextQuestion.mockResolvedValue({ status: 'ok', question: question(4) })
    render(<QuizScreen initialPersonalBest={null} />)

    const start = screen.getByRole('button', { name: 'Runde starten' })
    fireEvent.click(start)
    fireEvent.click(start)
    fireEvent.click(start)

    await waitFor(() => expect(images().length).toBeGreaterThan(0))
    // Genau ein Abruf für die erste Frage — die weiteren Klicks laufen ins Leere.
    expect(getNextQuestion).toHaveBeenCalledTimes(1)
  })
// --- Abnahmetests zum QA-Lauf vom 2026-09-04 -----------------------------

  // BUG-7 (High): `saveRun` wurde ohne try/catch aufgerufen. Ein Transport-
  // Fehler ließ alle folgenden Zeilen aus — `saveState` blieb auf 'saving',
  // der Ergebnis-Screen sah aus wie ein gespeichertes Ergebnis, und die
  // Fehler-UI aus EC-3 war unerreichbar.
  it('EC-3 / BUG-7: ein Transport-Fehler beim Speichern zeigt Hinweis und Wiederholung', async () => {
    getNextQuestion.mockResolvedValue({ status: 'unavailable' })
    saveRun.mockRejectedValue(new TypeError('Failed to fetch'))

    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))
    await waitFor(() => expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Runde beenden' }))

    await waitFor(() =>
      expect(screen.getByText(/konnte noch nicht gespeichert werden/)).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: 'Erneut speichern' })).toBeInTheDocument()

    // Und der Wiederholungsversuch geht durch, sobald die Verbindung steht.
    saveRun.mockResolvedValue({ status: 'saved', isPersonalBest: false })
    fireEvent.click(screen.getByRole('button', { name: 'Erneut speichern' }))
    await waitFor(() =>
      expect(screen.queryByText(/konnte noch nicht gespeichert werden/)).not.toBeInTheDocument()
    )
  })

  // BUG-8 (High) und BUG-16: Bis zum 2026-09-04 wurde bei einem kaputten Bild die
  // offizielle Adresse nachgeschlagen. Sie ist für den ganzen Pool *dieselbe*, die
  // gerade gescheitert war — erneut gesetzt ließ sie `ImageProbe`s `key` unverändert,
  // der Browser lud nicht neu, `onError` feuerte kein zweites Mal, und die Runde hing.
  // Die Reparaturstufe ist inzwischen ersatzlos entfallen (spec.md EC-11); ein kaputtes
  // Bild führt unmittelbar zum Verwurf.
  //
  // Der Test feuert `error` deshalb **genau einmal**. Ein zweites Feuern von Hand ist
  // genau das, was der Browser nicht tut, und würde einen Hänger zudecken: Der Fehler
  // bestünde ja gerade darin, dass kein zweites Ereignis kommt.
  it('EC-6: ein kaputtes Bild verwirft die Frage nach einem einzigen Fehlerereignis', async () => {
    let served = 0
    getNextQuestion.mockImplementation(async () => ({ status: 'ok', question: question(++served) }))

    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))

    await waitFor(() =>
      expect(images().some((i) => i.getAttribute('src') === 'https://example.test/1.png')).toBe(true)
    )
    expect(getNextQuestion).toHaveBeenCalledTimes(1)

    failImages() // genau einmal

    // Die Runde muss von sich aus weitergehen: verwerfen und neu ziehen (EC-6).
    await waitFor(() => expect(getNextQuestion).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(images().some((i) => i.getAttribute('src') === 'https://example.test/2.png')).toBe(true)
    )
  })

  // BUG-15 (Medium): `onLoad` und `onError` decken ein Bild ab, das ankommt, und
  // eines, das abgelehnt wird — aber keines, das **gar nicht antwortet**. Ohne
  // Frist saß die Runde dann für immer auf „Runde wird vorbereitet …": keine
  // Fehlerkarte, kein Ausweg, Serie beim Neuladen verloren.
  //
  // Das Bild feuert hier bewusst **kein einziges Ereignis**. Genau darin besteht
  // der Fehler; ein Test, der zum Schluss doch `error` auslöst, prüft ihn weg.
  it('AC-15 / BUG-15: ein hängendes Bild wird einmal still neu geladen und dann verworfen', async () => {
    vi.useFakeTimers()
    try {
      let served = 0
      getNextQuestion.mockImplementation(async () => ({
        status: 'ok',
        question: question(++served),
      }))

      render(<QuizScreen initialPersonalBest={null} />)
      fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(getNextQuestion).toHaveBeenCalledTimes(1)
      expect(images().length).toBeGreaterThan(0)

      // Erster Ablauf: AC-15 verlangt einen stillen zweiten Versuch, keinen
      // Verwurf. Die Frage darf hier noch nicht ersetzt werden.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })
      expect(getNextQuestion).toHaveBeenCalledTimes(1)
      expect(images().some((i) => i.getAttribute('src') === 'https://example.test/1.png')).toBe(true)

      // Zweiter Ablauf: jetzt ist die Frage nicht ladbar und wird verworfen (EC-6).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })
      expect(getNextQuestion).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  // BUG-23: „Pool leer" ist nicht dasselbe wie „alle geschafft". Verworfene
  // Fragen verbrauchen Pool-Einträge, also kann der Pool zu Ende gehen, während
  // die Serie darunter liegt. Vorher stand dann „Alle Pokémon geschafft" über
  // einer Runde, die das nicht war.
  it('EC-2 / BUG-23: „Pool leer" bei zu kleiner Serie zeigt keine Gewinner-Meldung', async () => {
    getNextQuestion.mockResolvedValue({ status: 'pool-empty' })

    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))

    await waitFor(() => expect(saveRun).toHaveBeenCalledTimes(1))
    expect(saveRun.mock.calls[0][0]).toMatchObject({ streak: 0 })

    await waitFor(() => expect(screen.getByText('Runde beendet')).toBeInTheDocument())
    expect(screen.queryByText('Alle Pokémon geschafft')).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Du hast jedes Pokémon aus dem Pool richtig erkannt/)
    ).not.toBeInTheDocument()
  })

  // BUG-33: `answer` plant `advance` aus dem Render **vor** `setStreak`. Das
  // eingefangene `fetchQuestion` hielt `streak` in seiner Closure, der Zweig
  // „Pool leer" speicherte deshalb eine richtige Antwort zu wenig — dauerhaft,
  // und für die Rangliste von PROJ-3 relevant.
  it('EC-2 / BUG-33: „Pool leer" nach einer richtigen Antwort speichert Serie 1, nicht 0', async () => {
    // Erste Frage kommt, danach ist der Pool erschöpft — genau die Lage aus EC-2.
    getNextQuestion.mockResolvedValueOnce({ status: 'ok', question: question(1) })
    getNextQuestion.mockResolvedValue({ status: 'pool-empty' })

    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))

    await waitFor(() => expect(images().length).toBeGreaterThan(0))
    loadImages()
    await waitFor(() => expect(screen.getByText('Name1')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Antwort A: Name1' }))

    await waitFor(() => expect(saveRun).toHaveBeenCalledTimes(1))
    // Vor dem Fix stand hier 0, während der Bildschirm „1 richtige Antworten" zeigte.
    expect(saveRun.mock.calls[0][0]).toMatchObject({ streak: 1 })

    // Und die Gewinner-Meldung bleibt aus: eine richtige Antwort ist nicht der Pool.
    await waitFor(() => expect(screen.getByText('Runde beendet')).toBeInTheDocument())
    expect(screen.queryByText('Alle Pokémon geschafft')).not.toBeInTheDocument()
  })

  // BUG-13 (Medium): Die Verwurfsgrenze griff nur, wenn der Spieler wartete.
  // Fiel die Bildquelle aus, während er noch antwortete, zog das Vorladen
  // endlos nach — je vier Namensabfragen an die PokeAPI, ohne Backoff.
  it('AC-31 / BUG-13: ein Bildausfall während der Antwort zieht nicht endlos nach', async () => {
    let served = 0
    getNextQuestion.mockImplementation(async () => ({ status: 'ok', question: question(++served) }))

    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))

    await waitFor(() => expect(images().length).toBeGreaterThan(0))
    loadImages()
    await waitFor(() => expect(screen.getByText('Name1')).toBeInTheDocument())

    // Ab hier scheitert jedes *vorgeladene* Bild; die sichtbare Frage bleibt.
    for (let i = 0; i < 10; i++) {
      images()
        .filter((img) => img.getAttribute('src') !== 'https://example.test/1.png')
        .forEach((img) => fireEvent.error(img))
      await new Promise((r) => setTimeout(r, 20))
    }

    // 1 Start + 1 Vorladen + höchstens 3 Verwürfe. Ohne die Grenze läuft das
    // hier zweistellig weiter.
    expect(getNextQuestion.mock.calls.length).toBeLessThanOrEqual(5)
    // Die laufende Frage wird davon nicht angetastet.
    expect(screen.getByText('Name1')).toBeInTheDocument()
  })

  // BUG-10 (Medium): AC-9 verlangt eine gestartete Runde, der Code führte auf
  // den Startbildschirm zurück — ein zusätzlicher Klick, der gegen das
  // PRD-Erfolgskriterium „direkt eine zweite Runde" arbeitet.
  it('AC-9 / BUG-10: „Nochmal spielen" startet unmittelbar eine neue Runde', async () => {
    getNextQuestion.mockResolvedValue({ status: 'unavailable' })
    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))
    await waitFor(() => expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Runde beenden' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Nochmal spielen' })).toBeInTheDocument()
    )

    const callsBefore = getNextQuestion.mock.calls.length
    getNextQuestion.mockResolvedValue({ status: 'ok', question: question(5) })
    fireEvent.click(screen.getByRole('button', { name: 'Nochmal spielen' }))

    await waitFor(() => expect(getNextQuestion.mock.calls.length).toBeGreaterThan(callsBefore))
    // Kein Umweg über den Startbildschirm.
    expect(screen.queryByRole('button', { name: 'Runde starten' })).not.toBeInTheDocument()

    await waitFor(() => expect(images().length).toBeGreaterThan(0))
    loadImages()
    await waitFor(() => expect(screen.getByText('Name5')).toBeInTheDocument())
    // Serie 0 und zurückgesetzte Uhr (AC-9).
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('0:00')).toBeInTheDocument()
  })
})

