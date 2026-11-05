import { useState, type CSSProperties } from 'react'
import { AIRCRAFT_VARIANTS, VISUAL_MODE_META, type DevParams, type TrackInfo } from '../state/store'
import { Group, IOS, PickerList, Row, Sheet, type PickerOption } from './ios/Sheet'

type VisualMode = DevParams['visualMode']
type Reactivity = DevParams['reactivity']
type Page = 'root' | 'mode' | 'aircraft' | 'reactivity'

export const REACTIVITY_OPTIONS: PickerOption<Reactivity>[] = [
  { value: 'steady', label: 'Steady' },
  { value: 'subtle', label: 'Subtle' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'intense', label: 'Intense' },
  { value: 'frenetic', label: 'Frenetic' },
]

const toOption = (mode: (typeof VISUAL_MODE_META)[number]): PickerOption<VisualMode> => ({
  value: mode.key,
  label: mode.label,
  dot: mode.accent,
})

/** Scenes first (few, recognisable, Aviation among them), then the formula set. */
export const SCENE_OPTIONS = VISUAL_MODE_META.filter((m) => m.sceneFamily !== 'formula').map(toOption)
export const FORMULA_OPTIONS = VISUAL_MODE_META.filter((m) => m.sceneFamily === 'formula').map(toOption)

const AIRCRAFT_OPTIONS: PickerOption<number>[] = AIRCRAFT_VARIANTS.map((name, index) => ({ value: index, label: name }))

const PAGE_TITLES: Record<Page, string> = {
  root: 'Settings',
  mode: 'Visual',
  aircraft: 'Aircraft',
  reactivity: 'Reactivity',
}

interface Props {
  track: TrackInfo | null
  visible: boolean
  isPlaying: boolean
  hasTransport: boolean
  onPrev: () => void
  onTogglePlay: () => void
  onNext: () => void
  visualMode: VisualMode
  aircraftVariant: number
  reactivity: Reactivity
  setDevParams: (params: Partial<DevParams>) => void
  onSharePreset?: () => void
  shareLabel?: string | null
  onToggleRecord?: () => void
  recording: boolean
  recordBusy: boolean
  recordNotice: string | null
  recordElapsed: string
  onChangeSource?: () => void
  /** The sheet holds the bar open; closing it restarts the auto-hide timer. */
  onSheetChange: (open: boolean) => void
}

/**
 * The phone layout of the top bar: track, transport and one Settings button
 * that opens an iOS-style sheet with every selector and action.
 */
export function CompactBar(props: Props) {
  const {
    track, visible, isPlaying, hasTransport, onPrev, onTogglePlay, onNext,
    visualMode, aircraftVariant, reactivity, setDevParams,
    onSharePreset, shareLabel, onToggleRecord, recording, recordBusy, recordNotice, recordElapsed,
    onChangeSource, onSheetChange,
  } = props

  const [open, setOpen] = useState(false)
  const [page, setPage] = useState<Page>('root')
  const activeMode = VISUAL_MODE_META.find((m) => m.key === visualMode) ?? VISUAL_MODE_META[0]

  const openSheet = () => {
    setPage('root')
    setOpen(true)
    onSheetChange(true)
  }
  const closeSheet = () => {
    setOpen(false)
    onSheetChange(false)
  }
  const run = (action?: () => void) => () => {
    closeSheet()
    action?.()
  }

  const recordLabel = recordBusy
    ? 'Saving…'
    : recording
      ? `Stop Recording  ${recordElapsed}`
      : 'Record Video'

  return (
    <>
      <div
        style={{ ...bar, opacity: visible || open ? 1 : 0, pointerEvents: visible || open ? 'auto' : 'none' }}
        data-testid="top-bar"
      >
        {track?.artworkUrl
          ? <img src={track.artworkUrl} alt="" style={art} />
          : <div style={{ ...art, background: `linear-gradient(135deg, ${activeMode.accent}, #111)` }} />}
        <div style={info}>
          <div style={title}>{track?.title ?? 'Not playing'}</div>
          <div style={subtitle}>{recordNotice ?? `${track?.artist ?? 'Select a source'} · ${activeMode.label}`}</div>
        </div>

        {hasTransport && (
          <div style={transport}>
            <button type="button" onClick={onPrev} style={roundButton} aria-label="Previous"><PrevIcon /></button>
            <button type="button" onClick={onTogglePlay} style={{ ...roundButton, background: 'rgba(255,255,255,0.16)' }} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button type="button" onClick={onNext} style={roundButton} aria-label="Next"><NextIcon /></button>
          </div>
        )}

        {recording && onToggleRecord && (
          <button type="button" onClick={onToggleRecord} style={recPill} data-testid="record-toggle" aria-label="Stop recording">
            <span style={recDot} /> {recordElapsed}
          </button>
        )}

        <button type="button" onClick={openSheet} style={roundButton} aria-label="Settings" data-testid="open-settings">
          <SlidersIcon />
        </button>
      </div>

      <Sheet
        open={open}
        title={PAGE_TITLES[page]}
        onClose={closeSheet}
        onBack={page === 'root' ? undefined : () => setPage('root')}
        backLabel="Settings"
        maxHeight="max(64%, min(100% - 20px, 340px))"
        testId="settings-sheet"
      >
        {page === 'root' && (
          <>
            <Group header="Visuals">
              <Row label="Visual" value={activeMode.label} dot={activeMode.accent} chevron onClick={() => setPage('mode')} testId="row-visual" />
              {visualMode === 'airframe' && (
                <Row label="Aircraft" value={AIRCRAFT_VARIANTS[aircraftVariant]} chevron onClick={() => setPage('aircraft')} testId="row-aircraft" />
              )}
              <Row
                label="Reactivity"
                value={REACTIVITY_OPTIONS.find((o) => o.value === reactivity)?.label}
                chevron
                onClick={() => setPage('reactivity')}
                testId="row-reactivity"
              />
            </Group>
            <Group footer={onToggleRecord ? 'Recording saves the visuals and the audio as a video file.' : undefined}>
              {onSharePreset && (
                <Row label={shareLabel === 'Copied' ? 'Link Copied' : 'Share Preset Link'} tone="tint" onClick={onSharePreset} />
              )}
              {onToggleRecord && (
                <Row
                  label={recordLabel}
                  tone={recording ? 'destructive' : 'tint'}
                  disabled={recordBusy}
                  onClick={run(onToggleRecord)}
                  testId="row-record"
                />
              )}
              {onChangeSource && <Row label="Change Source" tone="tint" onClick={run(onChangeSource)} testId="row-source" />}
            </Group>
          </>
        )}

        {page === 'mode' && (
          <>
            <PickerList header="Scenes" options={SCENE_OPTIONS} value={visualMode} onSelect={(v) => setDevParams({ visualMode: v })} testIdPrefix="mode" />
            <PickerList header="Formulas" options={FORMULA_OPTIONS} value={visualMode} onSelect={(v) => setDevParams({ visualMode: v })} testIdPrefix="mode" />
          </>
        )}

        {page === 'aircraft' && (
          <PickerList options={AIRCRAFT_OPTIONS} value={aircraftVariant} onSelect={(v) => setDevParams({ aircraftVariant: v })} testIdPrefix="aircraft" />
        )}

        {page === 'reactivity' && (
          <PickerList options={REACTIVITY_OPTIONS} value={reactivity} onSelect={(v) => setDevParams({ reactivity: v })} testIdPrefix="reactivity" />
        )}
      </Sheet>
    </>
  )
}

function PlayIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
}
function PauseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
}
function PrevIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
}
function NextIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
}
/** SF Symbols "slider.horizontal.3" lookalike. */
function SlidersIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" />
    </svg>
  )
}

const bar: CSSProperties = {
  position: 'fixed',
  top: 'max(10px, env(safe-area-inset-top))',
  left: 'max(10px, env(safe-area-inset-left))',
  right: 'max(10px, env(safe-area-inset-right))',
  margin: '0 auto',
  maxWidth: 560,
  height: 56,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '0 8px 0 8px',
  // iOS "system thick material", dark
  background: 'rgba(30,30,32,0.72)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '0.5px solid rgba(255,255,255,0.12)',
  borderRadius: 18,
  color: IOS.label,
  fontFamily: IOS.font,
  zIndex: 10,
  transition: 'opacity 0.4s ease',
}

const art: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 9,
  flexShrink: 0,
  objectFit: 'cover',
}

const info: CSSProperties = { flex: 1, minWidth: 0 }

const title: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: '-0.02em',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const subtitle: CSSProperties = {
  marginTop: 1,
  fontSize: 13,
  color: IOS.secondary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const transport: CSSProperties = { display: 'flex', alignItems: 'center', gap: 2 }

const roundButton: CSSProperties = {
  width: 40,
  height: 40,
  flexShrink: 0,
  display: 'grid',
  placeItems: 'center',
  border: 0,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.08)',
  color: IOS.label,
  cursor: 'pointer',
}

const recPill: CSSProperties = {
  height: 32,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 10px',
  border: 0,
  borderRadius: 999,
  background: 'rgba(255,69,58,0.2)',
  color: '#ff6961',
  fontFamily: IOS.font,
  fontSize: 13,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  flexShrink: 0,
}

const recDot: CSSProperties = { width: 8, height: 8, borderRadius: 999, background: IOS.destructive }
