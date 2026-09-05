'use server'

import { createClient } from '@/lib/supabase/server'
import {
  fetchGermanName,
  fetchGermanNames,
  spriteUrlFor,
  withTimeoutAndOneRetry,
} from '@/lib/pokeapi/client'
import { POOL_END, POOL_START, POOL_SIZE } from '@/lib/validation/quiz'

export type Question = {
  pokemonId: number
  imageUrl: string
  /** Four German names, already shuffled (spec.md AC-3). */
  options: string[]
  /** Index into `options` — the browser needs it for instant feedback (AC-4, AC-6). */
  correctIndex: number
}

export type QuestionResult =
  | { status: 'ok'; question: Question }
  /** spec.md EC-2 — all 386 answered correctly. */
  | { status: 'pool-empty' }
  /** spec.md AC-16 — could not be loaded; the caller shows the error card. */
  | { status: 'unavailable' }
  /** spec.md EC-7 — session gone mid-round. */
  | { status: 'unauthenticated' }

function randomIdExcluding(excluded: Set<number>): number | null {
  const available: number[] = []
  for (let id = POOL_START; id <= POOL_END; id++) {
    if (!excluded.has(id)) available.push(id)
  }
  if (available.length === 0) return null
  return available[Math.floor(Math.random() * available.length)]
}

/** Three distractors, all different from each other and from the answer (AC-3). */
function drawDistractors(answerId: number): number[] {
  const picked = new Set<number>([answerId])
  while (picked.size < 4) {
    picked.add(Math.floor(Math.random() * POOL_SIZE) + POOL_START)
  }
  picked.delete(answerId)
  return [...picked]
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Assembles one question server-side (design.md → Behaviors & Access).
 *
 * `seenIds` are the Pokémon already used as the answer in this round, so none
 * repeats (spec.md AC-5). A Pokémon whose German name is missing is dropped and
 * another drawn, without the browser noticing (spec.md EC-5).
 */
export async function getNextQuestion(seenIds: number[]): Promise<QuestionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'unauthenticated' }

  const excluded = new Set(seenIds.filter((id) => Number.isInteger(id)))
  if (excluded.size >= POOL_SIZE) return { status: 'pool-empty' }

  const built = await withTimeoutAndOneRetry(async (signal) => {
    // Up to three draws inside one attempt: a missing German name is a property
    // of that Pokémon, so drawing again is the fix (EC-5). This bound is not the
    // discard limit from EC-10 — that one counts questions the *browser*
    // rejected because the image would not load.
    for (let draw = 0; draw < 3; draw++) {
      const answerId = randomIdExcluding(excluded)
      if (answerId === null) return { poolEmpty: true as const }

      const answerName = await fetchGermanName(answerId, signal)
      if (!answerName) {
        excluded.add(answerId)
        continue
      }

      const distractorNames = await fetchGermanNames(drawDistractors(answerId), signal)
      if (distractorNames.some((name) => !name)) continue

      const options = shuffle([answerName, ...(distractorNames as string[])])
      return {
        question: {
          pokemonId: answerId,
          imageUrl: spriteUrlFor(answerId),
          options,
          correctIndex: options.indexOf(answerName),
        },
      }
    }
    return null
  })

  if (!built) return { status: 'unavailable' }
  if ('poolEmpty' in built) return { status: 'pool-empty' }
  return { status: 'ok', question: built.question }
}
