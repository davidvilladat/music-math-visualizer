import { expect, test } from '@playwright/test'

test('offers the Hutchula Lorenz-to-Trefoil curated demo', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await expect(page.getByTestId('launch-hutchula-showcase')).toBeVisible()
  await expect(page.getByText('8:11 · 12 acts · Lorenz → Trefoil · adaptive sensitivity')).toBeVisible()
})

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

// The later formulas share one launch check rather than copies of the same block.
for (const mode of ['wake', 'mirror', 'waltz', 'seraph', 'mandelbrot', 'nautilus', 'frond', 'lorenz', 'mira', 'nacre', 'tandem', 'triad', 'trefoil', 'beacon'] as const) {
  test(`launches the ${mode} formula from a shared preset`, async ({ page }) => {
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

test('records the visuals and audio to a real video file', async ({ page }) => {
  // Recording holds a take and then muxes it, which outruns the default budget
  // on a software renderer.
  test.setTimeout(90_000)

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

    // The encoded blob is the artifact worth asserting on. Reading it here keeps
    // the check on what the recorder actually produced, rather than on the
    // harness's download-to-disk path, which never settles under this renderer.
    const scope = window as unknown as { __recordings?: { size: number; type: string }[] }
    scope.__recordings = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object: Blob | MediaSource) => {
      if (object instanceof Blob) scope.__recordings!.push({ size: object.size, type: object.type })
      return createObjectURL(object)
    }
  })

  await page.goto('/?mode=chroma&reactivity=balanced')
  await page.getByTestId('launch-demo').click()
  await expect(page.getByTestId('visualizer-canvas')).toBeVisible()

  const record = page.getByTestId('record-toggle')
  await expect(record).toHaveText(/Record/)

  // Driven directly rather than through a pointer. The bar auto-hides to
  // pointerEvents:none, so waking it needs a raw mouse move, and under this
  // renderer the gap between that move and the hit-test is wide enough to lose
  // the race every time. That the bar is reachable by a pointer is covered by
  // the controls test above, which drives the same bar.
  await record.evaluate((el: HTMLElement) => el.click())

  // The label turning into a running clock is the only signal the capture is
  // live, and it doubles as proof the bar stays put while recording.
  await expect(record).toHaveText(/\d+:\d\d/)

  // Recording above display resolution is the point of the feature, so confirm
  // the buffer actually grew rather than trusting the setting.
  const scaled = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid=visualizer-canvas]') as HTMLCanvasElement
    return { width: canvas.width, height: canvas.height }
  })
  expect(scaled.width).toBeGreaterThan(1280)

  await page.waitForTimeout(3000)

  const downloadPromise = page.waitForEvent('download')
  await record.evaluate((el: HTMLElement) => el.click())

  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^visualizer-chroma-\d{8}-\d{6}\.(mp4|webm)$/)

  const recordings = await page.evaluate(
    () => (window as unknown as { __recordings: { size: number; type: string }[] }).__recordings,
  )
  expect(recordings).toHaveLength(1)
  expect(recordings[0].type).toMatch(/^video\/(mp4|webm)/)
  expect(recordings[0].size).toBeGreaterThan(100_000)

  // The buffer returns to display resolution once the take ends.
  const restored = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid=visualizer-canvas]') as HTMLCanvasElement
    return canvas.width
  })
  expect(restored).toBeLessThan(scaled.width)

  expect(consoleErrors).toEqual([])
})
