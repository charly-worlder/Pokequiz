import { z } from 'zod'

// design.md → Data Model: the pool is Pokémon 1–386 (generations 1–3).
export const POOL_START = 1
export const POOL_END = 386
export const POOL_SIZE = POOL_END - POOL_START + 1

// spec.md AC-12: the lower bound on how fast a round can plausibly be played.
// This is a shape check, not a truth check — see design.md → Technical Decisions.
export const MIN_MS_PER_ANSWER = 500

export const pokemonIdSchema = z.number().int().min(POOL_START).max(POOL_END)

/**
 * spec.md AC-12 — a submitted round is accepted only if it is arithmetically
 * possible. The same three bounds exist as CHECK constraints on the table
 * (migration 0002); this is the first of the two independent checks that
 * .claude/rules/security.md asks for, not the only one.
 */
export const runSubmissionSchema = z
  .object({
    streak: z.number().int().min(0).max(POOL_SIZE),
    durationMs: z.number().int().min(0),
    clientRoundId: z.uuid(),
  })
  .refine((run) => run.durationMs >= run.streak * MIN_MS_PER_ANSWER, {
    message: 'Die Dauer passt nicht zur Anzahl der beantworteten Fragen',
    path: ['durationMs'],
  })

export type RunSubmission = z.infer<typeof runSubmissionSchema>
