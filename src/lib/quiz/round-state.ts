import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Zugang zum serverseitig geführten Rundenzustand (spec.md AC-33 bis AC-36,
 * AC-39; design.md → Behaviors & Access).
 *
 * Warum über den Administrationszugang und nicht über die Sitzung des Nutzers:
 * `active_runs` hat Row Level Security **ohne jede Policy** (Migration 0007).
 * Das ist Absicht — die Zeile enthält die Lösung der aktuellen Frage, und eine
 * „der Eigentümer liest seine eigene Zeile"-Policy würde dem Spieler genau das
 * geben, was AC-32 ihm vorenthält. Erreichbar ist die Tabelle deshalb nur über
 * die Funktionen aus Migration 0009, und die sind allein für `service_role`
 * ausführbar.
 *
 * **Die Profil-ID kommt in jeder Funktion hier von außen — sie muss aus der
 * Sitzung stammen und darf nie ein Aufrufparameter des Browsers sein** (AC-14).
 * Die Server Actions in `question-action.ts` und `run-actions.ts` sind die
 * einzigen Aufrufer und lesen sie über `getUser()`.
 */

export type RoundSnapshot = {
  roundId: string
  seenIds: number[]
  streak: number
  hasCurrent: boolean
  hasPrepared: boolean
}

export type AnswerVerdict = {
  /** false = das Token gehört zu keiner offenen Frage: zweiter Klick (EC-1), verwaister Tab (EC-15). */
  matched: boolean
  correct: boolean
  /** Welche Option richtig war — erst *nach* der Antwort (AC-6). */
  correctIndex: number | null
  streak: number
  finished: boolean
  /** Nur bei beendeter Runde gesetzt; die servergemessene Gesamtzeit (AC-34). */
  durationMs: number | null
  roundId: string | null
  /** Die nachgerückte Frage, falls eine vorbereitet war (AC-10). */
  nextToken: string | null
}

export type FinishedRound = {
  roundId: string | null
  streak: number | null
  durationMs: number | null
  /** false = es gab keinen Rundenzustand mehr; ein zweiter Aufruf legt nichts an (EC-4). */
  written: boolean
}

/** Wirft, statt still `null` zu liefern: Ein Fehler hier ist kein leerer Zustand. */
function unwrap<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what} fehlgeschlagen: ${result.error.message}`)
  return result.data as T
}

export async function getRoundSnapshot(profileId: string): Promise<RoundSnapshot | null> {
  const admin = createAdminClient()
  const rows = unwrap(await admin.rpc('get_round_snapshot', { p_profile: profileId }), 'Rundenstand lesen')
  const row = rows?.[0]
  if (!row) return null
  return {
    roundId: row.round_id,
    seenIds: row.seen_ids ?? [],
    streak: row.streak,
    hasCurrent: row.has_current,
    hasPrepared: row.has_prepared,
  }
}

export async function startRound(
  profileId: string,
  current: { answerId: number; correctIndex: number },
  prepared: { answerId: number; correctIndex: number },
  /** Beim Ziehen verworfene Nummern (EC-5) — sie duerfen nicht erneut drankommen. */
  alsoSeen: number[] = []
): Promise<{ roundId: string; currentToken: string; preparedToken: string }> {
  const admin = createAdminClient()
  const rows = unwrap(
    await admin.rpc('start_round', {
      p_profile: profileId,
      p_answer_id: current.answerId,
      p_correct_index: current.correctIndex,
      p_prepared_answer_id: prepared.answerId,
      p_prepared_correct_index: prepared.correctIndex,
      p_also_seen: alsoSeen,
    }),
    'Runde starten'
  )
  const row = rows[0]
  return { roundId: row.round_id, currentToken: row.current_token, preparedToken: row.prepared_token }
}

/**
 * `alsoSeen` sind Nummern, die beim Ziehen verworfen wurden, weil ihnen der
 * deutsche Name fehlte (EC-5). Sie dürfen nicht erneut gezogen werden, obwohl sie
 * nie eine Frage geworden sind.
 */
export async function setPreparedQuestion(
  profileId: string,
  /**
   * Die Runde, die der Aufrufer meint. Passt sie nicht zur laufenden, geschieht
   * nichts und es kommt `null` zurück — ein veralteter Tab kann die vorbereitete
   * Frage einer fremden Runde nicht mehr austauschen (BUG-130).
   */
  roundId: string,
  question: { answerId: number; correctIndex: number },
  alsoSeen: number[] = []
): Promise<string | null> {
  const admin = createAdminClient()
  return unwrap(
    await admin.rpc('set_prepared_question', {
      p_profile: profileId,
      p_round_id: roundId,
      p_answer_id: question.answerId,
      p_correct_index: question.correctIndex,
      p_also_seen: alsoSeen,
    }),
    'Frage vorbereiten'
  )
}

/**
 * Macht die vorbereitete Frage zur aktuellen — nur, wenn gerade keine offen ist.
 * Der Ausgabezeitpunkt und damit die Messung beginnen hier (AC-34).
 */
export async function promotePreparedQuestion(profileId: string, token: string): Promise<boolean> {
  const admin = createAdminClient()
  return unwrap(
    await admin.rpc('promote_prepared_question', { p_profile: profileId, p_token: token }),
    'Frage befördern'
  )
}

/**
 * Verwirft nur die vorbereitete Frage; die aktuelle bleibt unangetastet (EC-12).
 * Wie beim Vorbereiten muss die Runde die genannte sein (BUG-130).
 */
export async function discardPreparedQuestion(profileId: string, roundId: string): Promise<void> {
  const admin = createAdminClient()
  unwrap(
    await admin.rpc('discard_prepared_question', { p_profile: profileId, p_round_id: roundId }),
    'Frage verwerfen'
  )
}

export async function submitAnswer(
  profileId: string,
  token: string,
  choice: number
): Promise<AnswerVerdict> {
  const admin = createAdminClient()
  const rows = unwrap(
    await admin.rpc('submit_answer', { p_profile: profileId, p_token: token, p_choice: choice }),
    'Antwort prüfen'
  )
  const row = rows[0]
  return {
    matched: row.matched,
    correct: row.correct,
    correctIndex: row.correct_index,
    streak: row.streak,
    finished: row.finished,
    durationMs: row.duration_ms,
    roundId: row.round_id,
    nextToken: row.next_token,
  }
}

/**
 * Beendet **genau die genannte** Runde. Passt die Kennung nicht zur laufenden,
 * geschieht nichts und `written` ist false — ein veralteter Tab kann damit die
 * Runde eines anderen nicht mehr beenden (BUG-120).
 */
export async function finishRound(profileId: string, roundId: string): Promise<FinishedRound> {
  const admin = createAdminClient()
  const rows = unwrap(
    await admin.rpc('finish_round', { p_profile: profileId, p_round_id: roundId }),
    'Runde beenden'
  )
  const row = rows[0]
  return {
    roundId: row.round_id,
    streak: row.streak,
    durationMs: row.duration_ms,
    written: row.written,
  }
}

/**
 * Die Pokémon-Nummer hinter einem Frage-Token — nur für die laufende Runde
 * dieses Nutzers, aktuelle oder vorbereitete Frage. Alles andere ergibt `null`,
 * und die Bild-Route antwortet darauf mit 404 (AC-32).
 */
export async function resolveQuestionImage(profileId: string, token: string): Promise<number | null> {
  const admin = createAdminClient()
  return unwrap(
    await admin.rpc('resolve_question_image', { p_profile: profileId, p_token: token }),
    'Bild-Token auflösen'
  )
}
