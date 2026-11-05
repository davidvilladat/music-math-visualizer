import { describe, expect, it } from 'vitest'
import { assessBrowser, type BrowserEnv } from '../../src/auth/browserCheck'
import { sourceTabsFor } from '../../src/ui/SoundCloudGate'

const UA = {
  chromeDesktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  edgeDesktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
  ipadOS: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  firefoxDesktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
}

function env(userAgent: string, overrides: Partial<BrowserEnv> = {}): BrowserEnv {
  return {
    userAgent,
    maxTouchPoints: 0,
    hasWebGL2: true,
    hasGetDisplayMedia: true,
    hasGetUserMedia: true,
    isStandalone: false,
    ...overrides,
  }
}

describe('browser capability check', () => {
  it('gives desktop Chrome and Edge tab capture', () => {
    for (const ua of [UA.chromeDesktop, UA.edgeDesktop]) {
      const caps = assessBrowser(env(ua))
      expect(caps.ok).toBe(true)
      expect(caps.canCaptureTab).toBe(true)
      expect(caps.isIOS).toBe(false)
    }
  })

  it('lets iPhone in with the microphone but no tab capture, whatever the browser name', () => {
    for (const ua of [UA.iphoneSafari, UA.iphoneChrome]) {
      const caps = assessBrowser(env(ua, { hasGetDisplayMedia: false, maxTouchPoints: 5 }))
      expect(caps.ok).toBe(true)
      expect(caps.isIOS).toBe(true)
      expect(caps.isChromium).toBe(false)
      expect(caps.canCaptureTab).toBe(false)
      expect(caps.canUseMic).toBe(true)
    }
  })

  it('recognises iPadOS, which reports a Mac user agent', () => {
    expect(assessBrowser(env(UA.ipadOS, { maxTouchPoints: 5 })).isIOS).toBe(true)
    expect(assessBrowser(env(UA.ipadOS, { maxTouchPoints: 0 })).isIOS).toBe(false)
  })

  it('keeps tab capture off on Android and non-Chromium desktops', () => {
    expect(assessBrowser(env(UA.androidChrome)).canCaptureTab).toBe(false)
    expect(assessBrowser(env(UA.firefoxDesktop)).canCaptureTab).toBe(false)
    expect(assessBrowser(env(UA.firefoxDesktop)).ok).toBe(true)
  })

  it('blocks only when WebGL2 is missing', () => {
    const caps = assessBrowser(env(UA.chromeDesktop, { hasWebGL2: false }))
    expect(caps.ok).toBe(false)
    expect(caps.missingFeatures).toEqual(['WebGL2'])
  })
})

describe('source tabs', () => {
  it('shows every source on a capture-capable desktop', () => {
    expect(sourceTabsFor({ canCaptureTab: true, canUseMic: true })).toEqual(['soundcloud', 'spotify', 'mic', 'demo'])
  })

  it('shows only microphone and demo on a phone', () => {
    expect(sourceTabsFor({ canCaptureTab: false, canUseMic: true })).toEqual(['mic', 'demo'])
  })

  it('always keeps the demo', () => {
    expect(sourceTabsFor({ canCaptureTab: false, canUseMic: false })).toEqual(['demo'])
  })
})
