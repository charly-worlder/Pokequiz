'use server'

import { createClient } from '@/lib/supabase/server'
import { drawQuestion } from './draw-question'
import { questionTokenSchema } from '@/lib/validation/quiz'
import { z } from 'zod'
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
  /**
   * spec.md AC-36, EC-15 — der Aufrufer meint eine Runde, die nicht mehr läuft:
   * ein veralteter Tab, dessen Runde anderswo verdrängt wurde.
   *
   * **Warum das eine eigene Antwort braucht (BUG-130).** Bis zum 2026-09-07
   * nannte der Aufrufer seine Runde gar nicht; der Server arbeitete auf „was
   * gerade läuft". Ein veralteter Tab tauschte damit die vorbereitete Frage der
   * **laufenden** Runde aus und verkürzte deren Ziehungsvorrat — und im Fall
   * eines erschöpften Vorrats beendete er sie sogar. Dieselbe Lücke, die `0012`
   * beim Rundenende geschlossen hat.
   */
  | { status: 'stale' }
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
export async function replacePreparedQuestionAction(roundId: unknown): Promise<PrepareResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'unauthenticated' }

  const parsed = z.uuid().safeParse(roundId)
  if (!parsed.success) return { status: 'stale' }

  // Erst prüfen, wessen Runde gemeint ist, dann verwerfen — sonst hätte der
  // veraltete Tab die vorbereitete Frage der laufenden Runde schon gelöscht,
  // bevor `prepareNext` ihn abweist (BUG-130).
  const snapshot = await getRoundSnapshot(user.id)
  if (!snapshot) return { status: 'unavailable' }
  if (snapshot.roundId !== parsed.data) return { status: 'stale' }

  await discardPreparedQuestion(user.id, parsed.data)
  return prepareNext(user.id, parsed.data)
}

/**
 * Zieht die nächste vorbereitete Frage für eine laufende Runde. Kein Endpunkt —
 * `'use server'` verlangt, dass jeder Export eine Action ist, deshalb ist diese
 * Hilfe hier nicht exportiert.
 */
async function prepareNext(profileId: string, roundId: string): Promise<PrepareResult> {
  const snapshot = await getRoundSnapshot(profileId)
  if (!snapshot) return { status: 'unavailable' }

  // **Der Riegel aus BUG-130.** Alles darunter verändert die laufende Runde —
  // es zieht Nummern aus ihrem Vorrat, tauscht ihre vorbereitete Frage aus und
  // kann sie im `pool-empty`-Zweig sogar beenden. Wer das auslöst, muss dieselbe
  // Runde meinen, die läuft; ein veralteter Tab wird hier abgewiesen, so wie
  // seine Antworten es seit jeher werden (AC-36, EC-15).
  if (snapshot.roundId !== roundId) return { status: 'stale' }

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

    // `roundId` statt `snapshot.roundId`: Beide sind hier nachweislich gleich —
    // der Riegel oben hat es geprüft —, aber die Kennung des **Aufrufers** zu
    // übergeben ist das, was den Schutz aus `0012` trägt. Würde hier die
    // serverseitig abgeleitete stehen, käme sie zwangsläufig immer durch, und
    // `finish_round` hätte an dieser Stelle nichts mehr zu prüfen (BUG-130).
    const finished = await finishRound(profileId, roundId)
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
    roundId,
    { answerId: drawn.answerId, correctIndex: drawn.correctIndex },
    drawn.alsoSeen
  )
  // Kein Token heißt: Die Runde ist zwischen dem Riegel oben und hier verdrängt
  // worden. Selten, aber möglich — und dann ist der Aufrufer veraltet, nicht die
  // Quelle kaputt.
  if (!token) return { status: 'stale' }

  return { status: 'ok', prepared: { token, options: drawn.options } }
}

/**
 * spec.md AC-10 — nach einer richtigen Antwort die übernächste Frage vorbereiten.
 * Getrennt von `answerAction`, damit das Urteil den Spieler sofort erreicht und
 * das Ziehen der nächsten Frage nicht darauf wartet.
 */
export async function prepareNextQuestionAction(roundId: unknown): Promise<PrepareResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'unauthenticated' }

  const parsed = z.uuid().safeParse(roundId)
  if (!parsed.success) return { status: 'stale' }

  return prepareNext(user.id, parsed.data)
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
