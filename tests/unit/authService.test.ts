import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearTokens, getAccessToken } from '../../src/auth/authService'
import { MemoryStorage } from './storage'

const TOKEN_KEY = 'spotify_tokens'

describe('auth token storage', () => {
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage()
    vi.stubGlobal('sessionStorage', storage)
    clearTokens()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('recovers from malformed token JSON', () => {
    storage.setItem(TOKEN_KEY, '{bad-json')

    expect(getAccessToken()).toBeNull()
    expect(storage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('clears expired access tokens', () => {
    storage.setItem(TOKEN_KEY, JSON.stringify({
      accessToken: 'old-access',
      refreshToken: 'refresh',
      expiresAt: Date.now() - 1000,
    }))

    expect(getAccessToken()).toBeNull()
    expect(storage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('returns a valid unexpired access token', () => {
    storage.setItem(TOKEN_KEY, JSON.stringify({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 60_000,
    }))

    expect(getAccessToken()).toBe('access')
  })
})
