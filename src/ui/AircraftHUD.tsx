import type { CSSProperties } from 'react'
import { useStore, AIRCRAFT_VARIANTS } from '../state/store'

// Persistent badge showing the active airframe blueprint, since cycling 'P'
// through a dozen variants is otherwise blind.
export function AircraftHUD() {
  const mode = useStore((s) => s.devParams.visualMode)
  const variant = useStore((s) => s.devParams.aircraftVariant)

  if (mode !== 'airframe') return null

  const name = AIRCRAFT_VARIANTS[variant] ?? `Variant ${variant + 1}`
  const count = AIRCRAFT_VARIANTS.length

  return (
    <div style={badge}>
      <span style={idx}>{String(variant + 1).padStart(2, '0')}/{count}</span>
      <span style={sep}>·</span>
      <span style={label}>{name}</span>
      <span style={hint}>P</span>
    </div>
  )
}

const badge: CSSProperties = {
  position: 'fixed',
  bottom: 16,
  left: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: 'rgba(3,3,3,0.7)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  padding: '7px 12px',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.08em',
  color: '#fff',
  zIndex: 60,
  pointerEvents: 'none',
}

const idx: CSSProperties = {
  color: 'rgba(120,200,255,0.92)',
  fontWeight: 700,
}

const sep: CSSProperties = {
  color: 'rgba(255,255,255,0.25)',
}

const label: CSSProperties = {
  fontWeight: 700,
  letterSpacing: '0.1em',
}

const hint: CSSProperties = {
  marginLeft: 6,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 16,
  height: 16,
  padding: '0 4px',
  borderRadius: 4,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.14)',
  fontSize: 10,
  fontWeight: 700,
  color: 'rgba(255,255,255,0.45)',
}
