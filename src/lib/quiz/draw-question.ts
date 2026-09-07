import 'server-only'
import { fetchGermanName, fetchGermanNames, withTimeoutAndOneRetry } from '@/lib/pokeapi/client'
import { POOL_END, POOL_SIZE, POOL_START } from '@/lib/validation/quiz'

/**
 * Eine Frage ziehen — die einzige Stelle, an der Pokémon-Nummern gezogen und
 * deutsche Namen geholt werden.
 *
 * **Bewusst keine Server-Action-Datei.** Alles, was aus einer solchen Datei
 * exportiert wird, ist ein öffentlicher Endpunkt; diese Funktion gibt die Lösung
 * zurück und darf deshalb nie von außen aufrufbar sein (spec.md AC-32). Sie ist
 * ein Baustein für die Server Actions, kein Endpunkt.
 */

export type DrawnQuestion = {
  answerId: number
  /** Welche der vier gemischten Optionen die richtige ist (AC-3). */
  correctIndex: number
  options: string[]
  /**
   * Nummern, die dabei verworfen wurden, weil ihnen der deutsche Name fehlte
   * (EC-5). Sie wandern in die Ausschlussliste der Runde, damit nicht bei jeder
   * Frage erneut dieselbe Niete gezogen wird.
   */
  alsoSeen: number[]
}

function randomIdExcluding(excluded: Set<number>): number | null {
  const available: number[] = []
  for (let id = POOL_START; id <= POOL_END; id++) {
    if (!excluded.has(id)) available.push(id)
  }
  if (available.length === 0) return null
  return available[Math.floor(Math.random() * available.length)]
}

/** Drei Distraktoren, alle voneinander und von der Lösung verschieden (AC-3). */
function drawDistractors(answerId: number): number[] {
  const picked = new Set<number>([answerId])
  while (picked.size < 4) {
    picked.add(Math.floor(Math.random() * POOL_SIZE) + POOL_START)
  }
  picked.delete(answerId)
  return [...picked]
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Zieht eine vollständige Frage oder meldet `null`, wenn das innerhalb des
 * Zeitbudgets nicht gelingt (AC-15; der Aufrufer macht daraus die Fehlerkarte
 * aus AC-16).
 *
 * `excluded` sind die Nummern, die in dieser Runde schon vorkamen — der Server
 * führt diese Liste, nicht der Browser (AC-5, AC-32).
 */
export async function drawQuestion(excluded: Set<number>): Promise<DrawnQuestion | 'pool-empty' | null> {
  if (excluded.size >= POOL_SIZE) return 'pool-empty'

  const built = await withTimeoutAndOneRetry(async (signal) => {
    const local = new Set(excluded)
    const alsoSeen: number[] = []

    // Bis zu drei Züge in einem Versuch: Ein fehlender deutscher Name ist eine
    // Eigenschaft dieses Pokémon, neu ziehen ist die richtige Antwort (EC-5).
    for (let draw = 0; draw < 3; draw++) {
      const answerId = randomIdExcluding(local)
      if (answerId === null) return 'pool-empty' as const

      const answerName = await fetchGermanName(answerId, signal)
      if (!answerName) {
        local.add(answerId)
        alsoSeen.push(answerId)
        continue
      }

      const distractorNames = await fetchGermanNames(drawDistractors(answerId), signal)
      if (distractorNames.some((name) => !name)) continue

      const options = shuffle([answerName, ...(distractorNames as string[])])
      return {
        answerId,
        correctIndex: options.indexOf(answerName),
        options,
        alsoSeen,
      }
    }
    return null
  })

  return built
}
