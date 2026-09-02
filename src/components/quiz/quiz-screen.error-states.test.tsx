import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QuizScreen } from './quiz-screen'
import type { Question } from '@/lib/quiz/question-action'

/**
 * Written by /qa for the failure paths of PROJ-2.
 *
 * These cannot be provoked from the outside: the PokeAPI is called by the
 * *server*, so blocking requests in a browser does not reach it. Here the
 * action is mocked, which is the only place the outage is reproducible.
 *
 * Covers AC-16, AC-17, AC-18, AC-19, EC-7, EC-10.
 */

const { getNextQuestion, repairImageUrl, saveRun, getPersonalBest, push } = vi.hoisted(() => ({
  getNextQuestion: vi.fn(),
  repairImageUrl: vi.fn(),
  saveRun: vi.fn(),
  getPersonalBest: vi.fn(),
  push: vi.fn(),
}))

vi.mock('@/lib/quiz/question-action', () => ({ getNextQuestion, repairImageUrl }))
vi.mock('@/lib/quiz/run-actions', () => ({ saveRun, getPersonalBest }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
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
    repairImageUrl.mockResolvedValue(null)
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
    repairImageUrl.mockResolvedValue(null) // auch die Rückfallebene liefert nichts

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

  it('EC-11: eine kaputte Bildadresse wird über die Rückfallebene repariert, ohne die Frage zu verlieren', async () => {
    getNextQuestion.mockResolvedValue({ status: 'ok', question: question(9) })
    repairImageUrl.mockResolvedValue('https://example.test/repariert.png')

    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))

    await waitFor(() => expect(images().length).toBeGreaterThan(0))
    failImages()

    await waitFor(() => expect(repairImageUrl).toHaveBeenCalledWith(9))
    await waitFor(() =>
      expect(images().some((i) => i.getAttribute('src') === 'https://example.test/repariert.png')).toBe(true)
    )
    loadImages()
    await waitFor(() => expect(screen.getByText('Name9')).toBeInTheDocument())
    expect(screen.queryByText(ERROR_TEXT)).not.toBeInTheDocument()
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
})
