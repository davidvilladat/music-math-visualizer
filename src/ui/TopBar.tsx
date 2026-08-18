import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { AIRCRAFT_VARIANTS, useStore, VISUAL_MODE_META } from '../state/store'
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

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`
}

function parseSeekValue(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed) * 60_000

  const parts = trimmed.split(':').map((part) => Number(part))
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000
  return null
}

interface Props {
  onChangeSource?: () => void
  onSharePreset?: () => void
  shareLabel?: string | null
  onToggleRecord?: () => void
  recording?: boolean
  recordElapsedMs?: number
  recordBusy?: boolean
  recordNotice?: string | null
}

export function TopBar({
  onChangeSource,
  onSharePreset,
  shareLabel,
  onToggleRecord,
  recording = false,
  recordElapsedMs = 0,
  recordBusy = false,
  recordNotice = null,
}: Props) {
  const track = useStore((s) => s.currentTrack)
  const isPlaying = useStore((s) => s.isPlaying)
  const visualMode = useStore((s) => s.devParams.visualMode)
  const reactivity = useStore((s) => s.devParams.reactivity)
  const aircraftVariant = useStore((s) => s.devParams.aircraftVariant)
  const setDevParams = useStore((s) => s.setDevParams)

  const [visible, setVisible] = useState(true)
  const [positionMs, setPositionMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [seekValue, setSeekValue] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // The bar hides itself when the mouse settles, which is right for watching but
  // wrong mid-recording: the elapsed clock is the only sign the capture is live,
  // and Stop should never have to be hunted for. So recording pins it open.
  const resetTimer = useCallback(() => {
    setVisible(true)
    clearTimeout(timerRef.current)
    if (recording) return
    timerRef.current = setTimeout(() => setVisible(false), 3200)
  }, [recording])

  const holdOpen = useCallback(() => {
    setVisible(true)
    clearTimeout(timerRef.current)
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
  const soundCloudDuration = durationMs || track?.duration || 0
  const canSeekSoundCloud = Boolean(scPlayer)
  const art = track?.artworkUrl
  const activeMode = MODES.find((mode) => mode.key === visualMode) ?? MODES[0]

  useEffect(() => {
    if (!scPlayer) {
      setPositionMs(0)
      setDurationMs(0)
      setSeekValue('')
      return
    }

    let active = true
    const syncPosition = () => {
      void scPlayer.getPosition().then((ms) => {
        if (active) setPositionMs(ms)
      })
      void scPlayer.getDuration().then((ms) => {
        if (active && Number.isFinite(ms)) setDurationMs(ms)
      })
    }

    syncPosition()
    const id = window.setInterval(syncPosition, isPlaying ? 1000 : 2500)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [isPlaying, scPlayer, track?.artist, track?.title])

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

  const seekSoundCloud = () => {
    if (!scPlayer) return
    const parsed = parseSeekValue(seekValue)
    if (parsed === null) return
    const target = soundCloudDuration > 0 ? Math.min(parsed, soundCloudDuration) : parsed
    scPlayer.seekTo(target)
    setPositionMs(target)
    setSeekValue('')
  }

  return (
    <div
      style={{ ...bar, opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
      data-testid="top-bar"
      // Only movement reset the fade timer, so the bar used to disappear from
      // under a resting cursor. Hovering it holds it open until the pointer
      // leaves.
      onMouseEnter={holdOpen}
      onMouseLeave={resetTimer}
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
        {canSeekSoundCloud && (
          <div style={seekControls} data-testid="soundcloud-seek">
            <span style={timeLabel}>{formatTime(positionMs)}</span>
            <input
              aria-label="Jump to time"
              inputMode="decimal"
              placeholder="30:00"
              value={seekValue}
              onChange={(e) => setSeekValue(e.target.value)}
              onFocus={() => {
                setVisible(true)
                clearTimeout(timerRef.current)
              }}
              onBlur={resetTimer}
              onKeyDown={(e) => {
                if (e.key === 'Enter') seekSoundCloud()
                if (e.key === 'Escape') setSeekValue('')
              }}
              style={seekInput}
              title="Jump to minutes or mm:ss"
            />
            <button
              onClick={seekSoundCloud}
              disabled={!seekValue.trim()}
              style={iconButton}
              title="Jump to time"
            >
              <SeekIcon />
            </button>
            {soundCloudDuration > 0 && <span style={timeLabel}>{formatTime(soundCloudDuration)}</span>}
          </div>
        )}
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

        {visualMode === 'airframe' && (
          <select
            aria-label="Aircraft variant"
            value={aircraftVariant}
            onChange={(e) => setDevParams({ aircraftVariant: Number(e.target.value) })}
            style={aircraftSelect}
          >
            {AIRCRAFT_VARIANTS.map((name, index) => (
              <option key={name} value={index} style={{ background: '#070707', color: '#dbeafe' }}>
                {name}
              </option>
            ))}
          </select>
        )}

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

        {onToggleRecord && (
          <button
            onClick={onToggleRecord}
            disabled={recordBusy}
            data-testid="record-toggle"
            style={recording ? recordingButton : sourceButton}
            title={recording ? 'Stop recording and save the file' : 'Record the visuals with the playing audio'}
          >
            {recordBusy
              ? 'Saving...'
              : recording
                ? `■ ${formatTime(recordElapsedMs)}`
                : (recordNotice ?? '● Record')}
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

function SeekIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5 5h2v14H5zm4 12 8.5-5L9 7v10zm9-12h2v14h-2z" /></svg>
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

const seekControls: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  marginLeft: 6,
  paddingLeft: 8,
  borderLeft: '1px solid rgba(255,255,255,0.10)',
}

const timeLabel: CSSProperties = {
  minWidth: 42,
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  fontWeight: 700,
  color: 'rgba(255,255,255,0.46)',
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
}

const seekInput: CSSProperties = {
  width: 58,
  height: 28,
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 6,
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.86)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 700,
  padding: '0 7px',
  outline: 'none',
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

// Reads as armed rather than as one more control in the row.
const recordingButton: CSSProperties = {
  ...sourceButton,
  border: '1px solid rgba(239,68,68,0.55)',
  background: 'rgba(239,68,68,0.14)',
  color: '#fca5a5',
  minWidth: 74,
}

const reactivitySelect: CSSProperties = {
  ...modeSelect,
  maxWidth: 104,
  borderColor: 'rgba(255,255,255,0.14)',
  color: 'rgba(255,255,255,0.74)',
  background: 'rgba(255,255,255,0.06)',
}

const aircraftSelect: CSSProperties = {
  ...modeSelect,
  maxWidth: 176,
  borderColor: 'rgba(14,165,233,0.26)',
  color: 'rgba(191,219,254,0.92)',
  background: 'rgba(14,165,233,0.10)',
}
