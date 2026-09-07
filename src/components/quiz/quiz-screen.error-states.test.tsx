import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QuizScreen } from './quiz-screen'

/**
 * Die Fehlerpfade (spec.md AC-16 bis AC-19, EC-3, EC-6, EC-10, EC-12, EC-15).
 *
 * Der wichtigste Test hier ist EC-12: Eine Frage, die der Spieler schon sieht,
 * darf **nicht** ersetzt werden. Ohne diese Grenze wäre „Bild kaputt" ein
 * Überspringen-Knopf für jedes Pokémon, das er nicht erkennt — und die Regel
 * hat vor dem 2026-09-06 niemand getragen, weil die Runde ohnehin dem Browser
 * gehörte.
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

function probeImage() {
  // Die Sonde ist das Bild mit leerem alt (dekorativ); das sichtbare trägt eine
  // Frage als alt-Text.
  return Array.from(document.querySelectorAll('img')).find((img) => img.getAttribute('alt') === '')
}

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
  actions.replacePreparedQuestionAction.mockResolvedValue({
    status: 'ok',
    prepared: question('t-ersatz', 'Schiggy'),
  })
  actions.prepareNextQuestionAction.mockResolvedValue({
    status: 'ok',
    prepared: question('t-3', 'Schiggy'),
  })
})

describe('QuizScreen — Bildausfall', () => {
  it('ersetzt eine vorbereitete Frage, deren Bild nicht lädt (EC-6)', async () => {
    await openRound()

    const probe = probeImage()
    expect(probe?.getAttribute('src')).toBe('/api/question/t-2/image')
    fireEvent.error(probe!)

    await waitFor(() => expect(actions.replacePreparedQuestionAction).toHaveBeenCalledTimes(1))
  })

  it('lässt die angezeigte Frage dabei unangetastet — kein Überspringen (EC-12)', async () => {
    await openRound()

    fireEvent.error(probeImage()!)
    await waitFor(() => expect(actions.replacePreparedQuestionAction).toHaveBeenCalled())

    // Die aktuelle Frage steht unverändert da: dieselben vier Optionen, dasselbe
    // Bild. Der Spieler kann sich nicht durch einen Bildfehler aus ihr befreien.
    expect(screen.getByText('Glurak')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Antwort A: Glurak' })).toBeInTheDocument()
    const visible = Array.from(document.querySelectorAll('img')).find(
      (img) => img.getAttribute('alt') !== ''
    )
    expect(visible?.getAttribute('src')).toBe('/api/question/t-1/image')
  })

  it('zeigt nach drei Verwürfen in Folge die Fehlerkarte, sobald der Spieler wartet (EC-10, AC-16)', async () => {
    actions.answerAction.mockResolvedValue({
      status: 'answered',
      correct: true,
      correctIndex: 0,
      streak: 1,
      result: null,
    })

    await openRound()

    // Drei Bildfehler hintereinander: Nach dem dritten wird nicht weiter
    // nachgezogen.
    for (let i = 0; i < 3; i++) {
      const probe = probeImage()
      if (!probe) break
      fireEvent.error(probe)
      await waitFor(() => expect(probeImage()?.getAttribute('src')).not.toBe(undefined), {
        timeout: 1000,
      }).catch(() => {})
    }

    // Jetzt antwortet der Spieler richtig — es liegt nichts bereit, also wartet er.
    fireEvent.click(screen.getByRole('button', { name: 'Antwort A: Glurak' }))

    await waitFor(
      () => expect(screen.getByText('Die nächste Frage lädt gerade nicht')).toBeInTheDocument(),
      { timeout: 3000 }
    )
  })
})

function visibleImage() {
  return Array.from(document.querySelectorAll('img')).find(
    (img) => img.getAttribute('alt') !== ''
  )
}

describe('QuizScreen — das Bild der angezeigten Frage (BUG-111)', () => {
  it('zeigt die Fehlerkarte, wenn das Bild auch beim zweiten Versuch nicht kommt (AC-15, AC-16)', async () => {
    await openRound()

    // Erster Fehlschlag: stiller zweiter Versuch, noch keine Fehlerkarte (AC-15).
    fireEvent.error(visibleImage()!)
    expect(screen.queryByText('Die nächste Frage lädt gerade nicht')).not.toBeInTheDocument()

    // Zweiter Fehlschlag: jetzt ist Schluss.
    fireEvent.error(visibleImage()!)
    await waitFor(() =>
      expect(screen.getByText('Die nächste Frage lädt gerade nicht')).toBeInTheDocument()
    )
  })

  it('holt beim erneuten Versuch dieselbe Frage zurück, statt eine neue zu ziehen (AC-17, EC-12)', async () => {
    await openRound()
    fireEvent.error(visibleImage()!)
    fireEvent.error(visibleImage()!)
    await waitFor(() =>
      expect(screen.getByText('Die nächste Frage lädt gerade nicht')).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))

    // Dieselbe Frage, dieselben Optionen — kein Überspringen durch einen Bildfehler.
    await waitFor(() => expect(screen.getByText('Glurak')).toBeInTheDocument())
    expect(visibleImage()?.getAttribute('src')).toBe('/api/question/t-1/image')
    expect(actions.replacePreparedQuestionAction).not.toHaveBeenCalled()
  })
})

describe('QuizScreen — erschöpfter Ziehungsvorrat (BUG-114)', () => {
  it('beendet die Runde und wertet sie, statt hängenzubleiben (EC-2)', async () => {
    actions.answerAction.mockResolvedValue({
      status: 'answered',
      correct: true,
      correctIndex: 0,
      streak: 5,
      result: null,
    })
    actions.prepareNextQuestionAction.mockResolvedValue({ status: 'pool-empty' })
    actions.endRoundAction.mockResolvedValue({
      status: 'ended',
      result: { streak: 5, durationMs: 42_000, isPersonalBest: false },
    })

    await openRound()

    // Die vorbereitete Frage als geprüft melden, damit sie nachrücken kann …
    fireEvent.load(probeImage()!)
    fireEvent.click(screen.getByRole('button', { name: 'Antwort A: Glurak' }))
    await waitFor(() => expect(screen.getByText('Bisasam')).toBeInTheDocument(), {
      timeout: 3000,
    })

    // … danach ist der Vorrat leer, und der Spieler wartet auf eine Frage,
    // die es nicht mehr gibt.
    fireEvent.click(screen.getByRole('button', { name: 'Antwort A: Bisasam' }))

    await waitFor(() => expect(screen.getByText('Runde beendet')).toBeInTheDocument(), {
      timeout: 3000,
    })
    expect(actions.endRoundAction).toHaveBeenCalled()
    expect(screen.queryByText('Runde wird vorbereitet …')).not.toBeInTheDocument()
  })
})
describe('QuizScreen — Fehlerkarte', () => {
  async function reachErrorCard() {
    actions.answerAction.mockResolvedValue({
      status: 'answered',
      correct: true,
      correctIndex: 0,
      streak: 3,
      result: null,
    })
    actions.prepareNextQuestionAction.mockResolvedValue({ status: 'unavailable' })

    await openRound()
    fireEvent.error(probeImage()!)
    await waitFor(() => expect(actions.replacePreparedQuestionAction).toHaveBeenCalled())
    // Auch der Ersatz lädt nicht.
    actions.replacePreparedQuestionAction.mockResolvedValue({ status: 'unavailable' })
    await waitFor(() => expect(probeImage()).toBeDefined())
    fireEvent.error(probeImage()!)

    fireEvent.click(screen.getByRole('button', { name: 'Antwort A: Glurak' }))
    await waitFor(
      () => expect(screen.getByText('Die nächste Frage lädt gerade nicht')).toBeInTheDocument(),
      { timeout: 3000 }
    )
  }

  it('behält die Serie und bietet einen unbegrenzten neuen Versuch an (AC-16, AC-17)', async () => {
    await reachErrorCard()

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument()
  })

  it('wertet „Runde beenden" mit der bis dahin erreichten Serie (AC-18)', async () => {
    actions.endRoundAction.mockResolvedValue({
      status: 'ended',
      result: { streak: 3, durationMs: 45_000, isPersonalBest: true },
    })

    await reachErrorCard()
    fireEvent.click(screen.getByRole('button', { name: 'Runde beenden' }))

    await waitFor(() => expect(screen.getByText('Runde beendet')).toBeInTheDocument())
    expect(screen.getByText('Neue persönliche Bestleistung')).toBeInTheDocument()
  })
})

describe('QuizScreen — verlorene Antwort und fremde Runde', () => {
  it('holt ein bereits geschriebenes Ergebnis nach, wenn das Urteil verlorenging (EC-3)', async () => {
    // Der Server hat geschrieben und den Zustand gelöscht; die Antwort kam nie
    // an. Der zweite Versuch trifft deshalb auf ein Token, das nicht mehr passt.
    actions.answerAction.mockResolvedValue({ status: 'stale' })
    actions.getRunByRoundIdAction.mockResolvedValue({
      streak: 12,
      durationMs: 90_000,
      isPersonalBest: true,
    })

    await openRound()
    fireEvent.click(screen.getByRole('button', { name: 'Antwort B: Relaxo' }))

    await waitFor(() => expect(screen.getByText('Runde beendet')).toBeInTheDocument())
    expect(actions.getRunByRoundIdAction).toHaveBeenCalledWith('round-1')
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('sagt es, wenn die Runde anderswo weiterlief (EC-15)', async () => {
    actions.answerAction.mockResolvedValue({ status: 'stale' })
    actions.getRunByRoundIdAction.mockResolvedValue(null)

    await openRound()
    fireEvent.click(screen.getByRole('button', { name: 'Antwort B: Relaxo' }))

    await waitFor(() =>
      expect(screen.getByText('Diese Runde ist nicht mehr offen')).toBeInTheDocument()
    )
    expect(screen.getByText(/anderen Tab weiter/)).toBeInTheDocument()
  })
})

describe('QuizScreen — Verlassen der Seite', () => {
  it('warnt erst, wenn die Runde etwas zu verlieren hat (AC-19)', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    actions.answerAction.mockResolvedValue({
      status: 'answered',
      correct: true,
      correctIndex: 0,
      streak: 1,
      result: null,
    })

    await openRound()
    expect(addSpy.mock.calls.some(([type]) => type === 'beforeunload')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Antwort A: Glurak' }))

    await waitFor(
      () => expect(addSpy.mock.calls.some(([type]) => type === 'beforeunload')).toBe(true),
      { timeout: 3000 }
    )
    addSpy.mockRestore()
  })
})
