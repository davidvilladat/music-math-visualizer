// SoundCloud Widget API globals
export interface SCSound {
  title: string
  user: { username: string }
  artwork_url: string | null
  duration: number       // ms
  permalink_url: string
}

export interface SCWidget {
  bind(event: string, cb: (...args: unknown[]) => void): void
  unbind(event: string): void
  play(): void
  pause(): void
  next(): void
  prev(): void
  seekTo(ms: number): void
  getCurrentSound(cb: (sound: SCSound) => void): void
  getDuration(cb: (ms: number) => void): void
  getPosition(cb: (ms: number) => void): void
  isPaused(cb: (paused: boolean) => void): void
  load(url: string, options?: Record<string, unknown>): void
}

declare global {
  interface Window {
    SC: {
      Widget: {
        (iframe: HTMLIFrameElement): SCWidget
        Events: {
          READY:         string
          PLAY:          string
          PLAY_PROGRESS: string
          PAUSE:         string
          FINISH:        string
          ERROR:         string
        }
      }
    }
  }
}
