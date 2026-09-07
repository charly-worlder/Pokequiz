import { describe, expect, it, vi, beforeEach } from 'vitest'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

const { resolveQuestionImage } = vi.hoisted(() => ({ resolveQuestionImage: vi.fn() }))
vi.mock('@/lib/quiz/round-state', () => ({ resolveQuestionImage }))

const { fetchSpriteBytes } = vi.hoisted(() => ({ fetchSpriteBytes: vi.fn() }))
vi.mock('@/lib/pokeapi/client', () => ({ fetchSpriteBytes }))

import { GET } from './route'

const TOKEN = '3f8b2c1e-9a4d-4f6b-8e2a-1c5d7e9f0a3b'

function session(user: { id: string } | null = { id: 'user-1' }) {
  createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user } }) } })
}

const call = (token: string) =>
  GET(new Request(`http://localhost/api/question/${token}/image`), {
    params: Promise.resolve({ token }),
  })

beforeEach(() => {
  vi.clearAllMocks()
  session()
})

describe('GET /api/question/[token]/image', () => {
  it('liefert das Bild für ein Token der eigenen laufenden Runde (AC-20)', async () => {
    resolveQuestionImage.mockResolvedValue(25)
    fetchSpriteBytes.mockResolvedValue({
      body: new Uint8Array([137, 80, 78, 71]).buffer,
      contentType: 'image/png',
    })

    const response = await call(TOKEN)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(resolveQuestionImage).toHaveBeenCalledWith('user-1', TOKEN)
  })

  it('erlaubt dem Browser, das vorgeladene Bild wiederzuverwenden, ohne es zu teilen (AC-10)', async () => {
    resolveQuestionImage.mockResolvedValue(25)
    fetchSpriteBytes.mockResolvedValue({ body: new ArrayBuffer(4), contentType: 'image/png' })

    const cacheControl = (await call(TOKEN)).headers.get('cache-control')

    expect(cacheControl).toContain('private')
    expect(cacheControl).toContain('max-age=3600')
  })

  it('verrät die Pokémon-Nummer in keiner Kopfzeile und in keiner Adresse (AC-32)', async () => {
    resolveQuestionImage.mockResolvedValue(25)
    fetchSpriteBytes.mockResolvedValue({ body: new ArrayBuffer(4), contentType: 'image/png' })

    const response = await call(TOKEN)

    const headers = [...response.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\n')
    expect(headers).not.toContain('25')
    expect(headers).not.toContain('official-artwork')
    expect(headers).not.toContain('githubusercontent')
    expect(response.headers.get('location')).toBeNull()
  })

  it('antwortet auf ein fremdes oder abgelaufenes Token mit 404 (AC-32)', async () => {
    resolveQuestionImage.mockResolvedValue(null)

    const response = await call(TOKEN)

    expect(response.status).toBe(404)
    expect(fetchSpriteBytes).not.toHaveBeenCalled()
  })

  it('antwortet auf ein Token, das keines ist, mit 404 — ohne die Datenbank zu fragen', async () => {
    const response = await call('../../etc/passwd')

    expect(response.status).toBe(404)
    expect(resolveQuestionImage).not.toHaveBeenCalled()
  })

  it('weist einen Aufruf ohne Sitzung ab (EC-7)', async () => {
    session(null)

    const response = await call(TOKEN)

    expect(response.status).toBe(401)
    expect(resolveQuestionImage).not.toHaveBeenCalled()
  })

  it('antwortet mit 404, wenn das Sprite nicht abrufbar ist (EC-6)', async () => {
    resolveQuestionImage.mockResolvedValue(25)
    fetchSpriteBytes.mockResolvedValue(null)

    expect((await call(TOKEN)).status).toBe(404)
  })
})
