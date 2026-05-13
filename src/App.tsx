import { useState, useCallback, useRef, useEffect } from 'react'
import { BrowserCheck }    from './ui/BrowserCheck'
import { SoundCloudGate }  from './ui/SoundCloudGate'
import { Canvas }          from './ui/Canvas'
import { TopBar }          from './ui/TopBar'
import { DevPanel }        from './ui/DevPanel'
import { DebugOverlay }    from './ui/DebugOverlay'
import { ModeHUD }         from './ui/ModeHUD'
import { DemoBanner }      from './ui/DemoBanner'
import { destroyScPlayer, initScPlayer } from './soundcloud/SoundCloudPlayer'
import { loadSpotifySDK, initPlayer, disconnectPlayer } from './spotify/player'
import { exchangeCodeForTokens } from './auth/authService'
import { isPremium } from './spotify/api'
import { useStore }        from './state/store'
import type { DevParams }  from './state/store'
import type { Renderer }   from './render/renderer'

type Stage = 'browser' | 'soundcloud' | 'active'
type VisualMode = DevParams['visualMode']

export function App() {
  const [stage, setStage]             = useState<Stage>('browser')
  const [scError, setScError]         = useState<string | null>(null)
  const [spotifyError, setSpotifyError] = useState<string | null>(null)
  const [spotifyLoading, setSpotifyLoading] = useState(false)
  const [isDemo, setIsDemo]           = useState(false)
  const rendererRef                   = useRef<Renderer | null>(null)
  const [renderer, setRenderer]       = useState<Renderer | null>(null)

  // Pending OAuth code — set on mount if URL contains ?code=
  const [pendingCode, setPendingCode] = useState<string | null>(null)

  const setTrack     = useStore((s) => s.setTrack)
  const setPlaying   = useStore((s) => s.setPlaying)
  const setDevParams = useStore((s) => s.setDevParams)
  const debugVisible = useStore((s) => s.debugVisible)

  // Detect Spotify OAuth callback on first mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')
    if (code) {
      // Clean up URL so a refresh doesn't re-try the consumed code
      window.history.replaceState({}, '', window.location.pathname)
      setStage('soundcloud')      // skip browser check, warm up canvas
      setPendingCode(code)
      setSpotifyLoading(true)
    }
  }, [])

  // Once renderer is ready AND we have a pending code, auto-start Spotify
  useEffect(() => {
    if (pendingCode && renderer) {
      void startSpotify(pendingCode)
      setPendingCode(null)
    }
  }, [pendingCode, renderer])  // eslint-disable-line react-hooks/exhaustive-deps

  const onRendererReady = useCallback((r: Renderer) => {
    rendererRef.current = r
    r.setCaptureEndedHandler(() => {
      disconnectPlayer()
      destroyScPlayer()
      setTrack(null)
      setPlaying(false)
      setIsDemo(false)
      setScError('Audio capture ended. Start again and keep "Share tab audio" enabled.')
      setSpotifyError(null)
      setStage('soundcloud')
    })
    setRenderer(r)
  }, [setPlaying, setTrack])

  // ── Spotify ───────────────────────────────────────────────────────────────

  const startSpotify = async (code?: string) => {
    const r = rendererRef.current
    if (!r) return
    setSpotifyError(null)
    setSpotifyLoading(true)
    setScError(null)
    r.stopDemo()
    destroyScPlayer()
    disconnectPlayer()
    setIsDemo(false)
    setTrack(null)
    setPlaying(false)
    try {
      // 1. Exchange OAuth code for tokens (only on fresh login)
      if (code) await exchangeCodeForTokens(code)

      // 2. Verify Premium — SDK won't connect without it
      const premium = await isPremium()
      if (!premium) throw new Error('Spotify Premium is required for the Web Playback SDK.')

      // 3. Capture tab audio for the visualizer
      await r.startAudio()

      // 4. Load Spotify SDK script + init player (wires player_state_changed → store)
      await loadSpotifySDK()
      await initPlayer()

      setStage('active')
    } catch (e) {
      r.stopAudio()
      disconnectPlayer()
      setSpotifyError(e instanceof Error ? e.message : 'Spotify connection failed')
    } finally {
      setSpotifyLoading(false)
    }
  }

  // ── SoundCloud ────────────────────────────────────────────────────────────

  const startSoundCloud = async (url: string) => {
    setScError(null)
    const r = rendererRef.current
    if (!r) return
    r.stopDemo()
    disconnectPlayer()
    setSpotifyError(null)
    setIsDemo(false)
    setTrack(null)
    setPlaying(false)
    try {
      await r.startAudio()
      const player = initScPlayer()
      await player.load(url)
      player.on('trackChange', () => { if (player.currentTrack) setTrack(player.currentTrack) })
      player.on('play',        () => setPlaying(true))
      player.on('pause',       () => setPlaying(false))
      player.on('finish',      () => setPlaying(false))
      player.on('error',       () => {
        r.stopAudio()
        destroyScPlayer()
        setScError('SoundCloud playback failed. Try another public track or playlist.')
        setPlaying(false)
        setStage('soundcloud')
      })
      if (player.currentTrack) setTrack(player.currentTrack)
      setStage('active')
    } catch (e) {
      r.stopAudio()
      destroyScPlayer()
      setScError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  // ── Demo ──────────────────────────────────────────────────────────────────

  const startDemo = (mode: VisualMode) => {
    const r = rendererRef.current
    if (!r) return
    r.stopAudio()
    disconnectPlayer()
    destroyScPlayer()
    r.startDemo()
    setTrack({
      title: 'Synthetic 120 BPM',
      artist: 'Demo engine',
      artworkUrl: '',
      duration: 0,
    })
    setPlaying(true)
    setDevParams({ visualMode: mode })
    setIsDemo(true)
    setStage('active')
  }

  // ── Change source ─────────────────────────────────────────────────────────

  const changeSource = () => {
    rendererRef.current?.stopDemo()
    rendererRef.current?.stopAudio()
    disconnectPlayer()
    destroyScPlayer()
    setTrack(null)
    setPlaying(false)
    setIsDemo(false)
    setScError(null)
    setSpotifyError(null)
    setStage('soundcloud')
  }

  return (
    <>
      {stage !== 'browser' && (
        <Canvas onRendererReady={onRendererReady} />
      )}

      {stage === 'browser' && <BrowserCheck onPass={() => setStage('soundcloud')} />}

      {stage === 'soundcloud' && (
        <SoundCloudGate
          onStart={startSoundCloud}
          onDemo={startDemo}
          onSpotify={() => void startSpotify()}
          error={scError}
          spotifyError={spotifyError}
          spotifyLoading={spotifyLoading}
          initialTab={pendingCode ? 'spotify' : 'soundcloud'}
        />
      )}

      {stage === 'active' && (
        <>
          <TopBar onChangeSource={changeSource} />
          {debugVisible && <DevPanel />}
          <DebugOverlay renderer={renderer} />
          <ModeHUD />
          {isDemo && <DemoBanner />}
        </>
      )}
    </>
  )
}
