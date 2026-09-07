import { z } from 'zod'

// design.md → Data Model: the pool is Pokémon 1–386 (generations 1–3).
export const POOL_START = 1
export const POOL_END = 386
export const POOL_SIZE = POOL_END - POOL_START + 1

export const pokemonIdSchema = z.number().int().min(POOL_START).max(POOL_END)

/**
 * Everything the browser is allowed to say about a question (spec.md AC-32,
 * AC-33): which question it is answering, and which of the four options it
 * picked. Nothing else — not the streak, not the elapsed time, not the Pokémon.
 *
 * Both are Server Action arguments, so they are public endpoints that anyone
 * with a session can call with anything at all; they are validated here at the
 * boundary, as `.claude/rules/security.md` asks.
 */
export const questionTokenSchema = z.uuid()
export const choiceIndexSchema = z.number().int().min(0).max(3)

export const answerSubmissionSchema = z.object({
  token: questionTokenSchema,
  choice: choiceIndexSchema,
})

export type AnswerSubmission = z.infer<typeof answerSubmissionSchema>

/*
 * Gone on 2026-09-06, with the move to a server-authoritative round:
 *
 * - `seenIdsSchema` — the browser no longer sends the exclusion list. The server
 *   keeps it in `active_runs.seen_ids`, because a client that chooses which
 *   Pokémon are "already used" also chooses which one comes next.
 *
 * - `runSubmissionSchema` and `MIN_MS_PER_ANSWER` — there is no submission left
 *   to validate (spec.md AC-12). The streak and the duration come from the
 *   server's own bookkeeping, and the "at least 500ms per answer" rule was
 *   replaced by an actual measurement (AC-34), not merely deleted: it could only
 *   ever reject a genuinely fast round now.
 */
