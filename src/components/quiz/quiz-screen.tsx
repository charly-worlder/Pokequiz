'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { runClientAction } from '@/lib/actions/run-action'
import { getNextQuestion, type Question } from '@/lib/quiz/question-action'
import { saveRun, type PersonalBest } from '@/lib/quiz/run-actions'
import { POOL_SIZE } from '@/lib/validation/quiz'
import { ImageProbe } from './pokemon-image'
import { StartView } from './start-view'
import { QuestionView } from './question-view'
import { LoadErrorCard } from './load-error-card'
import { ResultView, type SaveState } from './result-view'

/**
 * The round's state machine (design.md → Component Structure). Every transition
 * lives here; the views are presentation only.
 *
 *   ready --start--> loading --question ready--> open
 *   loading --failed--> error
 *   open --correct--> (brief green) --> open        (next question, usually preloaded)
 *   open --wrong--> resolved --click--> finished
 *   open --pool empty--> finished (winner)
 *   error --retry ok--> open      error --end round--> finished
 *   finished --play again--> loading      (AC-9: one click, a new round)
 *
 * There is no path from `finished` back to `open`: a finished round is
 * immutable, exactly like its row in the database. „Nochmal spielen" does not
 * lead back to `ready` either — AC-9 promises a started round, not the start
 * screen a second time (BUG-10, qa-report.md 2026-09-04).
 */
type Phase = 'ready' | 'loading' | 'open' | 'resolved' | 'error' | 'finished'

/** spec.md EC-10 — three discarded questions in a row is a broken source, not bad luck. */
const MAX_CONSECUTIVE_DISCARDS = 3

/** How long the green stays visible before the next question replaces it (AC-4). */
const CORRECT_FEEDBACK_MS = 350

export function QuizScreen({ initialPersonalBest }: { initialPersonalBest: PersonalBest | null }) {
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('ready')
  const [personalBest, setPersonalBest] = useState(initialPersonalBest)

  const [current, setCurrent] = useState<Question | null>(null)
  /** Validated and waiting — what makes the swap free of a loading state (AC-10). */
  const [reserve, setReserve] = useState<Question | null>(null)
  /** Fetched, image not yet proven loadable. */
  const [probing, setProbing] = useState<Question | null>(null)

  const [chosenIndex, setChosenIndex] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)
  const [poolCleared, setPoolCleared] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [starting, setStarting] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('saving')
  const [isPersonalBest, setIsPersonalBest] = useState(false)
  /** The stopped time, frozen into state so the result screen never reads a ref while rendering. */
  const [finalDurationMs, setFinalDurationMs] = useState(0)

  const seenIdsRef = useRef<number[]>([])
  const discardsRef = useRef(0)
  const roundIdRef = useRef<string>('')
  const fetchingRef = useRef(false)
  /**
   * Mirrors `current` so fetchQuestion can tell "the player is waiting for this
   * question" from "this was only a prefetch". A prefetch failure must never
   * interrupt a question the player is still answering.
   */
  const hasCurrentRef = useRef(false)
  useEffect(() => {
    hasCurrentRef.current = current !== null
  }, [current])

  // --- Clock: starts with the first visible picture (AC-2), stands still while
  // the error card is up (AC-16), resumes on recovery (AC-17) ----------------
  const [elapsedMs, setElapsedMs] = useState(0)
  const accumulatedRef = useRef(0)
  const startedAtRef = useRef<number | null>(null)

  const startClock = useCallback(() => {
    if (startedAtRef.current === null) startedAtRef.current = performance.now()
  }, [])

  const pauseClock = useCallback(() => {
    if (startedAtRef.current !== null) {
      accumulatedRef.current += performance.now() - startedAtRef.current
      startedAtRef.current = null
    }
    setElapsedMs(accumulatedRef.current)
  }, [])

  useEffect(() => {
    const tick = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsedMs(accumulatedRef.current + (performance.now() - startedAtRef.current))
      }
    }, 100)
    return () => window.clearInterval(tick)
  }, [])

  /**
   * spec.md AC-19 — warn before leaving a round that has something to lose.
   * Only from a streak of 1: at 0 there is nothing to rescue, and a dialog on
   * every reload would be noise. The round itself stays unrecoverable by
   * design (docs/app-shell.md) — this saves the accidental F5, it does not
   * pretend the state survives.
   *
   * BUG-1 (qa-report.md): this was lost when the state machine was rewritten
   * during /build and shipped missing. `quiz-screen.error-states.test.tsx` is
   * its acceptance test.
   *
   * BUG-6 (qa-report.md): `loading` used to be missing here. It is the phase
   * `advance` sets when the next question was not preloaded in time, so the
   * round kept running with the full streak while the warning was off —
   * measured at ~400ms per round, 5.2% of it.
   */
  const roundInFlight =
    phase === 'open' || phase === 'resolved' || phase === 'error' || phase === 'loading'
  useEffect(() => {
    if (!roundInFlight || streak < 1) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [roundInFlight, streak])

  /** spec.md EC-7 — session gone mid-round: the round is dropped, never reassigned. */
  const bailToLogin = useCallback(() => router.push('/login'), [router])

  // --- Ending the round -----------------------------------------------------

  const finishRound = useCallback(
    async (finalStreak: number, cleared: boolean) => {
      pauseClock()
      setPoolCleared(cleared)
      setPhase('finished')
      setSaveState('saving')

      const durationMs = Math.round(accumulatedRef.current)
      setFinalDurationMs(durationMs)

      // BUG-7 (qa-report.md 2026-09-04): Ohne diesen Fänger lief ein
      // Transport-Fehler an allen folgenden Zeilen vorbei — `saveState` blieb
      // auf 'saving', der Ergebnis-Screen sah aus wie ein gespeichertes
      // Ergebnis, und die Fehler-UI aus EC-3 wurde nie erreicht. Genau der
      // Fehlertyp, den PROJ-1 mit `runAuthAction` längst behoben hatte.
      const result = await runClientAction(
        () =>
          saveRun({
            streak: finalStreak,
            durationMs,
            clientRoundId: roundIdRef.current,
          }),
        { status: 'failed' as const }
      )

      if (result.status === 'unauthenticated') return bailToLogin()
      if (result.status === 'saved') {
        setSaveState('saved')
        setIsPersonalBest(result.isPersonalBest)
        if (result.isPersonalBest) setPersonalBest({ streak: finalStreak, durationMs })
        return
      }
      // spec.md EC-3 — result stays on screen, with a retry.
      setSaveState('failed')
    },
    [pauseClock, bailToLogin]
  )

  // --- Fetching -------------------------------------------------------------

  const fetchQuestion = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      // Ein Transport-Fehler ist für den Spieler dasselbe wie eine nicht
      // lieferbare Frage: Wartet er darauf, zeigt AC-16 die Fehlerkarte
      // (BUG-7, gleiche Wurzel).
      const result = await runClientAction(() => getNextQuestion(seenIdsRef.current), {
        status: 'unavailable' as const,
      })

      if (result.status === 'unauthenticated') {
        bailToLogin()
        return
      }

      if (result.status === 'pool-empty') {
        // Only ends the round if the player is actually waiting for this
        // question; during a prefetch it just means there is nothing left to
        // preload, and answer() ends the round after the last correct answer.
        if (!hasCurrentRef.current) {
          await finishRound(streak, true)
        }
        return
      }

      if (result.status === 'unavailable') {
        // A failed *prefetch* is invisible: the player is still answering the
        // current question. The error card appears only when the next question
        // is genuinely due (spec.md AC-16).
        if (!hasCurrentRef.current) {
          pauseClock()
          setPhase('error')
        }
        return
      }

      seenIdsRef.current = [...seenIdsRef.current, result.question.pokemonId]
      setProbing(result.question)
    } catch {
      if (!hasCurrentRef.current) {
        pauseClock()
        setPhase('error')
      }
    } finally {
      fetchingRef.current = false
    }
  }, [bailToLogin, finishRound, pauseClock, streak])

  /** The probe loaded the picture — promote the question (AC-10). */
  const onProbeOk = useCallback(() => {
    const pending = probing
    if (!pending) return

    discardsRef.current = 0
    setProbing(null)

    if (hasCurrentRef.current) {
      setReserve(pending)
      return
    }

    // This question becomes the visible one. The ref is set here rather than
    // waiting for the effect, so the prefetch below is correctly treated as a
    // prefetch and not as "the player is waiting".
    hasCurrentRef.current = true
    setCurrent(pending)
    setPhase('open')

    // spec.md AC-10 — start loading the *next* question straight away, while
    // this one is still being answered. Without this the reserve is never
    // filled and every question shows a loading state.
    void fetchQuestion()
  }, [probing, fetchQuestion])

  /**
   * spec.md EC-6 → EC-10: verwerfen, und nach dreien die Quelle für gebrochen
   * erklären.
   *
   * **Hier gab es bis zum 2026-09-04 eine Reparaturstufe** (EC-11): Bei einem
   * kaputten Bild wurde die offizielle Adresse über `/pokemon/{id}` nachgeschlagen
   * und erneut versucht. Sie ist ersatzlos entfallen (BUG-16) — die offizielle
   * Adresse ist für den Pool 1–386 zeichengleich mit der konstruierten, das
   * Nachschlagen konnte also nie ein anderes Ergebnis liefern. Es kostete über
   * 100 KB je verworfener Frage und arbeitete damit gegen die Fair-Use-Zusage aus
   * AC-31. Ein nicht ladbares Bild führt jetzt unmittelbar zum Verwurf.
   */
  const onProbeFail = useCallback(() => {
    if (!probing) return

    setProbing(null)
    discardsRef.current += 1

    // spec.md EC-10 — drei Verwürfe in Folge sind eine gebrochene Quelle.
    // BUG-13 (qa-report.md 2026-09-04): Die Grenze griff nur, wenn der Spieler
    // wartete. Fiel die Bildquelle aus, *während* er noch antwortete, zog das
    // Vorladen endlos neue Fragen — je vier Namensabfragen an die PokeAPI, ohne
    // Backoff, gegen genau die Fair-Use-Zusage, um die dieses Feature sich
    // sonst bemüht (AC-31). Die Grenze stoppt die Schleife jetzt in beiden
    // Fällen; die Fehlerkarte zeigt sie nur dem, der wartet.
    if (discardsRef.current >= MAX_CONSECUTIVE_DISCARDS) {
      if (!hasCurrentRef.current) {
        pauseClock()
        setPhase('error')
      }
      return
    }
    void fetchQuestion()
  }, [probing, pauseClock, fetchQuestion])

  // --- Round lifecycle ------------------------------------------------------

  const startRound = useCallback(() => {
    if (starting) return // spec.md EC-9 — repeated clicks start exactly one round
    setStarting(true)

    seenIdsRef.current = []
    discardsRef.current = 0
    roundIdRef.current = crypto.randomUUID()
    accumulatedRef.current = 0
    startedAtRef.current = null
    hasCurrentRef.current = false

    setElapsedMs(0)
    setStreak(0)
    setChosenIndex(null)
    setCurrent(null)
    setReserve(null)
    setProbing(null)
    setPoolCleared(false)
    setIsPersonalBest(false)
    setPhase('loading')

    void fetchQuestion().finally(() => setStarting(false))
  }, [starting, fetchQuestion])

  const advance = useCallback(() => {
    setChosenIndex(null)
    if (reserve) {
      setCurrent(reserve)
      setReserve(null)
      setPhase('open')
      void fetchQuestion()
      return
    }
    // Nothing preloaded — the player waits, so a failure now is visible.
    hasCurrentRef.current = false
    setCurrent(null)
    // Das Vorladen kann an der Verwurfsgrenze stehengeblieben sein, während der
    // Spieler noch antwortete (BUG-13). Jetzt wartet er — das ist der Fall aus
    // EC-10, also die Fehlerkarte statt eines neuen Anlaufs.
    if (discardsRef.current >= MAX_CONSECUTIVE_DISCARDS) {
      pauseClock()
      setPhase('error')
      return
    }
    setPhase('loading')
    void fetchQuestion()
  }, [reserve, fetchQuestion, pauseClock])

  const answer = useCallback(
    (index: number) => {
      if (chosenIndex !== null || !current) return // spec.md EC-1
      setChosenIndex(index)

      if (index !== current.correctIndex) {
        pauseClock()
        setPhase('resolved')
        return
      }

      const nextStreak = streak + 1
      setStreak(nextStreak)

      // spec.md EC-2 — every Pokémon in the pool answered correctly.
      //
      // Counted on the streak, not on `seenIdsRef` (BUG-17): that list also holds
      // questions that were *discarded* because their picture would not load
      // (EC-6), so it could reach the pool size while the player had answered
      // fewer. The winner message would then have been handed out for a round
      // that never earned it. The streak is exactly „richtig beantwortet", which
      // is what EC-2 asks about.
      //
      // A round with discards therefore no longer ends here — it ends when the
      // server reports „Pool leer", which is the honest place for it.
      if (nextStreak >= POOL_SIZE && !reserve) {
        window.setTimeout(() => void finishRound(nextStreak, true), CORRECT_FEEDBACK_MS)
        return
      }
      window.setTimeout(advance, CORRECT_FEEDBACK_MS)
    },
    [chosenIndex, current, streak, reserve, pauseClock, advance, finishRound]
  )

  /** spec.md AC-17 — unlimited manual retries; the streak and clock are untouched. */
  const retryAfterError = useCallback(() => {
    setRetrying(true)
    discardsRef.current = 0
    void fetchQuestion().finally(() => setRetrying(false))
  }, [fetchQuestion])

  /** spec.md AC-2 — the clock runs from the moment the picture is on screen. */
  const onPictureVisible = useCallback(() => {
    if (phase === 'open') startClock()
  }, [phase, startClock])

  // --- Render ---------------------------------------------------------------

  const probe = probing ? (
    <ImageProbe src={probing.imageUrl} onOk={onProbeOk} onFail={onProbeFail} />
  ) : null

  if (phase === 'finished') {
    // spec.md AC-9 — „Nochmal spielen" startet die neue Runde unmittelbar. Der
    // Umweg über den Startbildschirm war BUG-10 (qa-report.md 2026-09-04): ein
    // zusätzlicher Klick, der gegen das PRD-Erfolgskriterium „direkt eine
    // zweite Runde" arbeitet.
    return (
      <ResultView
        streak={streak}
        durationMs={finalDurationMs}
        poolCleared={poolCleared}
        isPersonalBest={isPersonalBest}
        saveState={saveState}
        onRetrySave={() => void finishRound(streak, poolCleared)}
        onPlayAgain={startRound}
      />
    )
  }

  if (phase === 'ready') {
    return (
      <>
        {probe}
        <StartView personalBest={personalBest} starting={starting} onStart={startRound} />
      </>
    )
  }

  if (phase === 'error') {
    return (
      <>
        {probe}
        <LoadErrorCard
          streak={streak}
          retrying={retrying}
          onRetry={retryAfterError}
          onEndRound={() => void finishRound(streak, false)}
        />
      </>
    )
  }

  if (!current) {
    return (
      <>
        {probe}
        <p className="py-16 text-center text-[15px] text-muted-foreground">
          Runde wird vorbereitet …
        </p>
      </>
    )
  }

  return (
    <>
      {probe}
      <QuestionView
        question={current}
        streak={streak}
        elapsedMs={elapsedMs}
        chosenIndex={chosenIndex}
        onAnswer={answer}
        onContinue={() => void finishRound(streak, false)}
        onPictureVisible={onPictureVisible}
      />
    </>
  )
}
