import { cn } from '@/lib/utils'

/**
 * The Pokéball motif is drawn in CSS — gradient, centre line, circle — and is
 * deliberately not an official logo. docs/design-system.md: no official Pokémon
 * logos, lettering or artwork; this is a fan quiz and has to stay visibly so.
 */
export function BallMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-block size-7 shrink-0 rounded-full',
        'bg-[linear-gradient(180deg,hsl(var(--primary))_0_49%,hsl(var(--foreground))_49%_53%,hsl(var(--card))_53%_100%)]',
        'shadow-[0_4px_14px_-8px_rgb(23_28_44_/_0.4)]',
        className
      )}
    >
      <span className="absolute left-1/2 top-1/2 size-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-card" />
    </span>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BallMark />
      <span className="text-[17px] font-extrabold tracking-[-0.02em] text-foreground">
        Pokémon{' '}
        <span className="font-extrabold tracking-[0.14em] text-[13px] text-muted-foreground">
          QUIZ
        </span>
      </span>
    </span>
  )
}
