import type { SCWidget, SCSound } from './types'
import type { TrackInfo } from '../state/store'

const WIDGET_API = 'https://w.soundcloud.com/player/api.js'
let apiPromise: Promise<void> | null = null

function widgetUrl(trackUrl: string): string {
  return (
    'https://w.soundcloud.com/player/?' +
    new URLSearchParams({
      url:           trackUrl,
      auto_play:     'true',
      visual:        'false',
      show_artwork:  'false',
      hide_related:  'true',
      show_comments: 'false',
      show_user:     'false',
      show_reposts:  'false',
    })
  )
}

function parseSound(s: SCSound): TrackInfo {
  return {
    id:         s.permalink_url,
    source:     'soundcloud',
    title:      s.title,
    artist:     s.user?.username ?? 'Unknown',
    artworkUrl: s.artwork_url
      ? s.artwork_url.replace('-large', '-t500x500')
      : '',
    duration: s.duration,
  }
}

type SCEvent = 'trackChange' | 'play' | 'pause' | 'finish' | 'error'

export class SoundCloudPlayer {
  private iframe : HTMLIFrameElement
  private widget : SCWidget | null = null
  private cbs    = new Map<SCEvent, Set<() => void>>()

  currentTrack: TrackInfo | null = null
  isPlaying = false

  constructor() {
    this.iframe = document.createElement('iframe')
    Object.assign(this.iframe.style, {
      position:      'fixed',
      bottom:        '0',
      left:          '0',
      width:         '1px',
      height:        '1px',
      opacity:       '0',
      pointerEvents: 'none',
      border:        'none',
    })
    this.iframe.allow = 'autoplay'
    document.body.appendChild(this.iframe)
  }

  // ── public API ─────────────────────────────────────────────────────────────

  async load(url: string): Promise<void> {
    await this.loadApi()

    this.iframe.src = widgetUrl(url)
    this.widget = window.SC.Widget(this.iframe)

    await new Promise<void>((resolve, reject) => {
      const events = window.SC.Widget.Events
      let settled = false
      let timer = 0

      const finish = (done: () => void) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        this.widget?.unbind(events.READY)
        this.widget?.unbind(events.ERROR)
        done()
      }

      timer = window.setTimeout(() => {
        finish(() => reject(new Error('SoundCloud widget timed out')))
      }, 20_000)

      this.widget!.bind(events.READY, () => {
        finish(() => {
          this.bindWidgetEvents()
          resolve()
        })
      })
      this.widget!.bind(events.ERROR, () => {
        finish(() => reject(new Error('SoundCloud widget could not load this URL')))
      })
    })
  }

  play():  void { this.widget?.play() }
  pause(): void { this.widget?.pause() }
  next():  void { this.widget?.next() }
  prev():  void { this.widget?.prev() }
  seekTo(ms: number): void {
    if (!this.widget) return
    const duration = this.currentTrack?.duration ?? 0
    const bounded = duration > 0 ? Math.min(ms, duration) : ms
    this.widget.seekTo(Math.max(0, Math.floor(bounded)))
  }

  getPosition(): Promise<number> {
    return new Promise((resolve) => {
      if (!this.widget) resolve(0)
      else this.widget.getPosition((ms) => resolve(ms))
    })
  }

  getDuration(): Promise<number> {
    return new Promise((resolve) => {
      if (!this.widget) resolve(this.currentTrack?.duration ?? 0)
      else this.widget.getDuration((ms) => resolve(ms))
    })
  }

  on(event: SCEvent, cb: () => void):  void {
    if (!this.cbs.has(event)) this.cbs.set(event, new Set())
    this.cbs.get(event)!.add(cb)
  }

  off(event: SCEvent, cb: () => void): void {
    this.cbs.get(event)?.delete(cb)
  }

  destroy(): void {
    this.widget?.pause()
    this.iframe.remove()
    this.widget = null
    this.cbs.clear()
    this.currentTrack = null
    this.isPlaying = false
  }

  // ── private ────────────────────────────────────────────────────────────────

  private bindWidgetEvents(): void {
    const W = window.SC.Widget.Events

    this.widget!.bind(W.PLAY, () => {
      this.isPlaying = true
      this.widget!.getCurrentSound((s) => {
        this.currentTrack = parseSound(s)
        this.emit('trackChange')
      })
      this.emit('play')
    })

    this.widget!.bind(W.PAUSE,  () => { this.isPlaying = false; this.emit('pause') })
    this.widget!.bind(W.FINISH, () => { this.isPlaying = false; this.emit('finish') })
    this.widget!.bind(W.ERROR,  () => { this.isPlaying = false; this.emit('error') })
  }

  private emit(event: SCEvent): void {
    this.cbs.get(event)?.forEach((cb) => cb())
  }

  private loadApi(): Promise<void> {
    if (window.SC) return Promise.resolve()
    if (apiPromise) return apiPromise

    apiPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src     = WIDGET_API
      s.onload  = () => resolve()
      s.onerror = () => {
        apiPromise = null
        reject(new Error('Failed to load SoundCloud Widget API'))
      }
      document.head.appendChild(s)
    })
    return apiPromise
  }
}

// ── singleton ──────────────────────────────────────────────────────────────

let _player: SoundCloudPlayer | null = null

export function getScPlayer(): SoundCloudPlayer | null { return _player }

export function initScPlayer(): SoundCloudPlayer {
  _player?.destroy()
  _player = new SoundCloudPlayer()
  return _player
}

export function destroyScPlayer(): void {
  _player?.destroy()
  _player = null
}
