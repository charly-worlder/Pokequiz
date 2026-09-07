'use server'

import { createClient } from '@/lib/supabase/server'
import { answerSubmissionSchema } from '@/lib/validation/quiz'
import { finishRound, submitAnswer } from './round-state'
import { z } from 'zod'

export type PersonalBest = {
  streak: number
  durationMs: number
}

export type RoundResult = {
  streak: number
  /** Die servergemessene Zeit (spec.md AC-34) — nicht der Stand der Anzeigeuhr. */
  durationMs: number
  isPersonalBest: boolean
}

export type AnswerResult =
  | {
      status: 'answered'
      correct: boolean
      /** Erst jetzt, mit dem Urteil, erfährt der Browser die Lösung (AC-6). */
      correctIndex: number
      streak: number
      /** Gesetzt, sobald die Runde vorbei ist (falsch geantwortet oder Pool leer). */
      result: RoundResult | null
    }
  /**
   * spec.md EC-1, EC-15 — das Token gehört zu keiner offenen Frage: zweiter
   * Klick, verwaister Tab, oder die Runde lief anderswo weiter.
   */
  | { status: 'stale' }
  /** spec.md AC-12 — nichts, was unser eigener Client schicken würde. */
  | { status: 'rejected' }
  /** spec.md EC-7 — Sitzung weg. */
  | { status: 'unauthenticated' }

export type EndRoundResult =
  | { status: 'ended'; result: RoundResult }
  /** Es gab keinen Rundenzustand mehr — ein zweiter Aufruf legt nichts an (EC-4). */
  | { status: 'gone' }
  | { status: 'unauthenticated' }

/**
 * spec.md AC-8 — der beste eigene Lauf: höchste Serie, bei Gleichstand kürzeste
 * Zeit. Liest ausschließlich eigene Runden; die Lesepolicy der Tabelle lässt
 * nichts anderes zu (Migration 0002).
 */
export async function getPersonalBest(excludeRoundId?: unknown): Promise<PersonalBest | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // An der Grenze geprüft wie jedes Argument von außen: Diese Datei ist
  // `'use server'`, also ist jeder Export ein öffentlicher Endpunkt (BUG-12).
  const parsedExclude = z.uuid().optional().safeParse(excludeRoundId ?? undefined)
  if (!parsedExclude.success) return null
  const excludeId = parsedExclude.data

  let query = supabase.from('runs').select('streak, duration_ms').eq('profile_id', user.id)

  // Beim Speichern gebraucht: Die gerade geschriebene Runde darf nicht gegen
  // sich selbst antreten, sonst meldete ein Rekord beim zweiten Aufruf „kein
  // Rekord" (spec.md EC-4).
  if (excludeId) query = query.neq('round_id', excludeId)

  const { data } = await query
    .order('streak', { ascending: false })
    .order('duration_ms', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return { streak: data.streak, durationMs: data.duration_ms }
}

/**
 * spec.md EC-3 — das Ergebnis einer Runde nachlesen.
 *
 * Gebraucht, wenn die Antwort des Servers unterwegs verlorengeht: Der Server hat
 * die Zeile dann geschrieben und den Rundenzustand gelöscht, der Browser hat
 * aber kein Ergebnis. Mit der Runden-Kennung, die er beim Start bekommen hat,
 * holt er es nach, statt den Spieler ohne Ergebnis stehenzulassen.
 *
 * Liest über die Sitzung des Nutzers, nicht über den Administrationszugang — die
 * Lesepolicy aus Migration 0002 lässt ohnehin nur eigene Runden zu (AC-14).
 */
export async function getRunByRoundIdAction(roundId: unknown): Promise<RoundResult | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const parsed = z.uuid().safeParse(roundId)
  if (!parsed.success) return null

  const { data } = await supabase
    .from('runs')
    .select('streak, duration_ms')
    .eq('profile_id', user.id)
    .eq('round_id', parsed.data)
    .maybeSingle()

  if (!data) return null

  const previousBest = await getPersonalBest(parsed.data)
  return {
    streak: data.streak,
    durationMs: data.duration_ms,
    isPersonalBest: isBetterThan(data.streak, data.duration_ms, previousBest),
  }
}

function isBetterThan(streak: number, durationMs: number, previous: PersonalBest | null): boolean {
  if (!previous) return true
  if (streak > previous.streak) return true
  return streak === previous.streak && durationMs < previous.durationMs
}

/**
 * spec.md AC-33, AC-34, AC-35 — eine Antwort abgeben.
 *
 * Der Browser schickt das Frage-Token und die gewählte Position, sonst nichts.
 * Geurteilt, gezählt und gemessen wird in der Datenbank (Migration 0009); diese
 * Action übersetzt nur und ergänzt bei Rundenende den Bestleistungs-Vergleich.
 */
export async function answerAction(submission: unknown): Promise<AnswerResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'unauthenticated' }

  const parsed = answerSubmissionSchema.safeParse(submission)
  if (!parsed.success) return { status: 'rejected' }

  const verdict = await submitAnswer(user.id, parsed.data.token, parsed.data.choice)
  if (!verdict.matched) return { status: 'stale' }

  let result: RoundResult | null = null
  if (verdict.finished && verdict.durationMs !== null && verdict.roundId) {
    const previousBest = await getPersonalBest(verdict.roundId)
    result = {
      streak: verdict.streak,
      durationMs: verdict.durationMs,
      isPersonalBest: isBetterThan(verdict.streak, verdict.durationMs, previousBest),
    }
  }

  return {
    status: 'answered',
    correct: verdict.correct,
    correctIndex: verdict.correctIndex as number,
    streak: verdict.streak,
    result,
  }
}

/**
 * spec.md AC-18 — „Runde beenden" aus der Fehlerkarte heraus. Die bis dahin
 * erreichte Serie und die gemessene Zeit werden normal gewertet und gespeichert.
 */
export async function endRoundAction(): Promise<EndRoundResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'unauthenticated' }

  const finished = await finishRound(user.id)
  if (!finished.written || finished.streak === null || finished.durationMs === null) {
    return { status: 'gone' }
  }

  const previousBest = await getPersonalBest(finished.roundId ?? undefined)
  return {
    status: 'ended',
    result: {
      streak: finished.streak,
      durationMs: finished.durationMs,
      isPersonalBest: isBetterThan(finished.streak, finished.durationMs, previousBest),
    },
  }
}
