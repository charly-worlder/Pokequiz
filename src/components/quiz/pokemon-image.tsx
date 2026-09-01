'use client'

import Image from 'next/image'
import { useState } from 'react'
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
 * By the time this renders, quiz-screen has already preloaded and, if needed,
 * repaired the address (EC-11) — so `src` is known to load.
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
 * Loads the next question's picture while the current one is on screen
 * (spec.md AC-10), and is how a broken address is discovered before the player
 * ever sees it (spec.md EC-11).
 *
 * It renders through `next/image` with the same `sizes` as the visible picture,
 * so the browser requests the exact same optimized URL and the swap is a cache
 * hit. Loading the raw CDN address directly would be faster to write and would
 * break AC-20 — that request would go from the browser to a non-EU host.
 *
 * Kept at the real size but transparent and out of the layout: a zero-sized or
 * `display:none` container would change or suppress the request.
 */
export function ImageProbe({
  src,
  onOk,
  onFail,
}: {
  src: string
  onOk: () => void
  onFail: () => void
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 -z-50 aspect-square w-[280px] opacity-0"
    >
      <Image
        key={src}
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
