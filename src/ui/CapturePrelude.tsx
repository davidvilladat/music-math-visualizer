import { useState } from 'react'

interface Props {
  onStart: () => Promise<void>
  error: string | null
}

export function CapturePrelude({ onStart, error }: Props) {
  const [loading, setLoading] = useState(false)

  const handleStart = async () => {
    setLoading(true)
    try { await onStart() } finally { setLoading(false) }
  }

  return (
    <div style={overlay}>
      <div style={card}>
        {/* Icon */}
        <div style={iconWrap}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>

        <h2 style={title}>One more step</h2>
        <p style={body}>
          Chrome will ask you to share a tab. Select <strong style={strong}>this tab</strong> and
          enable the <strong style={strong}>"Share tab audio"</strong> checkbox so the
          visualizer can hear your music.
        </p>

        {/* Steps */}
        <ol style={steps}>
          {['Click "Start Visualization" below', 'Choose "Chrome Tab" → this tab', 'Check "Share tab audio" ✓', 'Hit Share'].map((s, i) => (
            <li key={i} style={step}>
              <span style={stepNum}>{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>

        {error && <p style={errorMsg}>{error}</p>}

        <button
          onClick={() => void handleStart()}
          disabled={loading}
          style={{ ...btn, opacity: loading ? 0.65 : 1 }}
        >
          {loading ? 'Starting…' : 'Start Visualization'}
        </button>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position:       'fixed',
  inset:          0,
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  background:     '#000',
  fontFamily:     'var(--font-ui)',
  animation:      'fadeUp 0.5s ease both',
}

const card: React.CSSProperties = {
  maxWidth:     440,
  width:        '90%',
  background:   '#0d0d0d',
  borderRadius: 16,
  padding:      '36px 32px',
  border:       '1px solid var(--border)',
  display:      'flex',
  flexDirection: 'column',
  gap:          16,
  boxShadow:    '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
}

const iconWrap: React.CSSProperties = {
  width:          52,
  height:         52,
  borderRadius:   14,
  background:     'rgba(0,212,255,0.08)',
  border:         '1px solid rgba(0,212,255,0.2)',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  marginBottom:   4,
}

const title: React.CSSProperties = {
  fontSize:   22,
  fontWeight: 700,
  color:      'var(--fg)',
  letterSpacing: '-0.01em',
}

const body: React.CSSProperties = {
  fontSize:   14,
  color:      'var(--fg-dim)',
  lineHeight: 1.65,
}

const strong: React.CSSProperties = {
  color:      'var(--fg)',
  fontWeight: 600,
}

const steps: React.CSSProperties = {
  listStyle:     'none',
  display:       'flex',
  flexDirection: 'column',
  gap:           8,
  paddingLeft:   0,
}

const step: React.CSSProperties = {
  display:    'flex',
  alignItems: 'center',
  gap:        10,
  fontSize:   13,
  color:      'var(--fg-dim)',
}

const stepNum: React.CSSProperties = {
  width:          22,
  height:         22,
  borderRadius:   '50%',
  background:     'rgba(255,255,255,0.07)',
  border:         '1px solid rgba(255,255,255,0.12)',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  fontSize:       11,
  fontWeight:     700,
  flexShrink:     0,
  color:          'var(--fg)',
}

const errorMsg: React.CSSProperties = {
  fontSize:   13,
  color:      '#f87171',
  background: 'rgba(248,113,113,0.08)',
  border:     '1px solid rgba(248,113,113,0.2)',
  borderRadius: 8,
  padding:    '8px 12px',
}

const btn: React.CSSProperties = {
  marginTop:    4,
  padding:      '13px 0',
  background:   '#1DB954',
  color:        '#000',
  border:       'none',
  borderRadius: 50,
  fontSize:     15,
  fontWeight:   700,
  fontFamily:   'var(--font-ui)',
  cursor:       'pointer',
  letterSpacing: '0.02em',
  transition:   'opacity 0.2s, transform 0.15s',
  width:        '100%',
}
