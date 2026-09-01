'use server'

import { createClient } from '@/lib/supabase/server'
import { runSubmissionSchema } from '@/lib/validation/quiz'

export type PersonalBest = {
  streak: number
  durationMs: number
}

export type SaveRunResult =
  | { status: 'saved'; isPersonalBest: boolean }
  /** spec.md EC-3 — the caller keeps the result on screen and offers a retry. */
  | { status: 'failed' }
  /** spec.md AC-12 — arithmetically impossible, so it is not stored. */
  | { status: 'rejected' }
  /** spec.md EC-7 — session gone; the round is discarded, never reassigned. */
  | { status: 'unauthenticated' }

/**
 * spec.md AC-8 — the player's best round: highest streak, shortest time on a
 * tie. Reads only the caller's own rows; the table's select policy does not
 * allow anything else (migration 0002).
 */
export async function getPersonalBest(excludeRoundId?: string): Promise<PersonalBest | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  let query = supabase
    .from('runs')
    .select('streak, duration_ms')
    .eq('profile_id', user.id)

  // Used when saving: the round being stored must not compete with itself, or a
  // repeated submission of a record round would report "no record" the second
  // time (spec.md EC-4).
  if (excludeRoundId) query = query.neq('client_round_id', excludeRoundId)

  const { data } = await query
    .order('streak', { ascending: false })
    .order('duration_ms', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return { streak: data.streak, durationMs: data.duration_ms }
}

/**
 * spec.md AC-11, AC-12, AC-14 — stores one finished round.
 *
 * The row is always written for the session's own profile; a profile id from
 * the caller is never trusted, and the table's insert policy rejects one anyway.
 * Submitting the same clientRoundId twice does not create a second row and
 * still reports success (spec.md EC-4) — the uniqueness is enforced by the
 * database, so it holds even for two requests arriving at once.
 */
export async function saveRun(submission: unknown): Promise<SaveRunResult> {
  const parsed = runSubmissionSchema.safeParse(submission)
  if (!parsed.success) return { status: 'rejected' }

  const { streak, durationMs, clientRoundId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'unauthenticated' }

  // "Is this a new record?" compares against every other round of this player —
  // excluding this one, so a repeated submission answers the same as the first.
  const previousBest = await getPersonalBest(clientRoundId)

  const { error } = await supabase.from('runs').insert({
    profile_id: user.id,
    streak,
    duration_ms: durationMs,
    client_round_id: clientRoundId,
  })

  if (error) {
    // 23505 = unique violation: this round was already stored, which is exactly
    // what EC-4 asks for. Anything else is a real failure (EC-3).
    if (error.code !== '23505') return { status: 'failed' }
  }

  const isPersonalBest =
    !previousBest ||
    streak > previousBest.streak ||
    (streak === previousBest.streak && durationMs < previousBest.durationMs)

  return { status: 'saved', isPersonalBest }
}
