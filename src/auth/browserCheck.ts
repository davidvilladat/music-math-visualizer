export interface BrowserCapabilities {
  ok: boolean
  isChromium: boolean
  hasWebGL2: boolean
  hasGetDisplayMedia: boolean
  missingFeatures: string[]
}

export function checkBrowser(): BrowserCapabilities {
  const missing: string[] = []

  const isChromium =
    /Chrome|Chromium/.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent)
      ? true
      : /Edg\//.test(navigator.userAgent)
        ? true
        : false

  if (!isChromium) missing.push('Chromium-based browser (Chrome or Edge)')

  const canvas = document.createElement('canvas')
  const hasWebGL2 = !!canvas.getContext('webgl2')
  if (!hasWebGL2) missing.push('WebGL2')

  const hasGetDisplayMedia =
    typeof navigator.mediaDevices?.getDisplayMedia === 'function'
  if (!hasGetDisplayMedia) missing.push('getDisplayMedia (screen/tab capture)')

  return {
    ok: missing.length === 0,
    isChromium,
    hasWebGL2,
    hasGetDisplayMedia,
    missingFeatures: missing,
  }
}
