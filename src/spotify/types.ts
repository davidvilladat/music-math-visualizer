export interface SpotifyTrack {
  id: string
  name: string
  artists: { name: string }[]
  album: {
    name: string
    images: { url: string; width: number; height: number }[]
  }
  duration_ms: number
}

export interface SpotifyPlaybackState {
  is_playing: boolean
  progress_ms: number
  item: SpotifyTrack | null
  device: {
    id: string
    name: string
    volume_percent: number
  } | null
}

export interface SpotifyUser {
  id: string
  display_name: string
  product: 'premium' | 'free' | 'open'
}

// Spotify Web Playback SDK types
declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void
    Spotify?: SpotifySDK
  }
}

interface SpotifySDK {
  Player: new (options: SpotifyPlayerOptions) => SpotifyPlayer
}

interface SpotifyPlayerOptions {
  name: string
  getOAuthToken: (cb: (token: string) => void) => void
  volume?: number
}

export interface SpotifyPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  addListener(event: 'ready', cb: (data: { device_id: string }) => void): void
  addListener(event: 'not_ready', cb: (data: { device_id: string }) => void): void
  addListener(event: 'player_state_changed', cb: (state: SDKPlayerState | null) => void): void
  addListener(event: 'initialization_error', cb: (data: { message: string }) => void): void
  addListener(event: 'authentication_error', cb: (data: { message: string }) => void): void
  addListener(event: 'account_error', cb: (data: { message: string }) => void): void
  removeListener(event: string): void
  togglePlay(): Promise<void>
  previousTrack(): Promise<void>
  nextTrack(): Promise<void>
  seek(positionMs: number): Promise<void>
  setVolume(volume: number): Promise<void>
  getCurrentState(): Promise<SDKPlayerState | null>
}

export interface SDKPlayerState {
  paused: boolean
  position: number
  duration: number
  track_window: {
    current_track: {
      id: string
      name: string
      artists: { name: string }[]
      album: {
        name: string
        images: { url: string }[]
      }
      duration_ms: number
    }
  }
}
