import { describe, expect, it, vi } from 'vitest'
import { runAuthAction } from './run-action'
import { NETWORK_ERROR_MESSAGE } from './error-mapping'

// spec.md EC-6 / BUG-1: a Server Action's own errors already come back as
// ActionState; a failure of the *call itself* used to escape the transition
// and take the page down. These tests pin down both halves of the fix.

describe('runAuthAction', () => {
  it('passes a successful ActionState straight through', async () => {
    const result = await runAuthAction(async () => ({ message: 'ok' }))
    expect(result).toEqual({ message: 'ok' })
  })

  it('passes a server-returned error through unchanged', async () => {
    const result = await runAuthAction(async () => ({ error: 'Serverfehler' }))
    expect(result).toEqual({ error: 'Serverfehler' })
  })

  it('turns a transport failure into the network error state instead of throwing', async () => {
    const result = await runAuthAction(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(result).toEqual({ error: NETWORK_ERROR_MESSAGE })
  })

  // The success path of every action ends in redirect(), which Next.js
  // implements by throwing. Swallowing that would strand the user on the form
  // after a successful login.
  it('re-throws a Next.js redirect signal instead of swallowing it', async () => {
    const redirectError = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;replace;/;307;',
    })

    await expect(
      runAuthAction(async () => {
        throw redirectError
      })
    ).rejects.toBe(redirectError)
  })

  it('calls the action exactly once', async () => {
    const call = vi.fn(async () => ({ message: 'ok' }))
    await runAuthAction(call)
    expect(call).toHaveBeenCalledTimes(1)
  })
})
