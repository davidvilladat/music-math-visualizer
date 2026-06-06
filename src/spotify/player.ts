import type { SpotifyPlayer, SDKPlayerState } from './types'
import { getValidToken } from '../auth/authService'
import { transferPlayback } from './api'
import { useStore } from '../state/store'

// ── SDK loader ────────────────────────────────────────────────────────────────

let sdkLoaded = false
let sdkPromise: Promise<void> | null = null

export function loadSpotifySDK(): Promise<void> {
  if (sdkLoaded || window.Spotify?.Player) {
    sdkLoaded = true
    return Promise.resolve()
  }

  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise((resolve, reject) => {
    let settled = false
    let timeout = 0

    const done = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      sdkLoaded = true
      resolve()
    }

    const fail = (message: string) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      sdkPromise = null
      reject(new Error(message))
    }

    timeout = window.setTimeout(() => {
      fail('Spotify Web Playback SDK timed out while loading.')
    }, 15_000)

    const previousReady = window.onSpotifyWebPlaybackSDKReady
    window.onSpotifyWebPlaybackSDKReady = () => {
      previousReady?.()
      done()
    }

    let script = document.querySelector<HTMLScriptElement>('script[src*="spotify-player"]')
    if (!script) {
      script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      document.head.appendChild(script)
    }
    script.addEventListener('error', () => fail('Failed to load Spotify Web Playback SDK.'), { once: true })
  })

  return sdkPromise
}

let playerInstance: SpotifyPlayer | null = null

export function initPlayer(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.Spotify?.Player) {
      reject(new Error('Spotify Web Playback SDK is not ready'))
      return
    }

    const existing = playerInstance
    if (existing) {
      existing.disconnect()
      playerInstance = null
    }

    const player = new window.Spotify.Player({
      name: 'Spotify Visualizer',
      getOAuthToken: (cb) => {
        getValidToken().then(cb).catch(reject)
      },
      volume: 0.8,
    })

    player.addListener('initialization_error', ({ message }) =>
      reject(new Error(`SDK init: ${message}`))
    )
    player.addListener('authentication_error', ({ message }) =>
      reject(new Error(`SDK auth: ${message}`))
    )
    player.addListener('account_error', ({ message }) =>
      reject(new Error(`SDK account (Premium required): ${message}`))
    )

    player.addListener('ready', async ({ device_id }) => {
      playerInstance = player
      try {
        await transferPlayback(device_id)
      } catch {
        // non-fatal — user can transfer manually
      }
      resolve(device_id)
    })

    player.addListener('not_ready', ({ device_id }) => {
      console.warn('SDK player not ready, device:', device_id)
    })

    player.addListener('player_state_changed', (state: SDKPlayerState | null) => {
      if (!state) return
      const track = state.track_window.current_track
      useStore.getState().setTrack({
        title:      track.name,
        artist:     track.artists.map((a) => a.name).join(', '),
        artworkUrl: track.album.images[0]?.url ?? '',
        duration:   track.duration_ms,
      })
      useStore.getState().setPlaying(!state.paused)
    })

    player.connect().then((ok) => {
      if (!ok) reject(new Error('SDK connect() returned false'))
    })
  })
}

export function getPlayer(): SpotifyPlayer | null {
  return playerInstance
}

export function disconnectPlayer(): void {
  playerInstance?.disconnect()
  playerInstance = null
}
