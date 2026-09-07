'use client'

import { Button } from '@/components/ui/button'
import { AnswerOption, type AnswerState } from './answer-option'
import { PokemonImage, questionImageUrl } from './pokemon-image'
import { StatusBar } from './status-bar'
import type { ClientQuestion } from '@/lib/quiz/question-action'

/**
 * Eine offene, wartende oder aufgelöste Frage (spec.md AC-3 bis AC-6).
 *
 * **Was sich am 2026-09-06 geändert hat:** Diese Ansicht kennt die Lösung nicht
 * mehr, bevor der Spieler geantwortet hat — `correctIndex` kommt mit dem Urteil
 * des Servers (AC-32, AC-33). Dazwischen liegt ein dritter Zustand: `waiting`.
 * Die geklickte Option ist dann sichtbar gedrückt, aber **noch nicht gefärbt** —
 * die Farbe ist die Antwort des Servers, nicht eine Vermutung des Browsers.
 */
export function QuestionView({
  question,
  streak,
  elapsedMs,
  chosenIndex,
  correctIndex,
  waiting,
  onAnswer,
  onContinue,
  onPictureVisible,
}: {
  question: ClientQuestion
  streak: number
  elapsedMs: number
  chosenIndex: number | null
  /** Erst nach dem Urteil gesetzt (AC-6). */
  correctIndex: number | null
  /** Der Klick ist abgeschickt, das Urteil steht aus. */
  waiting: boolean
  onAnswer: (index: number) => void
  onContinue: () => void
  /** spec.md AC-2 — die angezeigte Uhr startet mit dem sichtbaren Bild. */
  onPictureVisible: () => void
}) {
  const resolved = correctIndex !== null
  const answeredWrong = resolved && chosenIndex !== correctIndex

  function stateFor(index: number): AnswerState {
    if (!resolved) {
      // Vor dem Urteil gibt es nur „gedrückt" — keine Färbung, weil hier niemand
      // weiß, ob die Wahl richtig war.
      return waiting && index === chosenIndex ? 'pending' : 'idle'
    }
    if (index === correctIndex) return 'correct'
    if (index === chosenIndex) return 'wrong'
    return 'dimmed'
  }

  return (
    <div className="flex flex-col gap-6">
      <StatusBar streak={streak} elapsedMs={elapsedMs} />

      <div className="rounded-[var(--radius-card-value)] border border-border bg-card p-6 shadow-[0_18px_46px_-26px_rgb(23_28_44_/_0.5)]">
        <PokemonImage
          src={questionImageUrl(question.token)}
          alt="Welches Pokémon ist das?"
          onReady={onPictureVisible}
        />
      </div>

      <div
        className="grid gap-3 sm:grid-cols-2"
        role="group"
        aria-label="Vier Antwortmöglichkeiten"
      >
        {question.options.map((option, index) => (
          <AnswerOption
            key={`${question.token}-${option}`}
            label={option}
            index={index}
            state={stateFor(index)}
            disabled={chosenIndex !== null}
            onSelect={() => onAnswer(index)}
          />
        ))}
      </div>

      {answeredWrong && (
        <div className="animate-[in_0.4s_ease-out] flex flex-col items-center gap-3 text-center">
          <p className="text-[15px] text-muted-foreground text-pretty" role="status">
            Richtig wäre{' '}
            <strong className="font-semibold text-foreground">
              {question.options[correctIndex]}
            </strong>{' '}
            gewesen.
          </p>
          <Button onClick={onContinue} className="min-h-11">
            Weiter zum Ergebnis
          </Button>
        </div>
      )}
    </div>
  )
}
