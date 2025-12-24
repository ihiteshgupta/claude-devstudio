import { useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'

interface ShortcutConfig {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  description: string
}

// Platform detection
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

export function useKeyboardShortcuts(): void {
  const { currentProject, setViewMode, viewMode } = useAppStore()

  const handleShortcut = useCallback(
    (e: KeyboardEvent) => {
      // Get the modifier key based on platform
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey

      // Ignore if typing in input/textarea (unless it's a global shortcut)
      const target = e.target as HTMLElement
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      const shortcuts: ShortcutConfig[] = [
        // Navigation shortcuts (work even when typing)
        {
          key: '1',
          ctrl: !isMac,
          meta: isMac,
          action: () => currentProject && setViewMode('dashboard'),
          description: 'Go to Dashboard'
        },
        {
          key: '2',
          ctrl: !isMac,
          meta: isMac,
          action: () => currentProject && setViewMode('chat'),
          description: 'Go to Chat'
        },
        {
          key: '3',
          ctrl: !isMac,
          meta: isMac,
          action: () => currentProject && setViewMode('stories'),
          description: 'Go to Stories'
        },
        {
          key: '4',
          ctrl: !isMac,
          meta: isMac,
          action: () => currentProject && setViewMode('sprints'),
          description: 'Go to Sprints'
        },
        {
          key: '5',
          ctrl: !isMac,
          meta: isMac,
          action: () => currentProject && setViewMode('roadmap'),
          description: 'Go to Roadmap'
        },
        {
          key: '6',
          ctrl: !isMac,
          meta: isMac,
          action: () => currentProject && setViewMode('task-queue'),
          description: 'Go to Task Queue'
        },
        {
          key: '7',
          ctrl: !isMac,
          meta: isMac,
          action: () => currentProject && setViewMode('git'),
          description: 'Go to Git'
        },
        {
          key: '8',
          ctrl: !isMac,
          meta: isMac,
          action: () => currentProject && setViewMode('workflows'),
          description: 'Go to Workflows'
        },
        // Escape to close modals or go back
        {
          key: 'Escape',
          action: () => {
            // This will be handled by individual components
          },
          description: 'Close modal / Cancel'
        }
      ]

      // Check each shortcut
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? cmdOrCtrl : !cmdOrCtrl || !shortcut.meta
        const metaMatch = shortcut.meta ? e.metaKey : true
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        const altMatch = shortcut.alt ? e.altKey : !e.altKey

        if (
          e.key === shortcut.key &&
          ctrlMatch &&
          (shortcut.meta ? e.metaKey : true) &&
          shiftMatch &&
          altMatch
        ) {
          // For navigation shortcuts, allow even when typing
          if (shortcut.ctrl || shortcut.meta) {
            e.preventDefault()
            shortcut.action()
            return
          }

          // For non-modifier shortcuts, only trigger if not typing
          if (!isTyping) {
            e.preventDefault()
            shortcut.action()
            return
          }
        }
      }
    },
    [currentProject, setViewMode]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [handleShortcut])
}

// Export shortcut descriptions for help menu
export const KEYBOARD_SHORTCUTS = [
  { keys: isMac ? '⌘1' : 'Ctrl+1', description: 'Dashboard' },
  { keys: isMac ? '⌘2' : 'Ctrl+2', description: 'Chat' },
  { keys: isMac ? '⌘3' : 'Ctrl+3', description: 'Stories' },
  { keys: isMac ? '⌘4' : 'Ctrl+4', description: 'Sprints' },
  { keys: isMac ? '⌘5' : 'Ctrl+5', description: 'Roadmap' },
  { keys: isMac ? '⌘6' : 'Ctrl+6', description: 'Task Queue' },
  { keys: isMac ? '⌘7' : 'Ctrl+7', description: 'Git' },
  { keys: isMac ? '⌘8' : 'Ctrl+8', description: 'Workflows' },
  { keys: 'Esc', description: 'Close modal' },
  { keys: 'Enter', description: 'Send message (in chat)' },
  { keys: 'Shift+Enter', description: 'New line (in chat)' }
]
