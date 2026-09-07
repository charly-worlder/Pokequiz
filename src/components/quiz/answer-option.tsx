'use client'

import { cn } from '@/lib/utils'

/**
 * docs/design-system.md calls the four answer buttons „der zentrale Moment des
 * Produkts" and fixes their states exactly. Colours are literal here because
 * the design system specifies these four surfaces individually — they are not
 * derived from the palette tokens.
 *
 * spec.md AC-4 (correct: green), AC-6 (wrong: red + nudge, correct one turns
 * green at the same time).
 *
 * `pending` ist seit dem 2026-09-06 dabei: Zwischen Klick und Urteil des
 * Servers liegt ein Roundtrip (AC-33). Der Klick darf in dieser Zeit nicht ins
 * Leere zu gehen scheinen — die Option ist gedrückt, aber noch nicht gefärbt,
 * weil die Farbe die Antwort des Servers ist und keine Vermutung.
 */
export type AnswerState = 'idle' | 'pending' | 'correct' | 'wrong' | 'dimmed'

const KEY_LABELS = ['A', 'B', 'C', 'D']

export function AnswerOption({
  label,
  index,
  state,
  disabled,
  onSelect,
}: {
  label: string
  index: number
  state: AnswerState
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-label={`Antwort ${KEY_LABELS[index]}: ${label}`}
      className={cn(
        'group flex w-full items-center gap-3 rounded-[var(--radius-card-value)] border px-4 py-4 text-left',
        'transition-[background-color,border-color,color,transform,box-shadow] duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        state === 'idle' &&
          'border-border bg-card text-foreground shadow-[0_4px_14px_-8px_rgb(23_28_44_/_0.4)] enabled:hover:-translate-y-px enabled:hover:shadow-[0_12px_26px_-14px_rgb(23_28_44_/_0.6)]',
        state === 'pending' &&
          'border-border bg-muted text-foreground translate-y-px shadow-[0_2px_8px_-6px_rgb(23_28_44_/_0.4)]',
        state === 'correct' && 'border-[#3E9C63] bg-[#EAF6ED] text-[#1E5B37] animate-[pop_0.28s_ease-out]',
        state === 'wrong' && 'border-[#C93B28] bg-[#FCEDEA] text-[#8E2A1F] animate-[nudge_0.4s_ease-in-out]',
        state === 'dimmed' && 'border-border/50 bg-[#FAF8F4] text-[#8A91A3]'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-lg text-[13px] font-bold',
          state === 'idle' && 'bg-muted text-muted-foreground',
          state === 'pending' && 'bg-muted-foreground/30 text-muted-foreground',
          state === 'correct' && 'bg-[#3E9C63] text-white',
          state === 'wrong' && 'bg-[#C93B28] text-white',
          state === 'dimmed' && 'bg-transparent text-transparent'
        )}
      >
        {KEY_LABELS[index]}
      </span>

      <span className="flex-1 text-[17px] font-semibold tracking-[-0.01em]">{label}</span>

      {state === 'correct' && <span aria-hidden className="text-[18px] font-bold text-[#3E9C63]">✓</span>}
      {state === 'wrong' && <span aria-hidden className="text-[18px] font-bold text-[#C93B28]">✕</span>}
    </button>
  )
}
