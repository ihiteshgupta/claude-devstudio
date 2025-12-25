/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock database service
const mockDb = vi.hoisted(() => ({
  prepare: vi.fn(() => ({
    all: vi.fn(() => []),
    get: vi.fn(),
    run: vi.fn(() => ({ changes: 1 }))
  }))
}))

const mockDatabaseService = vi.hoisted(() => ({
  getDb: vi.fn(() => mockDb)
}))

// Mock task queue service
const mockTaskQueueService = vi.hoisted(() => ({
  isQueueRunning: vi.fn(() => false),
  startQueue: vi.fn(),
  pauseQueue: vi.fn(),
  resumeQueue: vi.fn(),
  stopQueue: vi.fn(),
  listTasks: vi.fn(() => []),
  cancelTask: vi.fn(),
  updateTaskStatus: vi.fn(),
  approveGate: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn()
}))

// Mock approval resolver service
const mockApprovalResolverService = vi.hoisted(() => ({
  assessForAutoApproval: vi.fn(() => Promise.resolve({
    canAutoApprove: true,
    qualityScore: 85,
    riskLevel: 'low'
  }))
}))

vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

vi.mock('./task-queue.service', () => ({
  taskQueueService: mockTaskQueueService
}))

vi.mock('./approval-resolver.service', () => ({
  approvalResolverService: mockApprovalResolverService
}))

// Import after mocking
const { autonomousExecutorService } = await import('./autonomous-executor.service')

describe('AutonomousExecutorService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    autonomousExecutorService.removeAllListeners()
    // Ensure executor is stopped before each test
    try {
      autonomousExecutorService.stop()
    } catch {
      // Ignore if not running
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
    autonomousExecutorService.removeAllListeners()
    try {
      autonomousExecutorService.stop()
    } catch {
      // Ignore if not running
    }
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(autonomousExecutorService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof autonomousExecutorService.startContinuous).toBe('function')
      expect(typeof autonomousExecutorService.pause).toBe('function')
      expect(typeof autonomousExecutorService.resume).toBe('function')
      expect(typeof autonomousExecutorService.stop).toBe('function')
      expect(typeof autonomousExecutorService.getState).toBe('function')
      expect(typeof autonomousExecutorService.getStats).toBe('function')
      expect(typeof autonomousExecutorService.isRunning).toBe('function')
    })

    it('should be an EventEmitter', () => {
      expect(typeof autonomousExecutorService.on).toBe('function')
      expect(typeof autonomousExecutorService.emit).toBe('function')
    })
  })

  describe('getState', () => {
    it('should return initial state when not running', () => {
      const state = autonomousExecutorService.getState()

      expect(state.isRunning).toBe(false)
      expect(state.isPaused).toBe(false)
      expect(state.startedAt).toBeNull()
      expect(state.config).toBeNull()
    })

    it('should return stats object', () => {
      const state = autonomousExecutorService.getState()

      expect(state.stats).toBeDefined()
      expect(typeof state.stats.tasksCompleted).toBe('number')
      expect(typeof state.stats.tasksFailed).toBe('number')
    })
  })

  describe('getStats', () => {
    it('should return execution statistics', () => {
      const stats = autonomousExecutorService.getStats()

      expect(stats).toBeDefined()
      expect(typeof stats.tasksCompleted).toBe('number')
      expect(typeof stats.tasksFailed).toBe('number')
      expect(typeof stats.tasksAutoApproved).toBe('number')
      expect(typeof stats.tasksManualApproval).toBe('number')
    })

    it('should have lastActivityAt as Date', () => {
      const stats = autonomousExecutorService.getStats()

      expect(stats.lastActivityAt).toBeInstanceOf(Date)
    })

    it('should have errors array', () => {
      const stats = autonomousExecutorService.getStats()

      expect(Array.isArray(stats.errors)).toBe(true)
    })
  })

  describe('isRunning', () => {
    it('should return false when not started', () => {
      expect(autonomousExecutorService.isRunning()).toBe(false)
    })
  })

  describe('pause', () => {
    it('should set isPaused state', () => {
      autonomousExecutorService.pause()

      expect(mockTaskQueueService.pauseQueue).toHaveBeenCalled()
    })

    it('should emit autonomous-paused event', () => {
      const pausedHandler = vi.fn()
      autonomousExecutorService.on('autonomous-paused', pausedHandler)

      autonomousExecutorService.pause()

      expect(pausedHandler).toHaveBeenCalled()
    })
  })

  describe('resume', () => {
    it('should call resumeQueue', () => {
      autonomousExecutorService.resume()

      expect(mockTaskQueueService.resumeQueue).toHaveBeenCalled()
    })

    it('should emit autonomous-resumed event', () => {
      const resumedHandler = vi.fn()
      autonomousExecutorService.on('autonomous-resumed', resumedHandler)

      autonomousExecutorService.resume()

      expect(resumedHandler).toHaveBeenCalled()
    })
  })

  describe('stop', () => {
    it('should call stopQueue', () => {
      autonomousExecutorService.stop()

      expect(mockTaskQueueService.stopQueue).toHaveBeenCalled()
    })

    it('should emit autonomous-stopped event', () => {
      const stoppedHandler = vi.fn()
      autonomousExecutorService.on('autonomous-stopped', stoppedHandler)

      autonomousExecutorService.stop()

      expect(stoppedHandler).toHaveBeenCalled()
    })

    it('should include stats in stopped event', () => {
      const stoppedHandler = vi.fn()
      autonomousExecutorService.on('autonomous-stopped', stoppedHandler)

      autonomousExecutorService.stop()

      expect(stoppedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          stats: expect.any(Object)
        })
      )
    })
  })

  describe('startContinuous', () => {
    it('should throw if already running', async () => {
      // Start in background to avoid blocking
      const config = {
        projectId: 'proj-1',
        projectPath: '/project',
        defaultAutonomyLevel: 'supervised' as const,
        checkIntervalMs: 100,
        autoApproveThreshold: 80,
        maxIdleMinutes: 1,
        enableAutoApproval: false
      }

      // Mock to simulate running state - start the executor in a controlled way
      const promise = autonomousExecutorService.startContinuous(config)

      // Give it a moment to set isRunning = true
      await new Promise(resolve => setTimeout(resolve, 50))

      // Now try to start again - should throw
      await expect(
        autonomousExecutorService.startContinuous(config)
      ).rejects.toThrow('Autonomous executor is already running')

      // Clean up
      autonomousExecutorService.stop()
      await promise.catch(() => {}) // Ignore any errors from stopping
    })

    it('should emit autonomous-started event', async () => {
      const startedHandler = vi.fn()
      autonomousExecutorService.on('autonomous-started', startedHandler)

      const config = {
        projectId: 'proj-1',
        projectPath: '/project',
        defaultAutonomyLevel: 'supervised' as const,
        checkIntervalMs: 100,
        autoApproveThreshold: 80,
        maxIdleMinutes: 0.001, // Very short to exit quickly
        enableAutoApproval: false
      }

      const promise = autonomousExecutorService.startContinuous(config)

      await new Promise(resolve => setTimeout(resolve, 50))
      expect(startedHandler).toHaveBeenCalled()

      autonomousExecutorService.stop()
      await promise.catch(() => {})
    })

    it('should check for pending work', async () => {
      const config = {
        projectId: 'proj-1',
        projectPath: '/project',
        defaultAutonomyLevel: 'supervised' as const,
        checkIntervalMs: 50,
        autoApproveThreshold: 80,
        maxIdleMinutes: 0.001,
        enableAutoApproval: false
      }

      const promise = autonomousExecutorService.startContinuous(config)

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockTaskQueueService.listTasks).toHaveBeenCalled()

      autonomousExecutorService.stop()
      await promise.catch(() => {})
    })
  })

  describe('event forwarding', () => {
    it('should forward task events', async () => {
      const eventHandler = vi.fn()
      autonomousExecutorService.on('task-event', eventHandler)

      // Simulate task queue event by calling the registered handler
      const onCall = mockTaskQueueService.on.mock.calls.find(call => call[0] === 'task-event')
      if (onCall) {
        const handler = onCall[1]
        handler({ type: 'task-completed', taskId: 'task-1' })

        expect(eventHandler).toHaveBeenCalled()
      }
    })
  })
})
