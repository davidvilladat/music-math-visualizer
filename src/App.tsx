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
          <TopBar onChangeSource={changeSource} onSharePreset={() => void sharePreset()} shareLabel={shareLabel} />
          {debugVisible && <DevPanel />}
          <DebugOverlay renderer={renderer} />
          <ModeHUD />
          <AircraftHUD />
          {isDemo && <DemoBanner />}
        </>
      )}
    </>
  )
}
