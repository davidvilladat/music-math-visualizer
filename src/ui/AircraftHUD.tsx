import { useEffect, useState, type CSSProperties } from 'react'
import { useStore, AIRCRAFT_VARIANTS } from '../state/store'
import type { Renderer } from '../render/renderer'

interface Props {
  renderer: Renderer | null
}

type AircraftStatus = 'ready' | 'compiling' | 'failed' | 'idle'

export function AircraftHUD({ renderer }: Props) {
  const mode = useStore((state) => state.devParams.visualMode)
  const variant = useStore((state) => state.devParams.aircraftVariant)
  const [status, setStatus] = useState<AircraftStatus>('idle')

  useEffect(() => {
    if (mode !== 'airframe' || !renderer) return
    const update = () => setStatus(renderer.getAircraftVariantStatus(variant))
    update()
    const id = window.setInterval(update, 250)
    return () => window.clearInterval(id)
  }, [mode, renderer, variant])

  if (mode !== 'airframe') return null

  const name = AIRCRAFT_VARIANTS[variant] ?? `Variant ${variant + 1}`
  const count = AIRCRAFT_VARIANTS.length
  const statusLabel = status === 'ready' ? 'READY' : status === 'failed' ? 'FAILED' : 'LOADING'

  return (
    <div style={badge}>
      <span style={idx}>{String(variant + 1).padStart(2, '0')}/{count}</span>
      <span style={sep}>-</span>
      <span style={label}>{name}</span>
      <span style={{ ...statePill, ...(status === 'ready' ? readyPill : status === 'failed' ? failedPill : loadingPill) }}>
        {statusLabel}
      </span>
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

const statePill: CSSProperties = {
  marginLeft: 4,
  minWidth: 54,
  height: 16,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.12)',
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.08em',
}

const readyPill: CSSProperties = {
  background: 'rgba(34,197,94,0.12)',
  color: 'rgba(134,239,172,0.9)',
  borderColor: 'rgba(34,197,94,0.22)',
}

const loadingPill: CSSProperties = {
  background: 'rgba(14,165,233,0.12)',
  color: 'rgba(125,211,252,0.9)',
  borderColor: 'rgba(14,165,233,0.24)',
}

const failedPill: CSSProperties = {
  background: 'rgba(248,113,113,0.12)',
  color: 'rgba(252,165,165,0.95)',
  borderColor: 'rgba(248,113,113,0.24)',
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
