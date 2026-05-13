import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useStore } from '../state/store'

const REACTIVITY_LABEL: Record<string, string> = {
  steady: 'STEADY',
  subtle: 'SUBTLE',
  balanced: 'BALANCED',
  intense: 'INTENSE',
  frenetic: 'FRENETIC',
}

export function ModeHUD() {
  const reactivity = useStore((s) => s.devParams.reactivity)
  const prevReactivity = useRef(reactivity)
  const [key, setKey] = useState(0)
  const [label, setLabel] = useState(REACTIVITY_LABEL[reactivity] ?? reactivity.toUpperCase())

  useEffect(() => {
    if (reactivity !== prevReactivity.current) {
      prevReactivity.current = reactivity
      setLabel(REACTIVITY_LABEL[reactivity] ?? reactivity.toUpperCase())
      setKey((k) => k + 1)
    }
  }, [reactivity])

  if (key === 0) return null

  return (
    <div key={key} style={toast}>
      {label}
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
