import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useStore, VISUAL_MODE_META } from '../state/store'
import { getScPlayer } from '../soundcloud/SoundCloudPlayer'
import { getPlayer } from '../spotify/player'
import type { DevParams } from '../state/store'

type VisualMode = DevParams['visualMode']
type Reactivity = DevParams['reactivity']

const MODES = VISUAL_MODE_META

const REACTIVITY: { key: Reactivity; label: string }[] = [
  { key: 'steady', label: 'Steady' },
  { key: 'subtle', label: 'Subtle' },
  { key: 'balanced', label: 'Balanced' },
  { key: 'intense', label: 'Intense' },
  { key: 'frenetic', label: 'Frenetic' },
]

interface Props {
  onChangeSource?: () => void
  onSharePreset?: () => void
  shareLabel?: string | null
}

export function TopBar({ onChangeSource, onSharePreset, shareLabel }: Props) {
  const track = useStore((s) => s.currentTrack)
  const isPlaying = useStore((s) => s.isPlaying)
  const visualMode = useStore((s) => s.devParams.visualMode)
  const reactivity = useStore((s) => s.devParams.reactivity)
  const setDevParams = useStore((s) => s.setDevParams)

  const [visible, setVisible] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const resetTimer = useCallback(() => {
    setVisible(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), 3200)
  }, [])

  useEffect(() => {
    resetTimer()
    window.addEventListener('mousemove', resetTimer)
    window.addEventListener('touchstart', resetTimer)
    return () => {
      window.removeEventListener('mousemove', resetTimer)
      window.removeEventListener('touchstart', resetTimer)
      clearTimeout(timerRef.current)
    }
  }, [resetTimer])

  const scPlayer = getScPlayer()
  const spotifyPlayer = getPlayer()
  const hasTransport = Boolean(scPlayer || spotifyPlayer)
  const art = track?.artworkUrl
  const activeMode = MODES.find((mode) => mode.key === visualMode) ?? MODES[0]

  const prevTrack = () => {
    if (spotifyPlayer) void spotifyPlayer.previousTrack()
    else scPlayer?.prev()
  }

  const togglePlay = () => {
    if (spotifyPlayer) void spotifyPlayer.togglePlay()
    else if (isPlaying) scPlayer?.pause()
    else scPlayer?.play()
  }

  const nextTrack = () => {
    if (spotifyPlayer) void spotifyPlayer.nextTrack()
    else scPlayer?.next()
  }

  return (
    <div
      style={{ ...bar, opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
      data-testid="top-bar"
    >
      <div style={trackSection}>
        {art ? <img src={art} alt="" style={albumArt} /> : <div style={artPlaceholder} />}
        <div style={trackInfo}>
          <div style={trackName}>{track?.title ?? 'Not playing'}</div>
          <div style={artistName}>{track?.artist ?? 'Select a source'}</div>
        </div>
      </div>

      <div style={controls}>
        <button onClick={prevTrack} disabled={!hasTransport} style={iconButton} title="Previous">
          <PrevIcon />
        </button>
        <button onClick={togglePlay} disabled={!hasTransport} style={playButton} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button onClick={nextTrack} disabled={!hasTransport} style={iconButton} title="Next">
          <NextIcon />
        </button>
      </div>

      <div style={actions}>
        <span
          aria-hidden="true"
          style={{ ...modeSwatch, background: activeMode.accent, boxShadow: `0 0 14px ${activeMode.accent}` }}
        />
        <select
          aria-label="Visual mode"
          value={activeMode.key}
          onChange={(e) => setDevParams({ visualMode: e.target.value as VisualMode })}
          style={{
            ...modeSelect,
            borderColor: activeMode.accent,
            color: activeMode.accent,
            background: `color-mix(in srgb, ${activeMode.accent} 16%, rgba(0,0,0,0.76))`,
          }}
        >
          {MODES.map((mode) => (
            <option key={mode.key} value={mode.key} style={{ background: '#070707', color: mode.accent }}>
              {mode.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Reactivity"
          value={reactivity}
          onChange={(e) => setDevParams({ reactivity: e.target.value as Reactivity })}
          style={reactivitySelect}
        >
          {REACTIVITY.map((item) => (
            <option key={item.key} value={item.key} style={{ background: '#070707', color: '#f4f4f5' }}>
              {item.label}
            </option>
          ))}
        </select>

        {onSharePreset && (
          <button onClick={onSharePreset} style={sourceButton} title="Copy visual preset link">
            {shareLabel ?? 'Share'}
          </button>
        )}

        {onChangeSource && (
          <button onClick={onChangeSource} style={sourceButton} title="Change audio source">
            Source
          </button>
        )}
      </div>
    </div>
  )
}

function PlayIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
}

function PauseIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
}

function PrevIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
}

function NextIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
}

const bar: CSSProperties = {
  position: 'fixed',
  top: 12,
  left: 12,
  right: 12,
  height: 54,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
  alignItems: 'center',
  gap: 14,
  padding: '0 12px',
  background: 'rgba(3,3,3,0.72)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 8,
  color: 'var(--fg)',
  fontFamily: 'var(--font-ui)',
  zIndex: 10,
  transition: 'opacity 0.5s ease',
}

const trackSection: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
}

const albumArt: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 5,
  flexShrink: 0,
  objectFit: 'cover',
  background: '#111',
}

const artPlaceholder: CSSProperties = {
  ...albumArt,
  border: '1px solid rgba(255,255,255,0.08)',
}

const trackInfo: CSSProperties = {
  minWidth: 0,
}

const trackName: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const artistName: CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  color: 'rgba(255,255,255,0.42)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const controls: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}

const iconButton: CSSProperties = {
  width: 34,
  height: 34,
  display: 'grid',
  placeItems: 'center',
  border: 0,
  borderRadius: 7,
  background: 'transparent',
  color: 'rgba(255,255,255,0.52)',
  cursor: 'pointer',
}

const playButton: CSSProperties = {
  ...iconButton,
  background: 'rgba(255,255,255,0.11)',
  color: '#fff',
}

const actions: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  minWidth: 0,
}

const modeSwatch: CSSProperties = {
  width: 8,
  height: 24,
  borderRadius: 4,
  flexShrink: 0,
}

const modeSelect: CSSProperties = {
  height: 32,
  maxWidth: 144,
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 7,
  background: '#050505',
  color: 'rgba(255,255,255,0.78)',
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
  fontWeight: 650,
  padding: '0 8px',
  outline: 'none',
}

const sourceButton: CSSProperties = {
  height: 32,
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 7,
  background: 'transparent',
  color: 'rgba(255,255,255,0.54)',
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
  fontWeight: 650,
  padding: '0 10px',
  cursor: 'pointer',
}

const reactivitySelect: CSSProperties = {
  ...modeSelect,
  maxWidth: 104,
  borderColor: 'rgba(255,255,255,0.14)',
  color: 'rgba(255,255,255,0.74)',
  background: 'rgba(255,255,255,0.06)',
}
