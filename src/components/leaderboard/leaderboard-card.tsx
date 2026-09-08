import { LeaderboardHeaderRow, LeaderboardRow } from './leaderboard-row'
import { OwnRankRow } from './own-rank-row'
import { LeaderboardEmpty, NoRankedRunHint } from './leaderboard-empty'
import { LeaderboardErrorCard } from './leaderboard-error-card'
import { TOP_RANKS } from '@/lib/leaderboard/format'
import type { LeaderboardResult } from '@/lib/leaderboard/queries'

/**
 * Die eine Karte der Weltrangliste (spec.md AC-6, AC-8, AC-9, AC-12, AC-24;
 * EC-3, EC-6).
 *
 * **Sie wählt genau einen Zustand.** Welchen, entscheidet allein das
 * Abfrageergebnis — es gibt hier keinen Fall, in dem zwei Meldungen
 * übereinanderstehen:
 *
 *   Fehler            -> Fehlerkarte (EC-6)
 *   keine Zeilen      -> Leerzustand, der zugleich AC-9 trägt (AC-17)
 *   Zeilen, eigene <=5-> Liste, eigene Zeile darin hervorgehoben (AC-8, EC-3)
 *   Zeilen, eigene >5 -> Liste plus abgesetzte eigene Zeile (AC-7)
 *   Zeilen, keine eig.-> Liste plus Hinweis „noch nicht in der Wertung" (AC-9)
 *
 * **Was hier bewusst NICHT steht:** kein Realtime-Abo, kein Polling, kein
 * Intervall, kein automatischer Neuaufbau (AC-12). Die Liste ist eine
 * Momentaufnahme des Aufrufs und ändert sich erst wieder durch eine Handlung des
 * Nutzers. Eine Liste, die sich unter dem Finger des Lesers umsortiert, ist
 * unangenehm — und Echtzeit-Wettbewerb ist im PRD ein Nicht-Ziel.
 */
export function LeaderboardCard({ result }: { result: LeaderboardResult }) {
  return (
    <section className="rounded-[var(--radius-card-value)] border border-border bg-card px-2 py-5 shadow-[var(--shadow-md)] sm:px-3 sm:py-6">
      <Body result={result} />
    </section>
  )
}

function Body({ result }: { result: LeaderboardResult }) {
  if (result.status === 'error') return <LeaderboardErrorCard />

  // `unauthenticated` erreicht diese Komponente nicht — die Seite leitet vorher
  // auf `/login` (AC-13, EC-8). Der Zweig steht hier, damit der Typ vollständig
  // behandelt ist und ein künftiger Aufrufer nicht ins Leere rendert.
  if (result.status === 'unauthenticated') return null

  const { entries } = result

  if (entries.length === 0) return <LeaderboardEmpty />

  const top = entries.filter((entry) => entry.rank <= TOP_RANKS)
  const own = entries.find((entry) => entry.isSelf)
  // Nur wenn die eigene Zeile **außerhalb** der Top-5 liegt, wird sie unten
  // wiederholt. Steht sie in der Liste, ist sie dort hervorgehoben und eine
  // zweite Zeile wäre schlicht dieselbe Zeile zweimal (AC-8, EC-3).
  const ownBelow = own && own.rank > TOP_RANKS ? own : null

  return (
    <>
      <ul>
        <LeaderboardHeaderRow />
        {top.map((entry) => (
          <LeaderboardRow
            key={entry.rank}
            rank={entry.rank}
            trainerName={entry.trainerName}
            streak={entry.streak}
            durationMs={entry.durationMs}
            isSelf={entry.isSelf}
          />
        ))}
      </ul>

      {ownBelow && <OwnRankRow entry={ownBelow} />}
      {!own && <NoRankedRunHint />}

      {/*
        AC-24 — in einem Satz, ohne Klick und ohne Aufklappen: welche Daten hier
        für andere sichtbar sind, und dass es ausschließlich der beste Lauf ist.
        PROJ-3 ist das erste Feature, das personenbezogene Daten anderen Nutzern
        offenlegt; bis hierher sah jeder nur sich selbst.
      */}
      <p className="px-3 pt-5 text-[13px] text-muted-foreground text-pretty sm:px-4">
        Andere angemeldete Spieler sehen hier deinen Trainernamen, deine beste Serie und die
        dazugehörige Zeit — immer nur deinen besten Lauf, nie deine übrigen Runden.
      </p>
    </>
  )
}
