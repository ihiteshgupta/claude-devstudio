import type { ElectronAPI } from '../src/preload/index'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
