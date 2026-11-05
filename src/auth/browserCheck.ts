export interface BrowserCapabilities {
  /** The visualizer can run at all. Only WebGL2 is a hard requirement. */
  ok: boolean
  isChromium: boolean
  hasWebGL2: boolean
  /** Tab-audio capture works: needed for SoundCloud and Spotify. Desktop Chrome/Edge only. */
  canCaptureTab: boolean
  /** Microphone input works: the source for phones and non-Chromium browsers. */
  canUseMic: boolean
  /** iPhone/iPad (iPadOS reports a Mac user agent, so touch points decide). */
  isIOS: boolean
  /** Running as an installed home-screen app. */
  isStandalone: boolean
  missingFeatures: string[]
}

export interface BrowserEnv {
  userAgent: string
  maxTouchPoints: number
  hasWebGL2: boolean
  hasGetDisplayMedia: boolean
  hasGetUserMedia: boolean
  isStandalone: boolean
}

export function assessBrowser(env: BrowserEnv): BrowserCapabilities {
  const ua = env.userAgent
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && env.maxTouchPoints > 1)
  // Every iOS browser is WebKit underneath, whatever its name (CriOS, EdgiOS),
  // and none of them can capture tab audio.
  const isChromium = !isIOS && /Chrome|Chromium|Edg\//.test(ua)
  const isMobile = isIOS || /Android|Mobi/.test(ua)

  const missing: string[] = []
  if (!env.hasWebGL2) missing.push('WebGL2')

  return {
    ok: missing.length === 0,
    isChromium,
    hasWebGL2: env.hasWebGL2,
    canCaptureTab: isChromium && !isMobile && env.hasGetDisplayMedia,
    canUseMic: env.hasGetUserMedia,
    isIOS,
    isStandalone: env.isStandalone,
    missingFeatures: missing,
  }
}

export function checkBrowser(): BrowserCapabilities {
  const canvas = document.createElement('canvas')
  const nav = navigator as Navigator & { standalone?: boolean }
  return assessBrowser({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    hasWebGL2: !!canvas.getContext('webgl2'),
    hasGetDisplayMedia: typeof navigator.mediaDevices?.getDisplayMedia === 'function',
    hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
    isStandalone: nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true,
  })
}
