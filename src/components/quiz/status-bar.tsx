/** Seconds → m:ss. spec.md AC-7 and the running clock in AC-2. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Streak and clock during a round. Both use tabular figures so the layout does
 * not jump on every tick (docs/design-system.md → Typografie, spec.md AC-25).
 */
export function StatusBar({ streak, elapsedMs }: { streak: number; elapsedMs: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Serie
        </p>
        <p className="tabular text-[26px] font-bold leading-tight tracking-[-0.02em] text-primary">
          {streak}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Zeit
        </p>
        <p
          className="tabular text-[26px] font-bold leading-tight tracking-[-0.02em] text-foreground"
          // The clock changes every 100ms; announcing each tick would flood a
          // screen reader. The final time is announced on the result screen.
          aria-live="off"
        >
          {formatDuration(elapsedMs)}
        </p>
      </div>
    </div>
  )
}
