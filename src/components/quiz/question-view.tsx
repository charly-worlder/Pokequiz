'use client'

import { Button } from '@/components/ui/button'
import { AnswerOption, type AnswerState } from './answer-option'
import { PokemonImage } from './pokemon-image'
import { StatusBar } from './status-bar'
import type { Question } from '@/lib/quiz/question-action'

/**
 * One open or resolved question (spec.md AC-3 to AC-6).
 *
 * `chosenIndex === null` means the question is still open. Once answered, the
 * chosen wrong option turns red and the correct one green *at the same time*,
 * and the resolution stays put until the player clicks on (AC-6) — this
 * component never advances by itself.
 */
export function QuestionView({
  question,
  streak,
  elapsedMs,
  chosenIndex,
  onAnswer,
  onContinue,
  onPictureVisible,
}: {
  question: Question
  streak: number
  elapsedMs: number
  chosenIndex: number | null
  onAnswer: (index: number) => void
  onContinue: () => void
  /** spec.md AC-2 — the round's clock starts when the picture is actually on screen. */
  onPictureVisible: () => void
}) {
  const resolved = chosenIndex !== null
  const answeredWrong = resolved && chosenIndex !== question.correctIndex

  function stateFor(index: number): AnswerState {
    if (!resolved) return 'idle'
    if (index === question.correctIndex) return 'correct'
    if (index === chosenIndex) return 'wrong'
    return 'dimmed'
  }

  return (
    <div className="flex flex-col gap-6">
      <StatusBar streak={streak} elapsedMs={elapsedMs} />

      <div className="rounded-[var(--radius-card-value)] border border-border bg-card p-6 shadow-[0_18px_46px_-26px_rgb(23_28_44_/_0.5)]">
        <PokemonImage
          src={question.imageUrl}
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
            key={`${question.pokemonId}-${option}`}
            label={option}
            index={index}
            state={stateFor(index)}
            disabled={resolved}
            onSelect={() => onAnswer(index)}
          />
        ))}
      </div>

      {answeredWrong && (
        <div className="animate-[in_0.4s_ease-out] flex flex-col items-center gap-3 text-center">
          <p className="text-[15px] text-muted-foreground text-pretty" role="status">
            Richtig wäre{' '}
            <strong className="font-semibold text-foreground">
              {question.options[question.correctIndex]}
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
