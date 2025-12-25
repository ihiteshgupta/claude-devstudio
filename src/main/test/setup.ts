/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 *
 * Vitest setup file for main process tests
 */

import { vi, beforeEach, afterEach } from 'vitest'
import { createElectronMock, resetElectronMocks } from './mocks/electron'

// Mock electron before any imports
vi.mock('electron', () => createElectronMock())

// Mock electron-store
vi.mock('electron-store', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn((key: string, defaultValue?: unknown) => defaultValue),
      set: vi.fn(),
      delete: vi.fn(),
      has: vi.fn(() => false),
      clear: vi.fn(),
      store: {}
    }))
  }
})

// Mock child_process for Claude CLI tests
vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process')
  return {
    ...actual,
    spawn: vi.fn(),
    exec: vi.fn(),
    execSync: vi.fn()
  }
})

// Mock fs for file operations (selective)
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs')
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => '{}')
  }
})

// Reset mocks before each test
beforeEach(() => {
  resetElectronMocks()
  vi.clearAllMocks()
})

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks()
})

// Global test utilities
declare global {
  // eslint-disable-next-line no-var
  var testUtils: {
    sleep: (ms: number) => Promise<void>
    randomId: () => string
  }
}

globalThis.testUtils = {
  sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  randomId: () => Math.random().toString(36).substring(2, 15)
}
