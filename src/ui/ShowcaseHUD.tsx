import type { CSSProperties } from 'react'
import type { ChoreographyFrame, SongChoreography } from '../choreography/songChoreography'

interface Props {
  choreography: SongChoreography
  frame: ChoreographyFrame | null
}

export function ShowcaseHUD({ choreography, frame }: Props) {
  const actNumber = (frame?.actIndex ?? 0) + 1
  const act = frame?.act ?? choreography.acts[0]
  const progress = frame?.progress ?? 0

  return (
    <aside style={hud} data-testid="showcase-hud">
      <div style={topLine}>
        <span style={eyebrow}>CURATED LIVE SHOW</span>
        <span style={counter}>{actNumber}/{choreography.acts.length}</span>
      </div>
      <div style={title}>{choreography.artist} — {choreography.title}</div>
      <div style={actLine}>
        <span>{act.label}</span>
        <span>{act.mode.toUpperCase()}</span>
        <span>{(frame?.reactivity ?? act.reactivity).toUpperCase()}</span>
      </div>
      <div style={track}>
        <div style={{ ...fill, width: `${progress * 100}%` }} />
      </div>
    </aside>
  )
}

const hud: CSSProperties = {
  position: 'fixed',
  bottom: 18,
  left: '50%',
  width: 'min(390px, calc(100vw - 32px))',
  transform: 'translateX(-50%)',
  padding: '10px 12px 11px',
  borderRadius: 9,
  border: '1px solid rgba(255,255,255,0.11)',
  background: 'rgba(3,3,3,0.72)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  color: '#fff',
  fontFamily: 'var(--font-mono)',
  pointerEvents: 'none',
  zIndex: 22,
}

const topLine: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const eyebrow: CSSProperties = {
  color: 'rgba(255,255,255,0.42)',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.14em',
}

const counter: CSSProperties = {
  color: 'rgba(255,255,255,0.38)',
  fontSize: 10,
}

const title: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  fontWeight: 700,
}

const actLine: CSSProperties = {
  display: 'flex',
  gap: 10,
  marginTop: 4,
  color: 'rgba(255,255,255,0.58)',
  fontSize: 9,
  letterSpacing: '0.08em',
}

const track: CSSProperties = {
  height: 2,
  marginTop: 8,
  overflow: 'hidden',
  borderRadius: 2,
  background: 'rgba(255,255,255,0.10)',
}

const fill: CSSProperties = {
  height: '100%',
  borderRadius: 2,
  background: 'linear-gradient(90deg, #f43f5e, #bef264)',
}
