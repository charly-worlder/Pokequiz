'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { runClientAction } from '@/lib/actions/run-action'
import {
  prepareNextQuestionAction,
  promoteQuestionAction,
  replacePreparedQuestionAction,
  startRoundAction,
  type ClientQuestion,
} from '@/lib/quiz/question-action'
import {
  answerAction,
  endRoundAction,
  getRunByRoundIdAction,
  type AnswerResult,
  type PersonalBest,
  type RoundResult,
} from '@/lib/quiz/run-actions'
import { POOL_SIZE } from '@/lib/validation/quiz'
import { ImageProbe, questionImageUrl } from './pokemon-image'
import { StartView } from './start-view'
import { QuestionView } from './question-view'
import { LoadErrorCard } from './load-error-card'
import { ResultView } from './result-view'

/**
 * Die Zustandsmaschine der **Anzeige** (design.md → Component Structure).
 *
 * Seit dem 2026-09-06 besitzt dieser Bildschirm die Wahrheit nicht mehr: Serie,
 * Zeit und richtige Antwort kommen mit jeder Serverantwort mit. Er hält sie, um
 * sie zu zeigen, nicht um sie zu berechnen — deshalb gibt es hier weder einen
 * `correctIndex` vor der Antwort noch eine Ausschlussliste (spec.md AC-32,
 * AC-33).
 *
 *   bereit --Runde starten--> lädt --Frage da--> offen
 *   offen --Klick--> wartet
 *   wartet --Urteil richtig--> offen        (die vorbereitete Frage rückt nach)
 *   wartet --Urteil richtig, nichts vorbereitet--> fehler
 *   wartet --Urteil falsch / Pool leer--> aufgelöst --Klick--> beendet
 *   fehler --Erneut versuchen--> offen      fehler --Runde beenden--> beendet
 *   beendet --Nochmal spielen--> lädt       (AC-9: ein Klick, eine neue Runde)
 *
 * Aus `beendet` führt kein Weg zurück nach `offen`: Eine beendete Runde ist
 * unveränderlich, genau wie ihre Zeile in der Datenbank.
 */
type Phase = 'ready' | 'loading' | 'open' | 'waiting' | 'resolved' | 'error' | 'finished'

/** spec.md EC-10 — drei verworfene Fragen in Folge sind eine gebrochene Quelle. */
const MAX_CONSECUTIVE_DISCARDS = 3

/** Wie lange die Auflösung einer richtigen Antwort sichtbar bleibt (AC-4). */
const CORRECT_FEEDBACK_MS = 350

const STALE_MESSAGE =
  'Diese Runde lief auf einem anderen Gerät oder in einem anderen Tab weiter. Starte eine neue Runde.'

export function QuizScreen({ initialPersonalBest }: { initialPersonalBest: PersonalBest | null }) {
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('ready')
  const [personalBest, setPersonalBest] = useState(initialPersonalBest)

  const [current, setCurrent] = useState<ClientQuestion | null>(null)
  /** Geprüft und wartend — das macht den Wechsel frei von einem Ladezustand (AC-10). */
  const [reserve, setReserve] = useState<ClientQuestion | null>(null)
  /** Vorbereitet, Bild noch nicht als ladbar erwiesen. */
  const [probing, setProbing] = useState<ClientQuestion | null>(null)

  const [chosenIndex, setChosenIndex] = useState<number | null>(null)
  /** Erst nach dem Urteil des Servers bekannt (AC-6) — vorher weiß das niemand hier. */
  const [correctIndex, setCorrectIndex] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)
  const [result, setResult] = useState<RoundResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [starting, setStarting] = useState(false)
  /** Erhöht sich bei „Erneut versuchen" und fordert das Bild der offenen Frage neu an. */
  const [imageEpoch, setImageEpoch] = useState(0)

  /**
   * Spiegelt `current` **synchron**.
   *
   * `advance` setzt `setCurrent(null)` und ruft im selben Durchlauf
   * `prepareNext()` auf. Dessen Closure hielt bis zum ersten Testlauf am
   * 2026-09-06 noch die *alte*, gefüllte `current` — die Fehlerkarte blieb
   * deshalb aus, und der Bildschirm stand für immer auf „Runde wird
   * vorbereitet …". Dieselbe Fehlerklasse wie BUG-33 im alten Aufbau.
   */
  const currentRef = useRef<ClientQuestion | null>(null)
  const showCurrent = useCallback((question: ClientQuestion | null) => {
    currentRef.current = question
    setCurrent(question)
  }, [])

  /**
   * Spiegelt `probing` synchron. `advance` entscheidet damit, ob es überhaupt
   * eine neue Frage anfordern darf — siehe unten.
   */
  /**
   * Spiegelt `reserve` **synchron**.
   *
   * `advance` läuft aus einem `setTimeout` und hielt die Reserve aus dem Render
   * fest, in dem die Antwort abgeschickt wurde. Füllte die Bildprüfung sie
   * dazwischen, sah `advance` sie nicht, zog eine überflüssige Frage nach — und
   * die konnte der Server nicht mehr zur aktuellen machen, weil er die richtige
   * längst befördert hatte. Die Runde blieb auf „Runde wird vorbereitet …"
   * stehen (E2E-Lauf 2026-09-06, 11 von 57 rot). Dieselbe Fehlerklasse wie
   * BUG-33 im abgelösten Aufbau.
   */
  const reserveRef = useRef<ClientQuestion | null>(null)
  const setReserveQuestion = useCallback((question: ClientQuestion | null) => {
    reserveRef.current = question
    setReserve(question)
  }, [])

  const probingRef = useRef<ClientQuestion | null>(null)
  const setProbingQuestion = useCallback((question: ClientQuestion | null) => {
    probingRef.current = question
    setProbing(question)
  }, [])

  const discardsRef = useRef(0)
  const preparingRef = useRef(false)
  /** Die Runden-Kennung, mit der ein verlorengegangenes Ergebnis nachlesbar ist (EC-3). */
  const roundIdRef = useRef<string>('')
  /**
   * Ob gerade eine Runde existiert — dieselbe Aussage wie `roundIdRef`, aber als
   * State, weil die Fehlerkarte sie beim Rendern braucht und ein Ref dort nicht
   * gelesen werden darf (react-hooks/refs).
   */
  const [hasRound, setHasRound] = useState(false)
  /**
   * Die Antwort, deren Urteil unterwegs verlorenging. Ist sie gesetzt, wiederholt
   * „Erneut versuchen" die Antwort statt eine Frage nachzuladen (EC-3).
   */
  const pendingAnswerRef = useRef<{ token: string; choice: number } | null>(null)

  // --- Uhr: reine Anzeige ---------------------------------------------------
  // Gewertet wird die servergemessene Zeit (AC-34, EC-13); diese hier läuft nur,
  // damit der Spieler etwas laufen sieht. Sie startet mit dem ersten sichtbaren
  // Bild (AC-2) und steht still, während die Fehlerkarte oben ist (AC-16).
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
   * spec.md AC-19 — vor dem Verlassen einer Runde warnen, die etwas zu verlieren
   * hat. Erst ab Serie 1: Bei 0 gibt es nichts zu retten.
   *
   * Die Runde bleibt bewusst nicht wiederherstellbar (spec.md → Out of Scope);
   * das rettet den versehentlichen Reload, ohne eine Wiederaufnahme vorzutäuschen.
   */
  const roundInFlight =
    phase === 'open' ||
    phase === 'waiting' ||
    phase === 'resolved' ||
    phase === 'error' ||
    phase === 'loading'
  useEffect(() => {
    if (!roundInFlight || streak < 1) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [roundInFlight, streak])

  /** spec.md EC-7 — Sitzung weg: Die Runde ist verloren, nie einem fremden Konto zugeordnet. */
  const bailToLogin = useCallback(() => router.push('/login'), [router])

  const showResult = useCallback((round: RoundResult) => {
    pendingAnswerRef.current = null
    setResult(round)
    setStreak(round.streak)
    setPhase('finished')
    if (round.isPersonalBest) {
      setPersonalBest({ streak: round.streak, durationMs: round.durationMs })
    }
  }, [])

  const goToError = useCallback(
    (message: string | null) => {
      pauseClock()
      setErrorMessage(message)
      setPhase('error')
    },
    [pauseClock]
  )

  // --- Fragen vorbereiten ---------------------------------------------------

  /**
   * Holt die nächste vorbereitete Frage und prüft ihr Bild (AC-10).
   *
   * `replace` unterscheidet die beiden Anlässe: nach einer richtigen Antwort eine
   * neue vorbereiten, oder eine vorbereitete ersetzen, deren Bild nicht lud
   * (EC-6). In beiden Fällen bleibt die **aktuelle** Frage unangetastet — das ist
   * EC-12, und deshalb ist „Bild kaputt" kein Überspringen-Knopf.
   */
  const prepareNext = useCallback(
    async (replace = false) => {
      if (preparingRef.current) return
      preparingRef.current = true
      try {
        const action = replace ? replacePreparedQuestionAction : prepareNextQuestionAction
        const result = await runClientAction(() => action(roundIdRef.current), {
          status: 'unavailable' as const,
        })

        if (result.status === 'unauthenticated') return bailToLogin()
        if (result.status === 'ok') {
          setProbingQuestion(result.prepared)
          return
        }
        // Die eigene Runde läuft nicht mehr — sie wurde in einem anderen Tab oder
        // auf einem anderen Gerät verdrängt (AC-36, EC-15). Vorher hat dieser
        // Aufruf die *fremde* laufende Runde verändert, statt hier zu enden
        // (BUG-130).
        if (result.status === 'stale') return goToError(STALE_MESSAGE)
        // **Kein Vorrat mehr.** Der Server hat die Runde dann bereits gewertet und
        // geschrieben (AC-35) — hier wird das Ergebnis nur noch angezeigt.
        //
        // Bis zum 2026-09-07 beendete der Browser sie selbst; blieb sein Aufruf aus
        // (Tab zu, Verbindung weg), war das Ergebnis verloren (BUG-119). Steht noch
        // eine Frage offen, kommt kein Ergebnis mit: Der Spieler beantwortet sie
        // erst, und der Fall trifft danach zu.
        //
        // Die Gewinner-Meldung hängt weiterhin an der Serie, nicht am leeren Vorrat —
        // `seen_ids` enthält auch verworfene Nummern (EC-5, EC-6).
        if (result.status === 'pool-empty') {
          if (result.result) showResult(result.result)
          return
        }
        if (!currentRef.current) goToError(null)
      } finally {
        preparingRef.current = false
      }
    },
    [bailToLogin, goToError, setProbingQuestion, showResult]
  )

  /** Das Bild der vorbereiteten Frage lädt — sie darf nachrücken (AC-10). */
  const onProbeOk = useCallback(() => {
    if (!probing) return
    discardsRef.current = 0
    const ready = probing
    setProbingQuestion(null)

    // Wartet der Spieler gerade auf eine Frage, wird die geprüfte **sofort** die
    // aktuelle. Ohne diesen Zweig landete sie nur in der Reserve, und der
    // Bildschirm blieb auf „Runde wird vorbereitet …" stehen — gefunden vom
    // E2E-Journey am 2026-09-06, nachdem zwei richtige Antworten die Reserve
    // geleert hatten.
    if (!currentRef.current) {
      // Der Server hält diese Frage als *vorbereitete*. Erst mit der Beförderung
      // wird sie dort die aktuelle — und erst dann beginnt ihre Messung (AC-34).
      // Ohne diesen Schritt zeigte der Browser eine Frage, die der Server nicht
      // als offen kennt, und jede Antwort darauf liefe ins Leere.
      void (async () => {
        const { promoted } = await runClientAction(() => promoteQuestionAction(ready.token), {
          promoted: false,
        })
        if (!promoted) return
        showCurrent(ready)
        setPhase('open')
        void prepareNext()
      })()
      return
    }

    setReserveQuestion(ready)
  }, [probing, showCurrent, prepareNext, setProbingQuestion, setReserveQuestion])

  /** spec.md EC-6 → EC-10: verwerfen, und nach dreien die Quelle für gebrochen erklären. */
  const onProbeFail = useCallback(() => {
    if (!probing) return
    setProbingQuestion(null)
    discardsRef.current += 1

    if (discardsRef.current >= MAX_CONSECUTIVE_DISCARDS) {
      if (!currentRef.current) goToError(null)
      return
    }
    void prepareNext(true)
  }, [probing, goToError, prepareNext, setProbingQuestion])

  // --- Runde ----------------------------------------------------------------

  const startRound = useCallback(() => {
    if (starting) return // spec.md EC-9 — mehrere Klicks starten genau eine Runde
    setStarting(true)

    discardsRef.current = 0
    accumulatedRef.current = 0
    startedAtRef.current = null
    pendingAnswerRef.current = null
    // Die alte Kennung ist ab hier gegenstandslos. Bliebe sie stehen und der
    // Start scheiterte, hielte sich die Fehlerkarte für eine laufende Runde und
    // böte „Runde beenden" für eine Runde an, die es nicht gibt (BUG-134).
    roundIdRef.current = ''
    setHasRound(false)

    setElapsedMs(0)
    setStreak(0)
    setChosenIndex(null)
    setCorrectIndex(null)
    showCurrent(null)
    setReserveQuestion(null)
    setProbingQuestion(null)
    setResult(null)
    setErrorMessage(null)
    setPhase('loading')

    void (async () => {
      try {
        const started = await runClientAction(() => startRoundAction(), {
          status: 'unavailable' as const,
        })

        if (started.status === 'unauthenticated') return bailToLogin()
        if (started.status !== 'ok') return goToError(null)

        roundIdRef.current = started.roundId
        setHasRound(true)
        showCurrent(started.current)
        setProbingQuestion(started.prepared)
        setPhase('open')
      } finally {
        setStarting(false)
      }
    })()
  }, [starting, bailToLogin, goToError, showCurrent, setProbingQuestion, setReserveQuestion])

  /** Nach einer richtigen Antwort: die vorbereitete Frage wird die aktuelle. */
  const advance = useCallback(() => {
    setChosenIndex(null)
    setCorrectIndex(null)

    const ready = reserveRef.current
    if (ready) {
      showCurrent(ready)
      setReserveQuestion(null)
      setPhase('open')
      void prepareNext()
      return
    }

    // Nichts vorbereitet — jetzt wartet der Spieler, ein Fehlschlag ist also
    // sichtbar (AC-16). Die Uhr steht dabei, weil serverseitig keine Frage offen
    // ist (AC-34).
    showCurrent(null)
    if (discardsRef.current >= MAX_CONSECUTIVE_DISCARDS) return goToError(null)
    setPhase('loading')

    // **Nur, wenn nichts in Prüfung ist.** Sonst zöge der Browser eine zweite
    // Frage nach, der Server überschriebe seine vorbereitete mit ihr, und die
    // Beförderung der ersten liefe ins Leere — der Bildschirm bliebe auf „Runde
    // wird vorbereitet …" stehen. Gefunden vom E2E-Journey am 2026-09-06 beim
    // zweiten Wechsel in Folge; die laufende Sonde befördert selbst, sobald ihr
    // Bild geladen ist.
    if (!probingRef.current) void prepareNext()
  }, [prepareNext, goToError, showCurrent, setReserveQuestion])

  const submit = useCallback(
    async (token: string, choice: number) => {
      pendingAnswerRef.current = { token, choice }

      const outcome = await runClientAction<AnswerResult | { status: 'transport-error' }>(() => answerAction({ token, choice }), {
        status: 'transport-error' as const,
      })

      if (outcome.status === 'unauthenticated') return bailToLogin()

      if (outcome.status === 'stale') {
        // Zwei Möglichkeiten: Das Urteil ging beim ersten Versuch verloren,
        // *nachdem* der Server geschrieben hatte — dann liegt das Ergebnis in der
        // Datenbank und wird hier nachgelesen (EC-3). Oder die Runde lief
        // anderswo weiter (EC-15).
        const stored = await runClientAction(() => getRunByRoundIdAction(roundIdRef.current), null)
        if (stored) return showResult(stored)
        return goToError(STALE_MESSAGE)
      }

      if (outcome.status !== 'answered') {
        // Transport abgerissen oder abgelehnt: Der Rundenzustand steht noch, die
        // Antwort ist wiederholbar (EC-3).
        return goToError(null)
      }

      pendingAnswerRef.current = null
      setCorrectIndex(outcome.correctIndex)
      setStreak(outcome.streak)

      if (outcome.result) {
        const finished = outcome.result
        pauseClock()
        setPhase('resolved')
        setResult(finished)
        if (finished.isPersonalBest) {
          setPersonalBest({ streak: finished.streak, durationMs: finished.durationMs })
        }

        // **Eine richtige Antwort, die die Runde beendet, hat keine Auflösung zu
        // zeigen** (spec.md EC-2, BUG-133). Bei einer falschen bleibt die
        // Auflösung stehen, bis der Spieler weiterklickt (AC-6) — dafür trägt die
        // Frage-Ansicht den Knopf „Weiter zum Ergebnis". Sie zeigt ihn aber nur
        // bei einer falschen Antwort, und richtig ist hier gerade die 386. und
        // letzte gewesen: Ohne diesen Übergang bliebe der Spieler auf der Frage
        // stehen und sähe sein Ergebnis nie — obwohl der Server es längst
        // geschrieben hat.
        if (outcome.correct) {
          window.setTimeout(() => showResult(finished), CORRECT_FEEDBACK_MS)
        }
        return
      }

      window.setTimeout(advance, CORRECT_FEEDBACK_MS)
    },
    [advance, bailToLogin, goToError, pauseClock, showResult]
  )

  const answer = useCallback(
    (index: number) => {
      // spec.md EC-1 — der zweite Klick bleibt wirkungslos. Serverseitig hält das
      // ohnehin (Migration 0009); hier verhindert es nur die doppelte Anfrage.
      if (chosenIndex !== null || !current || phase !== 'open') return
      setChosenIndex(index)
      setPhase('waiting')
      void submit(current.token, index)
    },
    [chosenIndex, current, phase, submit]
  )

  /** spec.md AC-17 — beliebig oft wiederholbar; Serie und Zeit bleiben unangetastet. */
  const retryAfterError = useCallback(() => {
    setRetrying(true)
    setErrorMessage(null)
    discardsRef.current = 0

    void (async () => {
      try {
        const pending = pendingAnswerRef.current
        if (pending) {
          setPhase('waiting')
          await submit(pending.token, pending.choice)
          return
        }

        // **Es gibt gar keine Runde** — der Start selbst ist gescheitert
        // (BUG-134). „Erneut versuchen" muss dann eine Runde *starten*; vorher
        // rief es `prepareNextQuestionAction('')`, was der Server zu Recht mit
        // `stale` beantwortete, und die Karte lief in sich selbst zurück.
        if (!roundIdRef.current) {
          startRound()
          return
        }

        // Die Frage steht noch — es war ihr Bild, das nicht kam (BUG-111). Erneut
        // anfordern, ohne eine neue Frage zu ziehen: Die alte bleibt gültig, und
        // ein Bildfehler darf kein Überspringen werden (EC-12).
        if (currentRef.current) {
          setImageEpoch((epoch) => epoch + 1)
          setPhase('open')
          return
        }
        setPhase('loading')
        await prepareNext()
        // Nichts vorbereitet bekommen: zurück in die Fehlerkarte.
        setPhase((previous) => (previous === 'loading' ? 'error' : previous))
      } finally {
        setRetrying(false)
      }
    })()
  }, [prepareNext, startRound, submit])

  const endRound = useCallback(async () => {
    // Die Runden-Kennung ist Pflicht (BUG-120): Ohne sie beendete der Aufruf,
    // was gerade aktiv war — ein veralteter Tab konnte damit die laufende Runde
    // eines anderen Tabs beenden.
    const outcome = await runClientAction(() => endRoundAction(roundIdRef.current), {
      status: 'gone' as const,
    })
    if (outcome.status === 'unauthenticated') return bailToLogin()
    if (outcome.status === 'ended') return showResult(outcome.result)

    // Es gab keinen Rundenzustand mehr — vielleicht war die Runde schon
    // geschrieben. Nachlesen statt den Spieler ohne Ergebnis stehenzulassen.
    const stored = await runClientAction(() => getRunByRoundIdAction(roundIdRef.current), null)
    if (stored) return showResult(stored)
    goToError(STALE_MESSAGE)
  }, [bailToLogin, goToError, showResult])

  /**
   * spec.md AC-15, AC-16 — das Bild der **angezeigten** Frage kam auch nach dem
   * stillen zweiten Versuch nicht. Die Frage bleibt, was sie ist: Sie wird nicht
   * ersetzt (EC-12), der Spieler bekommt aber einen Ausweg statt einer
   * Skelettfläche, die für immer stehenbleibt (BUG-111).
   */
  const onImageFailed = useCallback(() => goToError(null), [goToError])

  /** spec.md AC-2 — die angezeigte Uhr läuft ab dem ersten sichtbaren Bild. */
  const onPictureVisible = useCallback(() => {
    if (phase === 'open' || phase === 'waiting') startClock()
  }, [phase, startClock])

  // --- Darstellung ----------------------------------------------------------

  const probe = probing ? (
    <ImageProbe src={questionImageUrl(probing.token)} onOk={onProbeOk} onFail={onProbeFail} />
  ) : null

  if (phase === 'finished' && result) {
    return (
      <ResultView
        streak={result.streak}
        durationMs={result.durationMs}
        poolCleared={result.streak >= POOL_SIZE}
        isPersonalBest={result.isPersonalBest}
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
          // Drei Sorten, drei Auswege (BUG-134, BUG-135): Eine Runde, die
          // anderswo weiterlief, ist gegenstandslos; ein gescheiterter Start hat
          // nichts zu beenden; alles andere ist eine fortsetzbare Runde.
          kind={errorMessage ? 'stale-round' : hasRound ? 'question' : 'no-round'}
          streak={streak}
          retrying={retrying}
          timeKeepsRunning={current !== null}
          onRetry={retryAfterError}
          onEndRound={() => void endRound()}
          onStartNewRound={startRound}
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
        correctIndex={correctIndex}
        waiting={phase === 'waiting'}
        imageEpoch={imageEpoch}
        onImageFailed={onImageFailed}
        onAnswer={answer}
        onContinue={() => result && showResult(result)}
        onPictureVisible={onPictureVisible}
      />
    </>
  )
}
