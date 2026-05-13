import type { SpotifyUser, SpotifyPlaybackState } from './types'
import { getValidToken } from '../auth/authService'

export class SpotifyApiError extends Error {
  constructor(public status: number, path: string) {
    super(`Spotify API ${path} → ${status}`)
  }
}

async function spotifyFetch<T>(path: string): Promise<T> {
  const token = await getValidToken()
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new SpotifyApiError(res.status, path)
  return res.json() as Promise<T>
}

export async function getMe(): Promise<SpotifyUser> {
  return spotifyFetch<SpotifyUser>('/me')
}

export async function isPremium(): Promise<boolean> {
  const user = await getMe()
  return user.product === 'premium'
}

export async function getPlaybackState(): Promise<SpotifyPlaybackState | null> {
  const token = await getValidToken()
  const res = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 204) return null
  if (!res.ok) throw new Error(`Spotify playback state → ${res.status}`)
  return res.json() as Promise<SpotifyPlaybackState>
}

export async function transferPlayback(deviceId: string): Promise<void> {
  const token = await getValidToken()
  const res = await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ device_ids: [deviceId], play: true }),
  })
  if (!res.ok && res.status !== 204) throw new Error(`Spotify transfer playback -> ${res.status}`)
}
