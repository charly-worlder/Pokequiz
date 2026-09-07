'use server'

import { createClient } from '@/lib/supabase/server'
import { drawQuestion } from './draw-question'
import { questionTokenSchema } from '@/lib/validation/quiz'
import {
  discardPreparedQuestion,
  finishRound,
  promotePreparedQuestion,
  getRoundSnapshot,
  setPreparedQuestion,
  startRound,
} from './round-state'
import { getPersonalBest, type RoundResult } from './run-actions'
import { isBetterThan } from './personal-best'

/**
 * Was der Browser von einer Frage erfährt: vier Namen und ein Token — nicht die
 * Pokémon-Nummer und nicht, welche Option richtig ist (spec.md AC-32).
 */
export type ClientQuestion = {
  token: string
  options: string[]
}

export type StartRoundResult =
  | {
      status: 'ok'
      /** Für den Fall, dass eine Antwort unterwegs verlorengeht (EC-3). */
      roundId: string
      current: ClientQuestion
      prepared: ClientQuestion
    }
  /** spec.md AC-16 — nicht ladbar; der Aufrufer zeigt die Fehlerkarte. */
  | { status: 'unavailable' }
  /** spec.md EC-7 — keine gültige Sitzung. */
  | { status: 'unauthenticated' }

export type PrepareResult =
  | { status: 'ok'; prepared: ClientQuestion }
  /**
   * spec.md AC-35, EC-2 — der Ziehungsvorrat ist erschöpft.
   *
   * Steht dabei keine Frage mehr offen, ist die Runde zu Ende, und **der Server**
   * hat sie bereits gewertet und geschrieben, bevor er hier antwortet; `result`
   * trägt das Ergebnis. Der Browser zeigt es nur noch an.
   *
   * Stand noch eine Frage offen, ist `result` leer: Der Spieler beantwortet sie
   * erst, und der Fall trifft danach zu.
   */
  | { status: 'pool-empty'; result: RoundResult | null }
  | { status: 'unavailable' }
  | { status: 'unauthenticated' }

/**
 * spec.md AC-2, AC-36 — startet eine Runde und ersetzt dabei eine laufende.
 *
 * Es werden gleich zwei Fragen gezogen: die erste, die der Spieler sieht, und
 * die vorbereitete zweite, deren Bild der Browser im Hintergrund lädt (AC-10).
 * Beide gehen nur als Optionen plus Token hinaus.
 */
export async function startRoundAction(): Promise<StartRoundResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'unauthenticated' }

  const first = await drawQuestion(new Set())
  if (first === null || first === 'pool-empty') return { status: 'unavailable' }

  const excluded = new Set<number>([first.answerId, ...first.alsoSeen])
  const second = await drawQuestion(excluded)
  if (second === null || second === 'pool-empty') return { status: 'unavailable' }

  const { roundId, currentToken, preparedToken } = await startRound(
    user.id,
    { answerId: first.answerId, correctIndex: first.correctIndex },
    { answerId: second.answerId, correctIndex: second.correctIndex },
    [...first.alsoSeen, ...second.alsoSeen]
  )

  return {
    status: 'ok',
    roundId,
    current: { token: currentToken, options: first.options },
    prepared: { token: preparedToken, options: second.options },
  }
}

/**
 * spec.md EC-6, EC-12 — die **vorbereitete** Frage wird verworfen und neu
 * gezogen, weil ihr Bild nicht lädt.
 *
 * Die aktuelle Frage bleibt unangetastet. Das ist der Unterschied, an dem alles
 * hängt: Könnte der Browser die angezeigte Frage verwerfen lassen, wäre „Bild
 * kaputt" ein Überspringen-Knopf für jedes Pokémon, das der Spieler nicht kennt.
 */
export async function replacePreparedQuestionAction(): Promise<PrepareResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'unauthenticated' }

  await discardPreparedQuestion(user.id)
  return prepareNext(user.id)
}

/**
 * Zieht die nächste vorbereitete Frage für eine laufende Runde. Kein Endpunkt —
 * `'use server'` verlangt, dass jeder Export eine Action ist, deshalb ist diese
 * Hilfe hier nicht exportiert.
 */
async function prepareNext(profileId: string): Promise<PrepareResult> {
  const snapshot = await getRoundSnapshot(profileId)
  if (!snapshot) return { status: 'unavailable' }

  const drawn = await drawQuestion(new Set(snapshot.seenIds))
  if (drawn === 'pool-empty') {
    // **Hier endet die Runde, nicht im Browser** (spec.md AC-35, BUG-119). Der
    // Fix für BUG-114 hatte die Wertung an einen zusätzlichen Aufruf des Clients
    // gehängt; blieb der aus — Tab geschlossen, Verbindung weg —, war das
    // Ergebnis verloren und der Zustand verfiel nach 110 Minuten.
    //
    // Nur wenn gerade keine Frage offen ist: Sonst beantwortet der Spieler die
    // laufende erst, und der Fall trifft danach zu.
    if (snapshot.hasCurrent) return { status: 'pool-empty', result: null }

    const finished = await finishRound(profileId, snapshot.roundId)
    if (!finished.written || finished.streak === null || finished.durationMs === null) {
      return { status: 'pool-empty', result: null }
    }

    const previousBest = await getPersonalBest(finished.roundId ?? undefined)
    return {
      status: 'pool-empty',
      result: {
        streak: finished.streak,
        durationMs: finished.durationMs,
        isPersonalBest: isBetterThan(finished.streak, finished.durationMs, previousBest),
      },
    }
  }
  if (drawn === null) return { status: 'unavailable' }

  const token = await setPreparedQuestion(
    profileId,
    { answerId: drawn.answerId, correctIndex: drawn.correctIndex },
    drawn.alsoSeen
  )
  if (!token) return { status: 'unavailable' }

  return { status: 'ok', prepared: { token, options: drawn.options } }
}

/**
 * spec.md AC-10 — nach einer richtigen Antwort die übernächste Frage vorbereiten.
 * Getrennt von `answerAction`, damit das Urteil den Spieler sofort erreicht und
 * das Ziehen der nächsten Frage nicht darauf wartet.
 */
export async function prepareNextQuestionAction(): Promise<PrepareResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'unauthenticated' }

  return prepareNext(user.id)
}

/**
 * spec.md AC-10, AC-34 — die vorbereitete Frage wird zur aktuellen, sobald ihr
 * Bild geladen ist und keine andere offen ist.
 *
 * Der Browser ruft das nur, wenn er auf eine Frage wartet. Steht bereits eine
 * offene Frage, tut die Datenbank nichts — eine angezeigte Frage lässt sich so
 * nicht verdrängen.
 */
export async function promoteQuestionAction(token: unknown): Promise<{ promoted: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { promoted: false }

  const parsed = questionTokenSchema.safeParse(token)
  if (!parsed.success) return { promoted: false }

  return { promoted: await promotePreparedQuestion(user.id, parsed.data) }
}
