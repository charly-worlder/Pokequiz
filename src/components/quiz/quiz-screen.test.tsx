import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QuizScreen } from './quiz-screen'

/**
 * Der normale Ablauf einer Runde, nachdem der Server sie führt (spec.md AC-32
 * bis AC-35).
 *
 * Der wichtigste Test dieser Datei ist der letzte: Er belegt, dass im
 * ausgelieferten Markup **nichts** steht, woraus sich die Lösung ableiten ließe —
 * keine Pokémon-Nummer, kein markierter richtiger Eintrag. Genau daran ist der
 * alte Aufbau gescheitert, und das lässt sich nicht durch Hinsehen sicherstellen.
 */

const actions = vi.hoisted(() => ({
  startRoundAction: vi.fn(),
  prepareNextQuestionAction: vi.fn(),
  promoteQuestionAction: vi.fn(),
  replacePreparedQuestionAction: vi.fn(),
  answerAction: vi.fn(),
  endRoundAction: vi.fn(),
  getRunByRoundIdAction: vi.fn(),
  push: vi.fn(),
}))

vi.mock('@/lib/quiz/question-action', () => ({
  startRoundAction: actions.startRoundAction,
  prepareNextQuestionAction: actions.prepareNextQuestionAction,
  promoteQuestionAction: actions.promoteQuestionAction,
  replacePreparedQuestionAction: actions.replacePreparedQuestionAction,
}))
vi.mock('@/lib/quiz/run-actions', () => ({
  answerAction: actions.answerAction,
  endRoundAction: actions.endRoundAction,
  getRunByRoundIdAction: actions.getRunByRoundIdAction,
}))
// `unstable_rethrow` gehört zum echten Modul und wird von runClientAction
// benutzt (BUG-7). Ohne es im Mock schlüge jeder Aufruf hier fehl.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: actions.push }),
  unstable_rethrow: () => {},
}))

export const question = (token: string, right = 'Glurak') => ({
  token,
  options: [right, 'Relaxo', 'Pikachu', 'Enton'],
})

export function images() {
  return Array.from(document.querySelectorAll('img'))
}

export function loadAllImages() {
  for (const img of images()) fireEvent.load(img)
}

export function startedRound() {
  actions.startRoundAction.mockResolvedValue({
    status: 'ok',
    roundId: 'round-1',
    current: question('t-1'),
    prepared: question('t-2', 'Bisasam'),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  actions.promoteQuestionAction.mockResolvedValue({ promoted: true })
  startedRound()
  actions.prepareNextQuestionAction.mockResolvedValue({
    status: 'ok',
    prepared: question('t-3', 'Schiggy'),
  })
})

describe('QuizScreen — eine Runde spielen', () => {
  it('zeigt die erste Frage und lädt das Bild der vorbereiteten im Hintergrund (AC-10)', async () => {
    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))

    await waitFor(() => expect(screen.getByRole('button', { name: /^Antwort A:/ })).toBeInTheDocument())

    // Zwei Bilder: das sichtbare der aktuellen Frage und die unsichtbare Sonde
    // für die vorbereitete. Beide über die eigene Route, beide mit Token (AC-20, AC-32).
    const sources = images().map((img) => img.getAttribute('src'))
    expect(sources).toContain('/api/question/t-1/image')
    expect(sources).toContain('/api/question/t-2/image')
  })

  it('nimmt nach einer richtigen Antwort die vorbereitete Frage ohne Ladezustand (AC-4, AC-10)', async () => {
    actions.answerAction.mockResolvedValue({
      status: 'answered',
      correct: true,
      correctIndex: 0,
      streak: 1,
      result: null,
    })

    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))
    await waitFor(() => expect(screen.getByText('Glurak')).toBeInTheDocument())

    // Die vorbereitete Frage als geprüft melden, dann antworten.
    loadAllImages()
    fireEvent.click(screen.getByRole('button', { name: 'Antwort A: Glurak' }))

    await waitFor(() => expect(screen.getByText('Bisasam')).toBeInTheDocument(), { timeout: 3000 })
    expect(screen.queryByText('Runde wird vorbereitet …')).not.toBeInTheDocument()
    // Und für die übernächste wurde sofort nachgeladen.
    await waitFor(() => expect(actions.prepareNextQuestionAction).toHaveBeenCalled())
  })

  it('zählt die Serie, die der Server meldet — nicht die eigene (AC-33)', async () => {
    actions.answerAction.mockResolvedValue({
      status: 'answered',
      correct: true,
      correctIndex: 0,
      // Der Server meldet 7, obwohl dies die erste Antwort dieser Runde ist.
      streak: 7,
      result: null,
    })

    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))
    await waitFor(() => expect(screen.getByText('Glurak')).toBeInTheDocument())
    loadAllImages()
    fireEvent.click(screen.getByRole('button', { name: 'Antwort A: Glurak' }))

    await waitFor(() => expect(screen.getByText('7')).toBeInTheDocument(), { timeout: 3000 })
  })

  it('schickt nur Token und Position an den Server (AC-32, AC-33)', async () => {
    actions.answerAction.mockResolvedValue({
      status: 'answered',
      correct: true,
      correctIndex: 0,
      streak: 1,
      result: null,
    })

    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))
    await waitFor(() => expect(screen.getByText('Glurak')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Antwort C: Pikachu' }))

    await waitFor(() => expect(actions.answerAction).toHaveBeenCalledWith({ token: 't-1', choice: 2 }))
  })

  it('startet bei mehreren Klicks auf „Runde starten" genau eine Runde (EC-9)', async () => {
    render(<QuizScreen initialPersonalBest={null} />)
    const button = screen.getByRole('button', { name: 'Runde starten' })

    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)

    await waitFor(() => expect(screen.getByText('Glurak')).toBeInTheDocument())
    expect(actions.startRoundAction).toHaveBeenCalledTimes(1)
  })

  it('verrät im Ausgelieferten weder die Pokémon-Nummer noch die richtige Option (AC-32)', async () => {
    const { container } = render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))
    await waitFor(() => expect(screen.getByText('Glurak')).toBeInTheDocument())

    const markup = container.innerHTML
    expect(markup).not.toContain('official-artwork')
    expect(markup).not.toContain('githubusercontent')
    expect(markup).not.toContain('correctIndex')
    // Keine der vier Optionen ist vor der Antwort anders ausgezeichnet als die
    // anderen: Alle vier tragen denselben Zustand.
    const optionButtons = screen.getAllByRole('button', { name: /^Antwort [A-D]:/ })
    const classes = new Set(optionButtons.map((b) => b.className))
    expect(classes.size).toBe(1)
  })
})
