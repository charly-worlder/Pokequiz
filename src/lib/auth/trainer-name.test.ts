import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Die Nachfrage „ist dieser Trainername vergeben?" (BUG-68, BUG-74).
 *
 * Was hier **nicht** geprüft wird, weil es nicht hierher gehört: dass der
 * Vergleich in der Datenbank richtig ist. Das entscheidet `is_trainer_name_taken`
 * aus `0006`, und ein Test mit gemocktem Client würde davon nur die Mock-Antwort
 * bestätigen — dieselbe Begründung, die im Kopf von `throttle.test.ts` steht.
 * Belegt wurde es gegen die laufende Datenbank: Für einen Namen, den es nicht
 * gibt (`qa_egC54921` neben dem echten `qaRegC54921`), sagte die alte
 * `ilike`-Abfrage `true` und die Funktion sagt `false`; beim echten Namen sagt sie
 * `true`. Dazu Index Scan statt Seq Scan und `42501` für `anon`.
 *
 * Hier steht die Logik davor und danach: dass überhaupt die **Funktion** gefragt
 * wird und nicht wieder ein LIKE-Muster, und dass ein Fehler nicht als „vergeben"
 * durchgeht.
 */

const { rpc, createAdminClient } = vi.hoisted(() => ({
  rpc: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))
vi.mock('server-only', () => ({}))

import { isTrainerNameTaken } from './trainer-name'

beforeEach(() => {
  vi.clearAllMocks()
  createAdminClient.mockReturnValue({ rpc })
})

describe('isTrainerNameTaken', () => {
  it('fragt die Datenbankfunktion, nicht ein LIKE-Muster (BUG-74)', async () => {
    rpc.mockResolvedValue({ data: false, error: null })

    await isTrainerNameTaken('Ash_1')

    expect(rpc).toHaveBeenCalledWith('is_trainer_name_taken', { p_name: 'Ash_1' })
  })

  it('meldet einen vergebenen Namen', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    await expect(isTrainerNameTaken('Ash')).resolves.toBe(true)
  })

  it('meldet einen freien Namen', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    await expect(isTrainerNameTaken('Ash')).resolves.toBe(false)
  })

  /**
   * Die beiden Fehlerpfade zeigen in dieselbe Richtung, und zwar bewusst: Wenn
   * die Nachfrage selbst scheitert, ist die Datenbank das Problem und nicht der
   * Name. `false` führt den Aufrufer zur Störungsmeldung — der zutreffenden.
   * `true` hieße, dem Nutzer eine Aussage über seinen Wunschnamen zu machen, die
   * niemand geprüft hat.
   */
  it('antwortet bei einem Datenbankfehler mit „nicht vergeben"', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } })
    await expect(isTrainerNameTaken('Ash')).resolves.toBe(false)
  })

  it('antwortet auch dann mit „nicht vergeben", wenn der Client gar nicht entsteht', async () => {
    createAdminClient.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt.')
    })
    await expect(isTrainerNameTaken('Ash')).resolves.toBe(false)
  })

  it('deutet eine unerwartete Antwort nicht als „vergeben"', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(isTrainerNameTaken('Ash')).resolves.toBe(false)
  })
})
