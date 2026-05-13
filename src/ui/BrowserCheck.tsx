import { useEffect } from 'react'
import { checkBrowser } from '../auth/browserCheck'

interface Props { onPass: () => void }

export function BrowserCheck({ onPass }: Props) {
  const caps = checkBrowser()

  useEffect(() => {
    if (caps.ok) onPass()
  }, [caps.ok, onPass])

  if (caps.ok) return null

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={iconWrap}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 style={title}>Unsupported Browser</h2>
        <p style={body}>This visualizer needs:</p>
        <ul style={list}>
          {caps.missingFeatures.map((f) => (
            <li key={f} style={listItem}>{f}</li>
          ))}
        </ul>
        <p style={hint}>Open in Chrome or Edge on a desktop computer.</p>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = {
  position:       'fixed',
  inset:          0,
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  background:     '#000',
  fontFamily:     'var(--font-ui)',
}

const card: React.CSSProperties = {
  maxWidth:     380,
  width:        '90%',
  background:   '#0d0d0d',
  border:       '1px solid rgba(248,113,113,0.2)',
  borderRadius: 16,
  padding:      '36px 32px',
  display:      'flex',
  flexDirection: 'column',
  gap:          14,
  boxShadow:    '0 0 60px rgba(248,113,113,0.08)',
}

const iconWrap: React.CSSProperties = {
  width:          48,
  height:         48,
  borderRadius:   12,
  background:     'rgba(248,113,113,0.08)',
  border:         '1px solid rgba(248,113,113,0.2)',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
}

const title: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: 'var(--fg)' }
const body:  React.CSSProperties = { fontSize: 14, color: 'var(--fg-dim)' }
const hint:  React.CSSProperties = { fontSize: 13, color: 'var(--fg-hint)' }

const list: React.CSSProperties = {
  paddingLeft: 0,
  listStyle:   'none',
  display:     'flex',
  flexDirection: 'column',
  gap:         6,
}

const listItem: React.CSSProperties = {
  fontSize:   13,
  color:      '#f87171',
  padding:    '6px 10px',
  background: 'rgba(248,113,113,0.06)',
  borderRadius: 6,
  fontFamily: 'var(--font-mono)',
}
