/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 *
 * Vitest setup file for renderer process tests
 */

import '@testing-library/jest-dom/vitest'
import { vi, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Mock window.electronAPI
const createMockElectronAPI = () => ({
  claude: {
    checkStatus: vi.fn(() => Promise.resolve(true)),
    sendMessage: vi.fn(() => Promise.resolve()),
    cancel: vi.fn(),
    onStream: vi.fn(() => () => {}),
    onError: vi.fn(() => () => {}),
    onComplete: vi.fn(() => () => {})
  },
  projects: {
    list: vi.fn(() => Promise.resolve([])),
    create: vi.fn(() => Promise.resolve({ id: 'new-project', name: 'Test', path: '/test' })),
    delete: vi.fn(() => Promise.resolve()),
    update: vi.fn(() => Promise.resolve()),
    selectFolder: vi.fn(() => Promise.resolve('/selected/folder')),
    get: vi.fn(() => Promise.resolve(null))
  },
  sessions: {
    create: vi.fn(() => Promise.resolve({ id: 'session-1', projectId: 'proj-1', agentType: 'developer' })),
    list: vi.fn(() => Promise.resolve([])),
    get: vi.fn(() => Promise.resolve(null)),
    delete: vi.fn(() => Promise.resolve()),
    addMessage: vi.fn(() => Promise.resolve({ id: 'msg-1' })),
    getMessages: vi.fn(() => Promise.resolve([]))
  },
  stories: {
    create: vi.fn(() => Promise.resolve({ id: 'story-1' })),
    list: vi.fn(() => Promise.resolve([])),
    update: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve(null))
  },
  sprints: {
    create: vi.fn(() => Promise.resolve({ id: 'sprint-1' })),
    list: vi.fn(() => Promise.resolve([])),
    update: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve(null))
  },
  testCases: {
    create: vi.fn(() => Promise.resolve({ id: 'test-1' })),
    list: vi.fn(() => Promise.resolve([])),
    update: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve())
  },
  workflows: {
    create: vi.fn(() => Promise.resolve({ id: 'workflow-1' })),
    list: vi.fn(() => Promise.resolve([])),
    get: vi.fn(() => Promise.resolve(null)),
    start: vi.fn(() => Promise.resolve()),
    cancel: vi.fn(() => Promise.resolve())
  },
  files: {
    getTree: vi.fn(() => Promise.resolve({ name: 'root', children: [] })),
    getContent: vi.fn(() => Promise.resolve('')),
    selectFiles: vi.fn(() => Promise.resolve([]))
  },
  roadmap: {
    create: vi.fn(() => Promise.resolve({ id: 'roadmap-1' })),
    list: vi.fn(() => Promise.resolve([])),
    update: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve())
  },
  taskQueue: {
    list: vi.fn(() => Promise.resolve([])),
    enqueue: vi.fn(() => Promise.resolve({ id: 'task-1' })),
    start: vi.fn(() => Promise.resolve()),
    pause: vi.fn(() => Promise.resolve()),
    cancel: vi.fn(() => Promise.resolve()),
    approve: vi.fn(() => Promise.resolve()),
    reject: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve(null))
  },
  techAdvisor: {
    getChoices: vi.fn(() => Promise.resolve([])),
    makeChoice: vi.fn(() => Promise.resolve())
  },
  decomposer: {
    decompose: vi.fn(() => Promise.resolve({ subtasks: [] }))
  },
  git: {
    getStatus: vi.fn(() => Promise.resolve({ branch: 'main', files: [] })),
    getLog: vi.fn(() => Promise.resolve([])),
    commit: vi.fn(() => Promise.resolve()),
    push: vi.fn(() => Promise.resolve()),
    pull: vi.fn(() => Promise.resolve())
  },
  window: {
    minimize: vi.fn(),
    maximize: vi.fn(),
    close: vi.fn(),
    isMaximized: vi.fn(() => Promise.resolve(false))
  },
  app: {
    getVersion: vi.fn(() => Promise.resolve('1.0.0-test')),
    getPlatform: vi.fn(() => 'darwin')
  },
  learning: {
    recordFeedback: vi.fn(() => Promise.resolve()),
    getPatterns: vi.fn(() => Promise.resolve([]))
  },
  coordination: {
    initiateHandoff: vi.fn(() => Promise.resolve()),
    getPendingHandoffs: vi.fn(() => Promise.resolve([])),
    acceptHandoff: vi.fn(() => Promise.resolve()),
    completeHandoff: vi.fn(() => Promise.resolve()),
    getConflicts: vi.fn(() => Promise.resolve([])),
    resolveConflict: vi.fn(() => Promise.resolve())
  },
  sprintAutomation: {
    generateSuggestion: vi.fn(() => Promise.resolve(null)),
    applySuggestion: vi.fn(() => Promise.resolve('')),
    getSuggestions: vi.fn(() => Promise.resolve([])),
    startWorkflow: vi.fn(() => Promise.resolve(null)),
    advanceWorkflow: vi.fn(() => Promise.resolve(null)),
    cancelWorkflow: vi.fn(() => Promise.resolve(false)),
    getActiveWorkflows: vi.fn(() => Promise.resolve([]))
  }
})

// Install mock before tests
Object.defineProperty(window, 'electronAPI', {
  value: createMockElectronAPI(),
  writable: true,
  configurable: true
})

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  root = null
  rootMargin = ''
  thresholds = []
  takeRecords = vi.fn(() => [])
}
window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

// Mock scrollTo
Element.prototype.scrollTo = vi.fn()
Element.prototype.scrollIntoView = vi.fn()

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
  // Reset electronAPI with fresh mocks
  Object.defineProperty(window, 'electronAPI', {
    value: createMockElectronAPI(),
    writable: true,
    configurable: true
  })
})

// Cleanup after each test
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// Global test utilities for renderer
declare global {
  interface Window {
    electronAPI: ReturnType<typeof createMockElectronAPI>
  }
}

export { createMockElectronAPI }
