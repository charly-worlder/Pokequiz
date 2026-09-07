import { createClient } from '@/lib/supabase/server'
import { fetchSpriteBytes } from '@/lib/pokeapi/client'
import { resolveQuestionImage } from '@/lib/quiz/round-state'
import { questionTokenSchema } from '@/lib/validation/quiz'

/**
 * Das Pokémon-Bild einer Frage — unter einem Token, nicht unter seiner Nummer.
 *
 * Diese Route ist die Umsetzung von zwei Kriterien auf einmal:
 *
 * - **AC-20:** Der Browser fragt ausschließlich die eigene Domain an. Die
 *   IP-Adresse eines Spielers erreicht kein Nicht-EU-CDN.
 * - **AC-32:** Aus der Adresse ist die Pokémon-Nummer nicht ableitbar. Vorher
 *   stand sie sichtbar in `/_next/image?url=…/25.png` — ein Skript in der Konsole
 *   hätte sie lesen, den deutschen Namen nachschlagen und richtig klicken können,
 *   und der Server hätte eine echte Serie gezählt.
 *
 * Deshalb löst die Nummer nur die Datenbank auf, und nur für die laufende Runde
 * dieses Nutzers (Migration 0009). Ein fremdes, abgelaufenes oder erfundenes
 * Token ergibt 404 — dieselbe Antwort wie ein Token, das es nie gab, damit die
 * Antwort nichts über fremde Runden verrät.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response(null, { status: 401 })

  const { token } = await params
  const parsed = questionTokenSchema.safeParse(token)
  if (!parsed.success) return new Response(null, { status: 404 })

  const pokemonId = await resolveQuestionImage(user.id, parsed.data)
  if (pokemonId === null) return new Response(null, { status: 404 })

  const sprite = await fetchSpriteBytes(pokemonId, AbortSignal.timeout(5_000))
  if (!sprite) return new Response(null, { status: 404 })

  return new Response(sprite.body, {
    headers: {
      'content-type': sprite.contentType,
      // Der Browser hat dieses Bild beim Vorladen schon geholt (AC-10); beim
      // Anzeigen soll es aus seinem Cache kommen und nicht ein zweites Mal durch
      // die Leitung. `private`, weil die Adresse an eine Sitzung gebunden ist und
      // in keinem gemeinsamen Zwischenspeicher landen darf.
      'cache-control': 'private, max-age=3600, immutable',
    },
  })
}
