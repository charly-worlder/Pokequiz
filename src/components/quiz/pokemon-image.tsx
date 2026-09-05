'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * spec.md AC-20 — `next/image` with the sprite host allow-listed means the
 * browser requests /_next/image on our own domain; the server fetches from the
 * CDN. No player IP reaches a non-EU service, and the optimizer's cache serves
 * AC-31.
 *
 * spec.md AC-25 — a skeleton the size of the image, so the layout does not jump
 * when the picture arrives. Never a bare spinner.
 *
 * By the time this renders, quiz-screen has already preloaded the picture
 * through `ImageProbe` — so `src` is known to load, and the swap is a cache hit.
 */
export function PokemonImage({
  src,
  alt,
  onReady,
}: {
  src: string
  alt: string
  /** spec.md AC-2 — the clock starts the moment the picture is actually visible. */
  onReady?: () => void
}) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[280px]">
      {!loaded && <Skeleton className="absolute inset-0 rounded-[var(--radius-card-value)]" />}
      <Image
        key={src}
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 70vw, 280px"
        priority
        onLoad={() => {
          setLoaded(true)
          onReady?.()
        }}
        className="object-contain"
      />
    </div>
  )
}

/**
 * spec.md AC-15 — a picture that is not loadable within this counts as failed.
 * The same 5 seconds the server gives the question assembly (`client.ts`), so a
 * slow round has one budget rather than two.
 */
const PROBE_TIMEOUT_MS = 5_000

/**
 * Loads the next question's picture while the current one is on screen
 * (spec.md AC-10), and is how a broken address is discovered before the player
 * ever sees it (spec.md EC-6).
 *
 * It renders through `next/image` with the same `sizes` as the visible picture,
 * so the browser requests the exact same optimized URL and the swap is a cache
 * hit. Loading the raw CDN address directly would be faster to write and would
 * break AC-20 — that request would go from the browser to a non-EU host.
 *
 * Kept at the real size but transparent and out of the layout: a zero-sized or
 * `display:none` container would change or suppress the request.
 *
 * **Why the timer (BUG-15, qa-report.md 2026-09-04).** `onLoad` and `onError`
 * cover a picture that arrives and one that is refused. They do not cover one
 * that never answers at all — a stalled connection, a hanging upstream. Without
 * a deadline the round then sat on „Runde wird vorbereitet …" forever: no error
 * card, no way out, and the streak lost on reload. That is the very state AC-16
 * exists to prevent, and it is what made the E2E suite unreliable under load.
 *
 * The retry is AC-15's „einmal automatisch und für den Nutzer unsichtbar neu
 * geladen", mirrored from the server's `withTimeoutAndOneRetry`.
 */
export function ImageProbe(props: { src: string; onOk: () => void; onFail: () => void }) {
  // Keyed on the address, so a new picture gets a genuinely fresh attempt count
  // instead of one that has to be reset. Resetting state from inside an effect
  // is the thing React (and this project's lint rules) rightly warn about.
  return <ProbeAttempts key={props.src} {...props} />
}

function ProbeAttempts({
  src,
  onOk,
  onFail,
}: {
  src: string
  onOk: () => void
  onFail: () => void
}) {
  const [attempt, setAttempt] = useState(0)

  /**
   * `onFail` is re-created by the parent whenever the streak changes. Reading it
   * through a ref keeps that out of the timer's dependencies — otherwise every
   * correct answer would restart the deadline, and a picture could stall for the
   * whole round without ever timing out.
   */
  const onFailRef = useRef(onFail)
  useEffect(() => {
    onFailRef.current = onFail
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (attempt === 0) setAttempt(1)
      else onFailRef.current()
    }, PROBE_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [attempt])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 -z-50 aspect-square w-[280px] opacity-0"
    >
      <Image
        // The attempt is the key, never part of `src`: a changed key remounts the
        // element and makes the browser request again, while the address stays
        // byte-identical — so the retry is still a cache hit for AC-31 and still
        // goes to our own domain for AC-20. A cache-buster in the URL would
        // break both.
        key={attempt}
        src={src}
        alt=""
        fill
        sizes="(max-width: 640px) 70vw, 280px"
        onLoad={onOk}
        onError={onFail}
        className="object-contain"
      />
    </div>
  )
}
