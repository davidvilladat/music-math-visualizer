import { expect, test } from '@playwright/test'

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

test.describe('iPhone-like browser', () => {
  test.use({ userAgent: IPHONE_UA, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test.beforeEach(async ({ page }) => {
    // Safari on iOS has no getDisplayMedia.
    await page.addInitScript(() => {
      const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia?: unknown }
      if (md) Object.defineProperty(md, 'getDisplayMedia', { configurable: true, value: undefined })
    })
  })

  test('is let in, offers microphone and demo, and hides capture-only sources', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Unsupported Browser')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Microphone', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Demo', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'SoundCloud', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Spotify', exact: true })).toHaveCount(0)
    await expect(page.getByTestId('launch-mic')).toBeVisible()
    await expect(page.getByTestId('install-hint')).toBeVisible()

    await page.getByRole('button', { name: 'Demo', exact: true }).click()
    await expect(page.getByTestId('launch-hutchula-showcase')).toHaveCount(0)
    await page.getByTestId('launch-demo-selected').click()
    await expect(page.getByTestId('top-bar')).toBeVisible()
  })

  test('serves the home-screen manifest and icons', async ({ page, request }) => {
    await page.goto('/')
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
    const manifest = await (await request.get('/manifest.webmanifest')).json()
    expect(manifest.short_name).toBe('SPECTRA')
    for (const icon of manifest.icons) {
      expect((await request.get(icon.src)).ok()).toBe(true)
    }
    expect((await request.get('/icons/apple-touch-icon.png')).ok()).toBe(true)
  })
})

test.describe('microphone source', () => {
  // The fake microphone itself comes from launch flags in playwright.config.ts.
  test.use({ permissions: ['microphone'] })

  test('starts listening and reaches the visualizer without errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Microphone', exact: true }).click()
    await page.getByTestId('launch-mic').click()

    await expect(page.getByTestId('top-bar')).toBeVisible()
    await expect(page.getByTestId('top-bar').getByText('Microphone', { exact: true })).toBeVisible()
    expect(consoleErrors).toEqual([])
  })

  test('explains a blocked microphone and stays on the source screen', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: async () => { throw new DOMException('denied', 'NotAllowedError') },
      })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Microphone', exact: true }).click()
    await page.getByTestId('launch-mic').click()
    await expect(page.getByText('Microphone access was blocked', { exact: false })).toBeVisible()
    await expect(page.getByTestId('launch-mic')).toHaveText('Try Again')
  })
})
