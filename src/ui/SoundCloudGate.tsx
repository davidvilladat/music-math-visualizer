import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { getAccessToken, redirectToLogin } from '../auth/authService'
import { VISUAL_MODE_META, type DevParams } from '../state/store'

type VisualMode = DevParams['visualMode']
type Tab = 'soundcloud' | 'spotify' | 'demo'

const MODES = VISUAL_MODE_META

interface Props {
  onStart:        (url: string) => Promise<void>
  onDemo:         (mode: VisualMode) => void
  onSpotify:      () => void
  error:          string | null
  spotifyError:   string | null
  spotifyLoading: boolean
  initialTab?:    Tab
}

function isSoundCloudUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim())
    return ['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com'].includes(u.hostname)
  } catch {
    return false
  }
}

export function SoundCloudGate({
  onStart, onDemo, onSpotify,
  error, spotifyError, spotifyLoading,
  initialTab = 'soundcloud',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<Tab>(initialTab)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [validErr, setValidErr] = useState<string | null>(null)
  const [demoMode, setDemoMode] = useState<VisualMode>('formula')

  const isSpotifyAuthed = !!getAccessToken()
  const anyScError = validErr ?? (tab === 'soundcloud' ? error : null)

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

  const handleScSubmit = async () => {
    const trimmed = url.trim()
    if (!isSoundCloudUrl(trimmed)) {
      setValidErr('Paste a public SoundCloud track, album, or playlist URL.')
      inputRef.current?.focus()
      return
    }

    setValidErr(null)
    setLoading(true)
    try {
      await onStart(trimmed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={page}>
      <section style={panel}>
        <header style={header}>
          <div style={brand}>SPECTRA</div>
          <div style={statusLine}>
            <span style={statusDot} />
            Browser audio visualizer
          </div>
        </header>

        <nav style={tabs} aria-label="Audio source">
          {(['soundcloud', 'spotify', 'demo'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              style={{ ...tabButton, ...(tab === key ? activeTab : null) }}
            >
              {key === 'soundcloud' ? 'SoundCloud' : key === 'spotify' ? 'Spotify' : 'Demo'}
            </button>
          ))}
        </nav>

        <div style={content}>
          {tab === 'soundcloud' && (
            <>
              <label htmlFor="sc-url" style={label}>SoundCloud URL</label>
              <input
                ref={inputRef}
                id="sc-url"
                type="url"
                placeholder="https://soundcloud.com/artist/track"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setValidErr(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && void handleScSubmit()}
                style={{ ...input, borderColor: anyScError ? '#f87171' : 'rgba(255,255,255,0.12)' }}
                disabled={loading}
                autoComplete="off"
                spellCheck={false}
              />
              {anyScError && <p style={errorText}>{anyScError}</p>}
              <button
                type="button"
                onClick={() => void handleScSubmit()}
                disabled={loading || !url}
                style={{ ...primaryButton, opacity: loading || !url ? 0.45 : 1 }}
              >
                {loading ? 'Loading' : 'Visualize'}
              </button>
              <p style={note}>When Chrome opens the share dialog, choose this tab and enable "Share tab audio".</p>
            </>
          )}

          {tab === 'spotify' && (
            <>
              {spotifyLoading ? (
                <div style={quietBlock}>
                  <div style={spinner} />
                  <p style={mutedText}>Connecting to Spotify</p>
                </div>
              ) : spotifyError ? (
                <>
                  <p style={errorText}>{spotifyError}</p>
                  <button type="button" onClick={() => void redirectToLogin()} style={primaryButton}>
                    Try Again
                  </button>
                </>
              ) : isSpotifyAuthed ? (
                <>
                  <p style={mutedText}>Spotify is connected. Premium is required for browser playback.</p>
                  <button type="button" onClick={onSpotify} style={primaryButton}>
                    Launch Spotify
                  </button>
                  <button type="button" onClick={() => void redirectToLogin()} style={secondaryButton}>
                    Switch Account
                  </button>
                </>
              ) : (
                <>
                  <p style={mutedText}>Connect Spotify, then share tab audio when prompted.</p>
                  <button type="button" onClick={() => void redirectToLogin()} style={primaryButton}>
                    Connect Spotify
                  </button>
                </>
              )}
            </>
          )}

          {tab === 'demo' && (
            <>
              <label htmlFor="demo-mode" style={label}>Visual mode</label>
              <select
                id="demo-mode"
                value={demoMode}
                onChange={(e) => setDemoMode(e.target.value as VisualMode)}
                style={select}
              >
                {MODES.map((mode) => (
                  <option key={mode.key} value={mode.key}>{mode.label}</option>
                ))}
              </select>
              <button type="button" onClick={() => onDemo(demoMode)} style={primaryButton}>
                Launch Demo
              </button>
              <p style={note}>Synthetic audio only. No login or capture prompt.</p>
            </>
          )}
        </div>
      </section>
    </main>
  )
}

const page: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: '#030303',
  color: 'var(--fg)',
  fontFamily: 'var(--font-ui)',
  padding: 24,
}

const panel: CSSProperties = {
  width: 'min(440px, 100%)',
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
}

const header: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 16,
}

const brand: CSSProperties = {
  fontSize: 28,
  fontWeight: 750,
  letterSpacing: '0.16em',
}

const statusLine: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  color: 'rgba(255,255,255,0.34)',
  fontSize: 12,
  whiteSpace: 'nowrap',
}

const statusDot: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  background: '#ffffff',
  boxShadow: '0 0 14px rgba(255,255,255,0.5)',
}

const tabs: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 8,
  padding: 3,
  background: 'rgba(255,255,255,0.03)',
}

const tabButton: CSSProperties = {
  minHeight: 34,
  border: 0,
  borderRadius: 6,
  background: 'transparent',
  color: 'rgba(255,255,255,0.38)',
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
  fontWeight: 650,
  cursor: 'pointer',
}

const activeTab: CSSProperties = {
  background: 'rgba(255,255,255,0.10)',
  color: '#fff',
}

const content: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const label: CSSProperties = {
  color: 'rgba(255,255,255,0.44)',
  fontSize: 12,
  fontWeight: 650,
}

const input: CSSProperties = {
  width: '100%',
  minHeight: 44,
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.05)',
  color: '#fff',
  outline: 'none',
  padding: '0 13px',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
}

const select: CSSProperties = {
  ...input,
  fontFamily: 'var(--font-ui)',
}

const primaryButton: CSSProperties = {
  minHeight: 44,
  width: '100%',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 8,
  background: '#f5f5f5',
  color: '#050505',
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
  fontWeight: 750,
  cursor: 'pointer',
}

const secondaryButton: CSSProperties = {
  ...primaryButton,
  background: 'transparent',
  color: 'rgba(255,255,255,0.58)',
}

const mutedText: CSSProperties = {
  margin: 0,
  color: 'rgba(255,255,255,0.50)',
  fontSize: 13,
  lineHeight: 1.55,
}

const note: CSSProperties = {
  margin: 0,
  color: 'rgba(255,255,255,0.28)',
  fontSize: 12,
  lineHeight: 1.5,
}

const errorText: CSSProperties = {
  margin: 0,
  color: '#f87171',
  fontSize: 12,
  lineHeight: 1.5,
}

const quietBlock: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  gap: 12,
  padding: '20px 0',
}

const spinner: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: '50%',
  border: '2px solid rgba(255,255,255,0.14)',
  borderTopColor: '#fff',
  animation: 'spin 0.8s linear infinite',
}
