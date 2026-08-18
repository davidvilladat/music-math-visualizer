import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { getAccessToken, redirectToLogin } from '../auth/authService'
import { VISUAL_MODE_META, useStore, type DevParams } from '../state/store'
import type { SourceState, SourceTab } from '../state/sourceState'
import { HUTCHULA_CHOREOGRAPHY } from '../choreography/songChoreography'

type VisualMode = DevParams['visualMode']

const MODES = VISUAL_MODE_META

interface Props {
  sourceState: SourceState
  onStart: (url: string) => Promise<void>
  onDemo: (mode: VisualMode) => void
  onShowcase: () => Promise<void>
  onSpotify: () => void
}

export function isSoundCloudUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim())
    return ['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com'].includes(url.hostname)
  } catch {
    return false
  }
}

function initialTabFor(state: SourceState): SourceTab {
  return 'initialTab' in state ? state.initialTab : 'soundcloud'
}

export function SoundCloudGate({ sourceState, onStart, onDemo, onShowcase, onSpotify }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<SourceTab>(initialTabFor(sourceState))
  const [url, setUrl] = useState('')
  const [validErr, setValidErr] = useState<string | null>(null)
  const storedVisualMode = useStore((state) => state.devParams.visualMode)
  const setDevParams = useStore((state) => state.setDevParams)
  const [demoMode, setDemoMode] = useState<VisualMode>(storedVisualMode)
  const [demoTouched, setDemoTouched] = useState(false)

  const isSpotifyAuthed = !!getAccessToken()
  const connectingSource = sourceState.status === 'connecting' ? sourceState.source : null
  const sourceError = sourceState.status === 'error' ? sourceState : null
  const captureMessage = sourceState.status === 'capture-ended' ? sourceState.message : null
  const isShowcaseError = sourceError?.source === 'soundcloud' && initialTabFor(sourceState) === 'demo'
  const soundCloudError = validErr ?? (sourceError?.source === 'soundcloud' && !isShowcaseError ? sourceError.message : null)
  const showcaseError = isShowcaseError ? sourceError.message : null
  const spotifyError = sourceError?.source === 'spotify' ? sourceError.message : null
  const soundCloudLoading = connectingSource === 'soundcloud'
  const spotifyLoading = connectingSource === 'spotify'

  useEffect(() => {
    setTab(initialTabFor(sourceState))
  }, [sourceState])

  useEffect(() => {
    if (!demoTouched) setDemoMode(storedVisualMode)
  }, [demoTouched, storedVisualMode])

  const handleScSubmit = async () => {
    const trimmed = url.trim()
    if (!isSoundCloudUrl(trimmed)) {
      setValidErr('Paste a public SoundCloud track, album, or playlist URL.')
      inputRef.current?.focus()
      return
    }

    setValidErr(null)
    await onStart(trimmed)
  }

  const launchDemo = (mode: VisualMode, aircraftVariant?: number) => {
    if (aircraftVariant !== undefined) setDevParams({ aircraftVariant })
    onDemo(mode)
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

        {captureMessage && <p style={warningText}>{captureMessage}</p>}

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
                onChange={(event) => {
                  setUrl(event.target.value)
                  setValidErr(null)
                }}
                onKeyDown={(event) => event.key === 'Enter' && void handleScSubmit()}
                style={{ ...input, borderColor: soundCloudError ? '#f87171' : 'rgba(255,255,255,0.12)' }}
                disabled={soundCloudLoading}
                autoComplete="off"
                spellCheck={false}
              />
              {soundCloudError && <p style={errorText}>{soundCloudError}</p>}
              <button
                type="button"
                onClick={() => void handleScSubmit()}
                disabled={soundCloudLoading || !url}
                style={{ ...primaryButton, opacity: soundCloudLoading || !url ? 0.45 : 1 }}
              >
                {soundCloudLoading ? 'Loading' : 'Visualize SoundCloud'}
              </button>
              <button
                type="button"
                onClick={() => launchDemo(demoMode)}
                style={secondaryButton}
                data-testid="launch-demo"
              >
                Start Demo
              </button>
              <button
                type="button"
                onClick={() => launchDemo('airframe', 1)}
                style={aviationButton}
                data-testid="launch-aviation-demo"
              >
                Aviation Demo
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
                  <button
                    type="button"
                    onClick={isSpotifyAuthed ? onSpotify : () => void redirectToLogin()}
                    style={primaryButton}
                  >
                    {isSpotifyAuthed ? 'Retry Spotify' : 'Connect Spotify'}
                  </button>
                </>
              ) : isSpotifyAuthed ? (
                <>
                  <p style={mutedText}>Spotify uses Premium browser playback and still needs tab audio capture for visuals.</p>
                  <button type="button" onClick={onSpotify} style={primaryButton}>
                    Launch Spotify
                  </button>
                  <button type="button" onClick={() => void redirectToLogin()} style={secondaryButton}>
                    Switch Account
                  </button>
                </>
              ) : (
                <>
                  <p style={mutedText}>Spotify is an advanced path: connect a Premium account, then share tab audio when prompted.</p>
                  <button type="button" onClick={() => void redirectToLogin()} style={primaryButton}>
                    Connect Spotify
                  </button>
                </>
              )}
            </>
          )}

          {tab === 'demo' && (
            <>
              <div style={showcaseCard}>
                <div style={showcaseEyebrow}>CURATED SONG DEMO</div>
                <div style={showcaseTitle}>{HUTCHULA_CHOREOGRAPHY.artist} — {HUTCHULA_CHOREOGRAPHY.title}</div>
                <div style={showcaseMeta}>8:11 · Lorenz → Trefoil · adaptive sensitivity</div>
                <button
                  type="button"
                  onClick={() => void onShowcase()}
                  disabled={soundCloudLoading}
                  style={{ ...showcaseButton, opacity: soundCloudLoading ? 0.45 : 1 }}
                  data-testid="launch-hutchula-showcase"
                >
                  {soundCloudLoading ? 'Preparing Show' : 'Launch Hutchula Show'}
                </button>
                {showcaseError && <p style={errorText}>{showcaseError}</p>}
                <p style={note}>Uses the SoundCloud track. Enable “Share tab audio” when Chrome asks.</p>
              </div>

              <div style={divider} />
              <label htmlFor="demo-mode" style={label}>Visual mode</label>
              <select
                id="demo-mode"
                value={demoMode}
                onChange={(event) => {
                  setDemoTouched(true)
                  setDemoMode(event.target.value as VisualMode)
                }}
                style={select}
              >
                {MODES.map((mode) => (
                  <option key={mode.key} value={mode.key}>{mode.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => launchDemo(demoMode)}
                style={primaryButton}
                data-testid="launch-demo-selected"
              >
                Launch Demo
              </button>
              <div style={quickDemoRow}>
                <button type="button" onClick={() => launchDemo('formula')} style={miniDemoButton}>
                  Formula
                </button>
                <button type="button" onClick={() => launchDemo('airframe', 1)} style={miniDemoButton}>
                  Aviation
                </button>
                <button type="button" onClick={() => launchDemo('neon')} style={miniDemoButton}>
                  Neon
                </button>
              </div>
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
  zIndex: 5,
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

const aviationButton: CSSProperties = {
  ...secondaryButton,
  borderColor: 'rgba(14,165,233,0.24)',
  color: 'rgba(191,219,254,0.9)',
  background: 'rgba(14,165,233,0.08)',
}

const quickDemoRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
}

const miniDemoButton: CSSProperties = {
  minHeight: 34,
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 7,
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.66)',
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

const showcaseCard: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  padding: 13,
  border: '1px solid rgba(244,63,94,0.22)',
  borderRadius: 9,
  background: 'linear-gradient(135deg, rgba(244,63,94,0.10), rgba(190,242,100,0.04))',
}

const showcaseEyebrow: CSSProperties = {
  color: 'rgba(251,113,133,0.78)',
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.14em',
}

const showcaseTitle: CSSProperties = {
  color: '#fff',
  fontSize: 14,
  fontWeight: 750,
}

const showcaseMeta: CSSProperties = {
  color: 'rgba(255,255,255,0.43)',
  fontSize: 11,
}

const showcaseButton: CSSProperties = {
  ...primaryButton,
  marginTop: 3,
  background: '#fb7185',
  borderColor: '#fb7185',
  color: '#180306',
}

const divider: CSSProperties = {
  height: 1,
  margin: '3px 0',
  background: 'rgba(255,255,255,0.08)',
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

const warningText: CSSProperties = {
  ...errorText,
  color: '#fbbf24',
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
