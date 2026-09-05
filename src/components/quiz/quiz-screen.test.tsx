import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QuizScreen } from './quiz-screen'
import type { Question } from '@/lib/quiz/question-action'

/**
 * Regression test for the prefetch (spec.md AC-10).
 *
 * The bug this pins down: after the first question was promoted, nothing kicked
 * off loading the next one, so the reserve was never filled and every question
 * would have shown a loading state. It was invisible in the UI — the only
 * symptom was a single `getNextQuestion` call per round in the server log,
 * which is exactly why it needs a test rather than another manual look.
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

// next/image needs a real <img> here so that load and error events can be
// dispatched; its own props are not what this test is about.
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

function question(id: number): Question {
  return {
    pokemonId: id,
    imageUrl: `https://example.test/${id}.png`,
    options: [`Name${id}`, 'Falsch1', 'Falsch2', 'Falsch3'],
    correctIndex: 0,
  }
}

/**
 * The probe and the visible picture are both mocked <img>s. The probe carries
 * an empty alt (it is decorative), so it has no `img` role — query the DOM.
 */
function images() {
  return Array.from(document.querySelectorAll('img'))
}

function loadAllImages() {
  for (const img of images()) fireEvent.load(img)
}

describe('QuizScreen — Vorladen der nächsten Frage (AC-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let next = 1
    getNextQuestion.mockImplementation(async () => ({
      status: 'ok' as const,
      question: question(next++),
    }))
    saveRun.mockResolvedValue({ status: 'saved', isPersonalBest: false })
  })

  it('startet das Laden der nächsten Frage, sobald die erste sichtbar ist', async () => {
    render(<QuizScreen initialPersonalBest={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))

    // The first question is fetched…
    await waitFor(() => expect(getNextQuestion).toHaveBeenCalledTimes(1))

    // …its picture loads, which promotes it to the visible question.
    await waitFor(() => expect(images().length).toBeGreaterThan(0))
    loadAllImages()
    await waitFor(() => expect(screen.getByRole('button', { name: /^Antwort A:/ })).toBeInTheDocument())

    // The regression: a second fetch has to start straight away, while the
    // player is still looking at the first question. Before the fix this
    // stayed at 1 and the reserve was never filled.
    await waitFor(() => expect(getNextQuestion).toHaveBeenCalledTimes(2))
  })

  it('zeigt die vorgeladene Frage nach einer richtigen Antwort ohne erneutes Laden', async () => {
    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))

    await waitFor(() => expect(getNextQuestion).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(images().length).toBeGreaterThan(0))
    loadAllImages()
    await waitFor(() => expect(screen.getByText('Name1')).toBeInTheDocument())

    // Let the prefetch land in the reserve.
    await waitFor(() => expect(getNextQuestion).toHaveBeenCalledTimes(2))
    loadAllImages()

    // Answer correctly — the reserve must take over, not a fresh round trip.
    fireEvent.click(screen.getByRole('button', { name: 'Antwort A: Name1' }))

    await waitFor(() => expect(screen.getByText('Name2')).toBeInTheDocument(), { timeout: 3000 })
    expect(screen.queryByText('Runde wird vorbereitet …')).not.toBeInTheDocument()
  })
})
