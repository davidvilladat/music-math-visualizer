import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useStore } from '../state/store'

const LABEL: Record<string, string> = {
  fluid: 'FLUID',
  streamlines: 'STREAMLINES',
  hybrid: 'HYBRID',
  electric: 'ELECTRIC',
  neon: 'NEON',
  nova: 'NOVA',
  formula: 'FORMULA',
  feather: 'FEATHER',
  pulse: 'PULSE',
}

export function ModeHUD() {
  const mode = useStore((s) => s.devParams.visualMode)
  const prevMode = useRef(mode)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (mode !== prevMode.current) {
      prevMode.current = mode
      setKey((k) => k + 1)
    }
  }, [mode])

  if (key === 0) return null

  return (
    <div key={key} style={toast}>
      {LABEL[mode] ?? mode.toUpperCase()}
    </div>
  )
}

const toast: CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translateX(-50%) translateY(-50%)',
  background: 'rgba(3,3,3,0.82)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  padding: '10px 18px',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.12em',
  color: '#fff',
  zIndex: 100,
  pointerEvents: 'none',
  animation: 'modeToast 1.6s ease forwards',
}
