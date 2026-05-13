import { generateChallenge, getStoredVerifier, clearVerifier } from './pkce'
import { SCOPES } from './scopes'

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string
const TOKEN_KEY = 'spotify_tokens'

interface Tokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

function saveTokens(tokens: Tokens): void {
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
}

function loadTokens(): Tokens | null {
  const raw = sessionStorage.getItem(TOKEN_KEY)
  return raw ? (JSON.parse(raw) as Tokens) : null
}

export function clearTokens(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

export function getAccessToken(): string | null {
  const tokens = loadTokens()
  if (!tokens) return null
  if (Date.now() > tokens.expiresAt) return null
  return tokens.accessToken
}

export async function redirectToLogin(): Promise<void> {
  const { challenge } = await generateChallenge()
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const verifier = getStoredVerifier()
  if (!verifier) throw new Error('No PKCE verifier found')

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  })

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed: ${text}`)
  }

  const data = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  clearVerifier()
  saveTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 60_000,
  })
}

export async function refreshAccessToken(): Promise<void> {
  const tokens = loadTokens()
  if (!tokens?.refreshToken) throw new Error('No refresh token')

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
  })

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) throw new Error('Token refresh failed')

  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  saveTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? tokens.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000 - 60_000,
  })
}

export async function getValidToken(): Promise<string> {
  const tokens = loadTokens()
  if (!tokens) throw new Error('Not authenticated')
  if (Date.now() > tokens.expiresAt) await refreshAccessToken()
  return loadTokens()!.accessToken
}
