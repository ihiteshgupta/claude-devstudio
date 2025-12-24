import { _electron as electron, ElectronApplication, Page } from 'playwright'
import { test as base } from '@playwright/test'
import path from 'path'

// Extend the base test with Electron-specific fixtures
export const test = base.extend<{
  electronApp: ElectronApplication
  page: Page
}>({
  electronApp: async ({}, use) => {
    // Build the app first if needed
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../dist/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    })
    await use(electronApp)
    await electronApp.close()
  },
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await use(page)
  }
})

export { expect } from '@playwright/test'
