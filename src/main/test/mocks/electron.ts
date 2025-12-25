/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 *
 * Mock Electron APIs for main process testing
 */

import { vi } from 'vitest'
import { EventEmitter } from 'events'

// Mock app module
export const mockApp = {
  getPath: vi.fn((name: string) => `/tmp/test-data/${name}`),
  getVersion: vi.fn(() => '1.0.0-test'),
  getName: vi.fn(() => 'Claude DevStudio Test'),
  whenReady: vi.fn(() => Promise.resolve()),
  quit: vi.fn(),
  on: vi.fn(),
  isPackaged: false,
  requestSingleInstanceLock: vi.fn(() => true),
  setAppUserModelId: vi.fn()
}

// Mock ipcMain module
export const mockIpcMain = {
  handle: vi.fn(),
  handleOnce: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  removeHandler: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn()
}

// Mock BrowserWindow class
export class MockBrowserWindow extends EventEmitter {
  webContents: {
    send: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
    once: ReturnType<typeof vi.fn>
    openDevTools: ReturnType<typeof vi.fn>
    setWindowOpenHandler: ReturnType<typeof vi.fn>
  }

  constructor(_options?: unknown) {
    super()
    this.webContents = {
      send: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      openDevTools: vi.fn(),
      setWindowOpenHandler: vi.fn()
    }
  }

  loadFile = vi.fn(() => Promise.resolve())
  loadURL = vi.fn(() => Promise.resolve())
  show = vi.fn()
  hide = vi.fn()
  close = vi.fn()
  destroy = vi.fn()
  focus = vi.fn()
  blur = vi.fn()
  minimize = vi.fn()
  maximize = vi.fn()
  unmaximize = vi.fn()
  isMaximized = vi.fn(() => false)
  isMinimized = vi.fn(() => false)
  isVisible = vi.fn(() => true)
  setTitle = vi.fn()
  getTitle = vi.fn(() => 'Test Window')
  getBounds = vi.fn(() => ({ x: 0, y: 0, width: 1200, height: 800 }))
  setBounds = vi.fn()
  setSize = vi.fn()
  getSize = vi.fn(() => [1200, 800])
  setPosition = vi.fn()
  getPosition = vi.fn(() => [100, 100])
  setResizable = vi.fn()
  isResizable = vi.fn(() => true)
  setMovable = vi.fn()
  isMovable = vi.fn(() => true)
  setMinimizable = vi.fn()
  isMinimizable = vi.fn(() => true)
  setMaximizable = vi.fn()
  isMaximizable = vi.fn(() => true)
  setFullScreenable = vi.fn()
  isFullScreenable = vi.fn(() => true)
  setClosable = vi.fn()
  isClosable = vi.fn(() => true)

  static getAllWindows = vi.fn(() => [])
  static getFocusedWindow = vi.fn(() => null)
}

// Mock dialog module
export const mockDialog = {
  showOpenDialog: vi.fn(() => Promise.resolve({ canceled: false, filePaths: ['/test/path'] })),
  showSaveDialog: vi.fn(() => Promise.resolve({ canceled: false, filePath: '/test/save/path' })),
  showMessageBox: vi.fn(() => Promise.resolve({ response: 0 })),
  showErrorBox: vi.fn()
}

// Mock shell module
export const mockShell = {
  openExternal: vi.fn(() => Promise.resolve()),
  openPath: vi.fn(() => Promise.resolve('')),
  showItemInFolder: vi.fn(),
  beep: vi.fn()
}

// Mock nativeTheme module
export const mockNativeTheme = {
  shouldUseDarkColors: false,
  themeSource: 'system' as 'system' | 'light' | 'dark',
  on: vi.fn()
}

// Mock Menu module
export const mockMenu = {
  buildFromTemplate: vi.fn(() => ({})),
  setApplicationMenu: vi.fn(),
  getApplicationMenu: vi.fn(() => null)
}

// Mock Tray module
export class MockTray extends EventEmitter {
  constructor(_iconPath: string) {
    super()
  }
  setToolTip = vi.fn()
  setContextMenu = vi.fn()
  setImage = vi.fn()
  destroy = vi.fn()
}

// Mock net module
export const mockNet = {
  request: vi.fn(() => ({
    on: vi.fn(),
    end: vi.fn(),
    write: vi.fn()
  }))
}

// Mock session module
export const mockSession = {
  defaultSession: {
    clearCache: vi.fn(() => Promise.resolve()),
    clearStorageData: vi.fn(() => Promise.resolve()),
    setPermissionRequestHandler: vi.fn()
  }
}

// Combined mock for vi.mock('electron')
export function createElectronMock() {
  return {
    app: mockApp,
    ipcMain: mockIpcMain,
    BrowserWindow: MockBrowserWindow,
    dialog: mockDialog,
    shell: mockShell,
    nativeTheme: mockNativeTheme,
    Menu: mockMenu,
    Tray: MockTray,
    net: mockNet,
    session: mockSession
  }
}

// Helper to reset all mocks
export function resetElectronMocks() {
  vi.clearAllMocks()
}
