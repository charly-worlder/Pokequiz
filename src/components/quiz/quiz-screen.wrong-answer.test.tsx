import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QuizScreen } from './quiz-screen'

/**
 * Die falsche Antwort und das Ergebnis (spec.md AC-6, AC-7, AC-8, AC-34, EC-1).
 *
 * Der Unterschied zum alten Aufbau steckt im ersten Test: Zwischen Klick und
 * Färbung liegt jetzt ein Roundtrip. Solange das Urteil aussteht, darf **keine**
 * Option grün oder rot sein — der Browser weiß es schlicht nicht.
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
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: actions.push }),
  unstable_rethrow: () => {},
}))

const question = (token: string, right = 'Glurak') => ({
  token,
  options: [right, 'Relaxo', 'Pikachu', 'Enton'],
})

async function openRound() {
  render(<QuizScreen initialPersonalBest={null} />)
  fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))
  await waitFor(() => expect(screen.getByText('Glurak')).toBeInTheDocument())
}

beforeEach(() => {
  vi.clearAllMocks()
  actions.promoteQuestionAction.mockResolvedValue({ promoted: true })
  actions.startRoundAction.mockResolvedValue({
    status: 'ok',
    roundId: 'round-1',
    current: question('t-1'),
    prepared: question('t-2', 'Bisasam'),
  })
  actions.prepareNextQuestionAction.mockResolvedValue({
    status: 'ok',
    prepared: question('t-3', 'Schiggy'),
  })
})

const wrongVerdict = {
  status: 'answered' as const,
  correct: false,
  correctIndex: 0,
  streak: 4,
  result: { streak: 4, durationMs: 61_500, isPersonalBest: false },
}

describe('QuizScreen — falsche Antwort und Ergebnis', () => {
  it('färbt nichts, solange das Urteil des Servers aussteht (AC-33)', async () => {
    let resolveVerdict: (value: unknown) => void = () => {}
    actions.answerAction.mockReturnValue(new Promise((resolve) => (resolveVerdict = resolve)))

    await openRound()
    fireEvent.click(screen.getByRole('button', { name: 'Antwort B: Relaxo' }))

    // Während des Wartens: kein Häkchen, kein Kreuz, keine Auflösung.
    expect(screen.queryByText(/Richtig wäre/)).not.toBeInTheDocument()
    expect(screen.queryByText('✓')).not.toBeInTheDocument()
    expect(screen.queryByText('✕')).not.toBeInTheDocument()

    resolveVerdict(wrongVerdict)
    await waitFor(() => expect(screen.getByText(/Richtig wäre/)).toBeInTheDocument())
  })

  it('zeigt nach dem Urteil die richtige Option und hält die Auflösung an (AC-6)', async () => {
    actions.answerAction.mockResolvedValue(wrongVerdict)

    await openRound()
    fireEvent.click(screen.getByRole('button', { name: 'Antwort B: Relaxo' }))

    await waitFor(() => expect(screen.getByText(/Richtig wäre/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Weiter zum Ergebnis' })).toBeInTheDocument()
    // Die Auflösung bleibt stehen: Es wird nicht von selbst weitergeschaltet.
    expect(screen.queryByText('Runde beendet')).not.toBeInTheDocument()
  })

  it('lässt den zweiten Klick auf eine andere Option wirkungslos (EC-1)', async () => {
    actions.answerAction.mockResolvedValue(wrongVerdict)

    await openRound()
    fireEvent.click(screen.getByRole('button', { name: 'Antwort B: Relaxo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Antwort C: Pikachu' }))

    await waitFor(() => expect(screen.getByText(/Richtig wäre/)).toBeInTheDocument())
    expect(actions.answerAction).toHaveBeenCalledTimes(1)
    expect(actions.answerAction).toHaveBeenCalledWith({ token: 't-1', choice: 1 })
  })

  it('zeigt im Ergebnis die servergemessene Zeit, nicht die Anzeigeuhr (AC-34)', async () => {
    actions.answerAction.mockResolvedValue(wrongVerdict)

    await openRound()
    fireEvent.click(screen.getByRole('button', { name: 'Antwort B: Relaxo' }))
    await waitFor(() => expect(screen.getByText(/Richtig wäre/)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Weiter zum Ergebnis' }))

    // 61.500 ms sind 1:01,5 — ein Wert, den eine im Test kaum laufende
    // Anzeigeuhr niemals erreichen könnte.
    await waitFor(() => expect(screen.getByText('Runde beendet')).toBeInTheDocument())
    expect(screen.getByText(/1:01/)).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('weist die persönliche Bestleistung aus, wenn der Server sie meldet (AC-8)', async () => {
    actions.answerAction.mockResolvedValue({
      ...wrongVerdict,
      result: { streak: 9, durationMs: 30_000, isPersonalBest: true },
    })

    await openRound()
    fireEvent.click(screen.getByRole('button', { name: 'Antwort B: Relaxo' }))
    await waitFor(() => expect(screen.getByText(/Richtig wäre/)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Weiter zum Ergebnis' }))

    await waitFor(() =>
      expect(screen.getByText('Neue persönliche Bestleistung')).toBeInTheDocument()
    )
  })

  it('startet mit „Nochmal spielen" unmittelbar eine neue Runde (AC-9)', async () => {
    actions.answerAction.mockResolvedValue(wrongVerdict)

    await openRound()
    fireEvent.click(screen.getByRole('button', { name: 'Antwort B: Relaxo' }))
    await waitFor(() => expect(screen.getByText(/Richtig wäre/)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Weiter zum Ergebnis' }))
    await waitFor(() => expect(screen.getByText('Runde beendet')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Nochmal spielen' }))

    await waitFor(() => expect(screen.getByText('Glurak')).toBeInTheDocument())
    expect(actions.startRoundAction).toHaveBeenCalledTimes(2)
  })

  it('leitet auf die Anmeldung, wenn die Sitzung mitten in der Runde endet (EC-7)', async () => {
    actions.answerAction.mockResolvedValue({ status: 'unauthenticated' })

    await openRound()
    fireEvent.click(screen.getByRole('button', { name: 'Antwort B: Relaxo' }))

    await waitFor(() => expect(actions.push).toHaveBeenCalledWith('/login'))
  })
})
