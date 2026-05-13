import { useCallback, useEffect, useRef, useState } from 'react'

const HINTS = [
  { key: 'V',   label: 'cycle mode' },
  { key: 'D',   label: 'debug panel' },
]

const HIDE_DELAY   = 4000  // ms after mouse stops
const INITIAL_HOLD = 6000  // ms to stay visible on first mount

export function KeyHints() {
  const [visible, setVisible] = useState(true)
  const timerRef   = useRef<ReturnType<typeof setTimeout>>()
  const mountedRef = useRef(false)

  const resetTimer = useCallback((delay = HIDE_DELAY) => {
    setVisible(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), delay)
  }, [])

  useEffect(() => {
    // Hold a bit longer on first mount so the hint is noticed
    if (!mountedRef.current) {
      mountedRef.current = true
      resetTimer(INITIAL_HOLD)
    }
    const handleMouseMove = () => resetTimer()
    const handleTouchStart = () => resetTimer()
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchstart', handleTouchStart)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchstart', handleTouchStart)
      clearTimeout(timerRef.current)
    }
  }, [resetTimer])

  return (
    <div style={{ ...wrap, opacity: visible ? 1 : 0 }}>
      <span style={modeHint}>Click chips above to switch mode</span>
      <span style={divider}>·</span>
      {HINTS.map(({ key, label }) => (
        <span key={key} style={item}>
          <kbd style={kbdStyle}>{key}</kbd>
          <span style={labelStyle}>{label}</span>
        </span>
      ))}
    </div>
  )
}

const wrap: React.CSSProperties = {
  position:      'fixed',
  bottom:        14,
  left:          '50%',
  transform:     'translateX(-50%)',
  display:       'flex',
  alignItems:    'center',
  gap:           14,
  zIndex:        5,
  pointerEvents: 'none',
  transition:    'opacity 0.6s ease',
  fontFamily:    'var(--font-ui)',
  whiteSpace:    'nowrap',
}

const modeHint: React.CSSProperties = {
  fontSize:      11,
  color:         'rgba(255,255,255,0.22)',
  letterSpacing: '0.04em',
}

const divider: React.CSSProperties = {
  color:   'rgba(255,255,255,0.14)',
  fontSize: 14,
}

const item: React.CSSProperties = {
  display:    'flex',
  alignItems: 'center',
  gap:        5,
}

const kbdStyle: React.CSSProperties = {
  display:        'inline-flex',
  alignItems:     'center',
  justifyContent: 'center',
  width:          20,
  height:         20,
  background:     'rgba(255,255,255,0.07)',
  border:         '1px solid rgba(255,255,255,0.12)',
  borderRadius:   4,
  fontSize:       11,
  fontFamily:     'var(--font-mono)',
  fontWeight:     700,
  color:          'rgba(255,255,255,0.45)',
}

const labelStyle: React.CSSProperties = {
  fontSize:      11,
  color:         'rgba(255,255,255,0.28)',
  letterSpacing: '0.04em',
}
