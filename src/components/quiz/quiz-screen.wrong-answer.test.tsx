import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { QuizScreen } from './quiz-screen'
import type { Question } from '@/lib/quiz/question-action'

/**
 * Von `/qa` am 2026-09-05 geschrieben — für den Pfad, den **keine** Prüfung des
 * Projekts je betreten hatte.
 *
 * Der Befund, der dazu führte: Jede Fixture der Suite trägt `correctIndex: 0`,
 * und jeder Klick in jedem Test geht auf „Antwort A" — also immer auf die
 * richtige. Die Auflösung nach einer **falschen** Antwort ist damit der Ablauf,
 * mit dem jede Runde endet (AC-6), und er wurde ausschließlich von Hand
 * angesehen. Auch die E2E-Suite berührt ihn nur im Durchlauf, nicht in seinen
 * Einzelzusagen.
 *
 * Deckt AC-6 in vier Zusagen: die beiden Markierungen, das Stillstehen der Uhr,
 * das Ausbleiben eines automatischen Weiterlaufs und das Weiterklicken von Hand.
 */

const { getNextQuestion, saveRun, getPersonalBest, push } = vi.hoisted(() => ({
  getNextQuestion: vi.fn(),
  saveRun: vi.fn(),
  getPersonalBest: vi.fn(),
  push: vi.fn(),
}))

vi.mock('@/lib/quiz/question-action', () => ({ getNextQuestion }))
vi.mock('@/lib/quiz/run-actions', () => ({ saveRun, getPersonalBest }))
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

/** `Antwort A` ist die Lösung, `Antwort B` die falsche Wahl dieses Tests. */
const question = (id: number): Question => ({
  pokemonId: id,
  imageUrl: `https://example.test/${id}.png`,
  options: [`Name${id}`, `FalschB${id}`, `FalschC${id}`, `FalschD${id}`],
  correctIndex: 0,
})

const images = () => Array.from(document.querySelectorAll('img'))

/**
 * Optionen werden über ihr `aria-label` adressiert, nie über ihren Text: Nach
 * der Auflösung steht der Name der Lösung ein zweites Mal auf der Seite, im Satz
 * „Richtig wäre … gewesen." Eine Textsuche träfe dann zwei Knoten.
 */
const option = (name: string) => screen.getByRole('button', { name })

/** Der Uhrwert der Statusleiste — das `<p>` direkt hinter der Beschriftung „Zeit". */
const clock = () => screen.getByText('Zeit').nextElementSibling?.textContent

/**
 * Die Uhr rechnet mit `performance.now()` (quiz-screen.tsx:97), und das fälscht
 * Vitest **nicht** von sich aus — ohne `toFake` bleibt sie über jede vorgespulte
 * Sekunde auf 0:00 stehen. Ein Test, der den Stillstand der Uhr prüft, wäre dann
 * grün, weil sie nie lief: genau die Sorte Test, die den Fehler durchwinkt, den
 * sie bewachen soll. Beim Schreiben ist er zuerst genau so rot geworden.
 */
const CLOCK_TIMERS = [
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'Date',
  'performance',
] as const

describe('QuizScreen — die Auflösung nach einer falschen Antwort (AC-6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let served = 0
    getNextQuestion.mockImplementation(async () => ({
      status: 'ok' as const,
      question: question(++served),
    }))
    saveRun.mockResolvedValue({ status: 'saved', isPersonalBest: false })
  })

  /** Runde starten, erste Frage sichtbar machen, Uhr laufen lassen. */
  async function openFirstQuestion() {
    render(<QuizScreen initialPersonalBest={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    // Mehrere Durchgänge, und das ist keine Vorsicht auf Verdacht: Zuerst hängt
    // nur das Vorlade-Bild im Baum (ImageProbe). Erst dessen Ladeereignis
    // befördert die Frage zur sichtbaren — und erst dann existiert das Bild,
    // dessen onLoad über onReady die Uhr startet (AC-2).
    for (let pass = 0; pass < 3; pass++) {
      await act(async () => {
        for (const img of images()) fireEvent.load(img)
        await vi.advanceTimersByTimeAsync(0)
      })
    }
  }

  it('markiert die gewählte Option rot und rüttelnd, die richtige gleichzeitig grün', async () => {
    vi.useFakeTimers({ toFake: [...CLOCK_TIMERS] })
    try {
      await openFirstQuestion()

      fireEvent.click(option('Antwort B: FalschB1'))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      // Die gewählte, falsche Option: rot + `nudge` (AC-6 nennt beides).
      const chosen = option('Antwort B: FalschB1')
      expect(chosen.className).toContain('animate-[nudge_0.4s_ease-in-out]')
      expect(chosen.className).toContain('#C93B28')

      // **Gleichzeitig** die richtige: grün. Das ist die Auflösung, für die der
      // Nutzer den Namen erfährt — ohne sie wäre die Runde nur ein Abbruch.
      expect(option('Antwort A: Name1').className).toContain('#3E9C63')

      // Die beiden unbeteiligten treten zurück und tragen keine Markierung.
      for (const name of ['Antwort C: FalschC1', 'Antwort D: FalschD1']) {
        expect(option(name).className).toContain('#8A91A3')
        expect(option(name).className).not.toContain('animate-[')
      }

      // Nach der Auflösung ist keine Option mehr wählbar.
      for (const name of [
        'Antwort A: Name1',
        'Antwort B: FalschB1',
        'Antwort C: FalschC1',
        'Antwort D: FalschD1',
      ]) {
        expect(option(name)).toBeDisabled()
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('hält die Uhr an und lässt die Auflösung stehen, bis der Nutzer weiterklickt', async () => {
    vi.useFakeTimers({ toFake: [...CLOCK_TIMERS] })
    try {
      await openFirstQuestion()

      // Drei Sekunden spielen, damit ein Stillstand überhaupt von „lief nie"
      // unterscheidbar ist.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000)
      })
      expect(clock()).toBe('0:03')

      fireEvent.click(option('Antwort B: FalschB1'))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      // AC-6: „die Uhr stoppt". Fünf weitere Sekunden dürfen nichts bewegen.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })
      expect(clock()).toBe('0:03')

      // AC-6: „die Auflösung bleibt stehen, bis der Nutzer selbst weiterklickt".
      // Der richtige Pfad zieht nach 350 ms von selbst weiter — hier darf genau
      // das nicht passieren, auch nach Sekunden nicht.
      expect(screen.getByText(/Richtig wäre/)).toBeInTheDocument()
      expect(option('Antwort A: Name1')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Antwort A: Name2' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Nochmal spielen' })).not.toBeInTheDocument()

      // Erst der Klick des Nutzers führt zum Ergebnis — mit Serie 0, weil die
      // erste Antwort schon falsch war.
      fireEvent.click(screen.getByRole('button', { name: 'Weiter zum Ergebnis' }))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByRole('button', { name: 'Nochmal spielen' })).toBeInTheDocument()
      expect(saveRun).toHaveBeenCalledTimes(1)
      expect(saveRun.mock.calls[0][0]).toMatchObject({ streak: 0 })
    } finally {
      vi.useRealTimers()
    }
  })
})
