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
  await expect(page.getByText('A350 XWB')).toBeVisible()
  await expect(page.getByText(/LOADING|READY/)).toBeVisible()

  expect(consoleErrors).toEqual([])
})
