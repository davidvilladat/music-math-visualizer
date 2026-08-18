import { expect, test } from '@playwright/test'

test('launches the demo visualizer and switches controls', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.addInitScript(() => {
    const existing = navigator.mediaDevices ?? {}
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        ...existing,
        getDisplayMedia: async () => new MediaStream(),
      },
    })
  })

  await page.goto('/')
  await page.getByTestId('launch-demo').click()

  await expect(page.getByTestId('visualizer-canvas')).toBeVisible()
  await expect(page.getByTestId('top-bar')).toBeVisible()

  await page.getByLabel('Visual mode').selectOption('prism')
  await page.getByLabel('Reactivity').selectOption('intense')

  expect(consoleErrors).toEqual([])
})

test('launches aviation mode from a shared preset', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.addInitScript(() => {
    const existing = navigator.mediaDevices ?? {}
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        ...existing,
        getDisplayMedia: async () => new MediaStream(),
      },
    })
  })

  await page.goto('/?mode=airframe&reactivity=balanced&aircraft=1')
  await page.getByTestId('launch-demo').click()

  await expect(page.getByTestId('visualizer-canvas')).toBeVisible()
  await expect(page.getByTestId('aircraft-variant-name')).toHaveText('A350 XWB')
  await expect(page.getByTestId('aircraft-hud').getByText(/LOADING|READY/)).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('launches aviation demo and switches aircraft variants', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.addInitScript(() => {
    const existing = navigator.mediaDevices ?? {}
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        ...existing,
        getDisplayMedia: async () => new MediaStream(),
      },
    })
  })

  await page.goto('/')
  await page.getByTestId('launch-aviation-demo').click()

  await expect(page.getByTestId('visualizer-canvas')).toBeVisible()
  await expect(page.getByLabel('Aircraft variant')).toBeVisible()
  await expect(page.getByTestId('aircraft-variant-name')).toHaveText('A350 XWB')
  await expect(page.getByTestId('aircraft-hud').getByText(/LOADING|READY/)).toBeVisible()

  await page.getByLabel('Aircraft variant').selectOption('5')
  await expect(page.getByTestId('aircraft-variant-name')).toHaveText('Concorde')
  await expect(page.getByTestId('aircraft-preload-progress')).toHaveText(/\/10/)

  expect(consoleErrors).toEqual([])
})

test('launches the Contact formula from a shared preset', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.addInitScript(() => {
    const existing = navigator.mediaDevices ?? {}
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        ...existing,
        getDisplayMedia: async () => new MediaStream(),
      },
    })
  })

  await page.goto('/?mode=contact&reactivity=balanced')
  await page.getByTestId('launch-demo').click()

  await expect(page.getByTestId('visualizer-canvas')).toBeVisible()
  await expect(page.getByLabel('Visual mode')).toHaveValue('contact')
  await page.waitForTimeout(500)

  expect(consoleErrors).toEqual([])
})

test('launches the paired Chroma formula from a shared preset', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.addInitScript(() => {
    const existing = navigator.mediaDevices ?? {}
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        ...existing,
        getDisplayMedia: async () => new MediaStream(),
      },
    })
  })

  await page.goto('/?mode=chroma&reactivity=balanced')
  await page.getByTestId('launch-demo').click()

  await expect(page.getByTestId('visualizer-canvas')).toBeVisible()
  await expect(page.getByLabel('Visual mode')).toHaveValue('chroma')
  await page.waitForTimeout(500)

  expect(consoleErrors).toEqual([])
})

test('launches the head-to-head Gaze formula from a shared preset', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.addInitScript(() => {
    const existing = navigator.mediaDevices ?? {}
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        ...existing,
        getDisplayMedia: async () => new MediaStream(),
      },
    })
  })

  await page.goto('/?mode=gaze&reactivity=balanced')
  await page.getByTestId('launch-demo').click()

  await expect(page.getByTestId('visualizer-canvas')).toBeVisible()
  await expect(page.getByLabel('Visual mode')).toHaveValue('gaze')
  await page.waitForTimeout(500)

  expect(consoleErrors).toEqual([])
})

// The remaining Chroma pairings differ only in how the two copies are placed, so
// they share one launch check rather than three copies of the same block.
for (const mode of ['wake', 'mirror', 'waltz', 'seraph'] as const) {
  test(`launches the ${mode} Chroma pairing from a shared preset`, async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    await page.addInitScript(() => {
      const existing = navigator.mediaDevices ?? {}
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          ...existing,
          getDisplayMedia: async () => new MediaStream(),
        },
      })
    })

    await page.goto(`/?mode=${mode}&reactivity=balanced`)
    await page.getByTestId('launch-demo').click()

    await expect(page.getByTestId('visualizer-canvas')).toBeVisible()
    await expect(page.getByLabel('Visual mode')).toHaveValue(mode)
    await page.waitForTimeout(500)

    expect(consoleErrors).toEqual([])
  })
}
