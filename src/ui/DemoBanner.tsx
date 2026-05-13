import type { CSSProperties } from 'react'

export function DemoBanner() {
  return (
    <div style={banner}>
      <span style={dot} />
      DEMO MODE
    </div>
  )
}

const banner: CSSProperties = {
  position: 'fixed',
  bottom: 14,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(3,3,3,0.70)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  padding: '7px 10px',
  fontSize: 10,
  fontWeight: 700,
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.12em',
  color: 'rgba(255,255,255,0.44)',
  pointerEvents: 'none',
  zIndex: 20,
  display: 'flex',
  alignItems: 'center',
  gap: 7,
}

const dot: CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: 999,
  background: '#fff',
  opacity: 0.8,
  flexShrink: 0,
}
