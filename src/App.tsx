import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserCheck } from './ui/BrowserCheck'
import { SoundCloudGate } from './ui/SoundCloudGate'
import { Canvas } from './ui/Canvas'
import { TopBar } from './ui/TopBar'
import { DevPanel } from './ui/DevPanel'
import { DebugOverlay } from './ui/DebugOverlay'
import { ModeHUD } from './ui/ModeHUD'
import { AircraftHUD } from './ui/AircraftHUD'
import { DemoBanner } from './ui/DemoBanner'
import { destroyScPlayer, initScPlayer } from './soundcloud/SoundCloudPlayer'
import { loadSpotifySDK, initPlayer, disconnectPlayer } from './spotify/player'
import { exchangeCodeForTokens } from './auth/authService'
import { isPremium } from './spotify/api'
import { useStore, type DevParams } from './state/store'
import { isEntryState, type SourceState } from './state/sourceState'
import {
  loadVisualPreset,
  parsePresetQuery,
  presetFromDevParams,
  saveVisualPreset,
  serializePresetQuery,
} from './state/visualPreset'
import type { Renderer } from './render/renderer'
import {
  SessionRecorder,
  downloadRecording,
  recordingFilename,
} from './capture/SessionRecorder'

type VisualMode = DevParams['visualMode']

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function cleanOAuthCallbackUrl(params: URLSearchParams): void {
  params.delete('code')
  params.delete('state')
  const nextQuery = params.toString()
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`
  window.history.replaceState({}, '', nextUrl)
}

export function App() {
  const [browserReady, setBrowserReady] = useState(false)
  const [sourceState, setSourceState] = useState<SourceState>({ status: 'idle', initialTab: 'soundcloud' })
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const [presetsReady, setPresetsReady] = useState(false)
  const [shareLabel, setShareLabel] = useState<string | null>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const [renderer, setRenderer] = useState<Renderer | null>(null)
  const recorderRef = useRef<SessionRecorder | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordBusy, setRecordBusy] = useState(false)
  const [recordElapsedMs, setRecordElapsedMs] = useState(0)
  const [recordNotice, setRecordNotice] = useState<string | null>(null)

  const setTrack = useStore((state) => state.setTrack)
  const setPlaying = useStore((state) => state.setPlaying)
  const setDevParams = useStore((state) => state.setDevParams)
  const debugVisible = useStore((state) => state.debugVisible)
  const visualMode = useStore((state) => state.devParams.visualMode)
  const reactivity = useStore((state) => state.devParams.reactivity)
  const aircraftVariant = useStore((state) => state.devParams.aircraftVariant)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const storedPreset = loadVisualPreset()
    const queryPreset = parsePresetQuery(params)
    setDevParams({ ...(storedPreset ?? {}), ...queryPreset })

    const code = params.get('code')
    if (code) {
      cleanOAuthCallbackUrl(params)
      setBrowserReady(true)
      setSourceState({ status: 'connecting', source: 'spotify', initialTab: 'spotify' })
      setPendingCode(code)
    }

    setPresetsReady(true)
  }, [setDevParams])

  useEffect(() => {
    if (!presetsReady) return
    saveVisualPreset({ visualMode, reactivity, aircraftVariant })
  }, [aircraftVariant, presetsReady, reactivity, visualMode])

  useEffect(() => {
    if (!shareLabel) return
    const timer = setTimeout(() => setShareLabel(null), 1800)
    return () => clearTimeout(timer)
  }, [shareLabel])

  const resetPlaybackState = useCallback(() => {
    setTrack(null)
    setPlaying(false)
  }, [setPlaying, setTrack])

  const stopAllSources = useCallback(() => {
    rendererRef.current?.stopDemo()
    rendererRef.current?.stopAudio()
    disconnectPlayer()
    destroyScPlayer()
    resetPlaybackState()
  }, [resetPlaybackState])

  const onRendererReady = useCallback((readyRenderer: Renderer) => {
    rendererRef.current = readyRenderer
    readyRenderer.setCaptureEndedHandler(() => {
      disconnectPlayer()
      destroyScPlayer()
      resetPlaybackState()
      setSourceState({
        status: 'capture-ended',
        initialTab: 'soundcloud',
        message: 'Audio capture ended. Start again and keep "Share tab audio" enabled.',
      })
    })
    setRenderer(readyRenderer)
  }, [resetPlaybackState])

  const startSpotify = useCallback(async (code?: string) => {
    const activeRenderer = rendererRef.current
    if (!activeRenderer) return

    setSourceState({ status: 'connecting', source: 'spotify', initialTab: 'spotify' })
    activeRenderer.stopDemo()
    destroyScPlayer()
    disconnectPlayer()
    resetPlaybackState()

    try {
      if (code) await exchangeCodeForTokens(code)

      const premium = await isPremium()
      if (!premium) throw new Error('Spotify Premium is required for browser playback.')

      await activeRenderer.startAudio()
      await loadSpotifySDK()
      await initPlayer()

      setSourceState({ status: 'active', source: 'spotify', isDemo: false })
    } catch (error) {
      activeRenderer.stopAudio()
      disconnectPlayer()
      setSourceState({
        status: 'error',
        source: 'spotify',
        initialTab: 'spotify',
        message: errorMessage(error, 'Spotify connection failed. Try reconnecting your account.'),
      })
    }
  }, [resetPlaybackState])

  useEffect(() => {
    if (!pendingCode || !renderer) return
    void startSpotify(pendingCode)
    setPendingCode(null)
  }, [pendingCode, renderer, startSpotify])

  const startSoundCloud = useCallback(async (url: string) => {
    const activeRenderer = rendererRef.current
    if (!activeRenderer) return

    setSourceState({ status: 'connecting', source: 'soundcloud', initialTab: 'soundcloud' })
    activeRenderer.stopDemo()
    disconnectPlayer()
    resetPlaybackState()

    try {
      await activeRenderer.startAudio()
      const player = initScPlayer()
      await player.load(url)
      player.on('trackChange', () => { if (player.currentTrack) setTrack(player.currentTrack) })
      player.on('play', () => setPlaying(true))
      player.on('pause', () => setPlaying(false))
      player.on('finish', () => setPlaying(false))
      player.on('error', () => {
        activeRenderer.stopAudio()
        destroyScPlayer()
        setPlaying(false)
        setSourceState({
          status: 'error',
          source: 'soundcloud',
          initialTab: 'soundcloud',
          message: 'SoundCloud playback failed. Try another public track or playlist.',
        })
      })
      if (player.currentTrack) setTrack(player.currentTrack)
      setSourceState({ status: 'active', source: 'soundcloud', isDemo: false })
    } catch (error) {
      activeRenderer.stopAudio()
      destroyScPlayer()
      setSourceState({
        status: 'error',
        source: 'soundcloud',
        initialTab: 'soundcloud',
        message: errorMessage(error, 'SoundCloud could not start. Try another public URL.'),
      })
    }
  }, [resetPlaybackState, setPlaying, setTrack])

  const startDemo = useCallback((mode: VisualMode) => {
    const activeRenderer = rendererRef.current
    if (!activeRenderer) return

    activeRenderer.stopAudio()
    disconnectPlayer()
    destroyScPlayer()
    activeRenderer.startDemo()
    setTrack({
      id: 'synthetic-120',
      source: 'demo',
      title: 'Synthetic 120 BPM',
      artist: 'Demo engine',
      artworkUrl: '',
      duration: 0,
    })
    setPlaying(true)
    setDevParams({ visualMode: mode })
    setSourceState({ status: 'active', source: 'demo', isDemo: true })
  }, [setDevParams, setPlaying, setTrack])

  const changeSource = useCallback(() => {
    stopAllSources()
    setSourceState({ status: 'idle', initialTab: 'soundcloud' })
  }, [stopAllSources])

  // The elapsed readout is the only sign the capture is still running, so it
  // ticks off a timer rather than off the render loop.
  useEffect(() => {
    if (!recording) return
    const id = window.setInterval(() => {
      setRecordElapsedMs(recorderRef.current?.elapsedMs ?? 0)
    }, 250)
    return () => window.clearInterval(id)
  }, [recording])

  useEffect(() => () => recorderRef.current?.dispose(), [])

  const flashRecordNotice = useCallback((message: string) => {
    setRecordNotice(message)
    window.setTimeout(() => setRecordNotice(null), 4000)
  }, [])

  const toggleRecord = useCallback(async () => {
    const activeRenderer = rendererRef.current
    if (!activeRenderer || recordBusy) return

    const recorder = recorderRef.current ?? new SessionRecorder()
    recorderRef.current = recorder

    // Branch on what the button is showing, not on the recorder's own state. If
    // the encoder died on its own the recorder reads as inactive while the UI
    // still shows a clock, and trusting the recorder there starts a second take
    // instead of saving the first. stop() copes with an already-inactive
    // recorder and still returns whatever was captured.
    if (recording) {
      setRecordBusy(true)
      try {
        const result = await recorder.stop()
        if (!result || result.blob.size === 0) {
          // An empty file is worse than none: it looks saved until you open it.
          flashRecordNotice(result?.failure ?? 'Nothing captured')
        } else {
          const mode = useStore.getState().devParams.visualMode
          downloadRecording(result.blob, recordingFilename(mode, new Date(), result.format.extension))
          if (result.failure) {
            // Salvaged rather than clean: say so, since the take is short.
            flashRecordNotice('Saved (cut short)')
          } else {
            // Demo mode has no audio to capture, so say so rather than let a
            // silent file look like a bug.
            flashRecordNotice(result.hadAudio ? 'Saved' : 'Saved (no audio)')
          }
        }
      } finally {
        // Drop back to display resolution whatever happened, or the visualizer
        // keeps paying for the oversized buffer.
        activeRenderer.setRenderScale(1)
        setRecording(false)
        setRecordBusy(false)
        setRecordElapsedMs(0)
      }
      return
    }

    const { recordScale, recordFps } = useStore.getState().devParams
    activeRenderer.setRenderScale(recordScale)
    try {
      recorder.start({
        canvas: activeRenderer.canvasElement,
        audioTracks: activeRenderer.captureAudioTracks,
        fps: recordFps,
      })
      setRecordElapsedMs(0)
      setRecording(true)
    } catch (error) {
      activeRenderer.setRenderScale(1)
      // A failed recording must not tear down a working session, so this
      // surfaces on the button rather than through the source-error path.
      flashRecordNotice(errorMessage(error, 'Unavailable'))
    }
  }, [recordBusy, recording, flashRecordNotice])

  const sharePreset = useCallback(async () => {
    const query = serializePresetQuery(presetFromDevParams(useStore.getState().devParams))
    const url = `${window.location.origin}${window.location.pathname}${query}`
    window.history.replaceState({}, '', `${window.location.pathname}${query}`)

    try {
      await navigator.clipboard?.writeText(url)
      setShareLabel('Copied')
    } catch {
      setShareLabel('Link ready')
    }
  }, [])

  if (!browserReady) {
    return <BrowserCheck onPass={() => setBrowserReady(true)} />
  }

  const showEntry = isEntryState(sourceState)
  const isDemo = sourceState.status === 'active' && sourceState.isDemo

  return (
    <>
      <Canvas onRendererReady={onRendererReady} />

      {showEntry && (
        <SoundCloudGate
          sourceState={sourceState}
          onStart={startSoundCloud}
          onDemo={startDemo}
          onSpotify={() => void startSpotify()}
        />
      )}

      {sourceState.status === 'active' && (
        <>
          <TopBar
            onChangeSource={changeSource}
            onSharePreset={() => void sharePreset()}
            shareLabel={shareLabel}
            onToggleRecord={() => void toggleRecord()}
            recording={recording}
            recordElapsedMs={recordElapsedMs}
            recordBusy={recordBusy}
            recordNotice={recordNotice}
          />
          {debugVisible && <DevPanel />}
          <DebugOverlay renderer={renderer} />
          <ModeHUD />
          <AircraftHUD renderer={renderer} />
          {isDemo && <DemoBanner />}
        </>
      )}
    </>
  )
}
