/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock database service
const mockDb = vi.hoisted(() => ({
  prepare: vi.fn(() => ({
    all: vi.fn(),
    get: vi.fn(),
    run: vi.fn(() => ({ changes: 1 }))
  }))
}))

const mockDatabaseService = vi.hoisted(() => ({
  getDb: vi.fn(() => mockDb)
}))

// Mock task queue service
const mockTaskQueueService = vi.hoisted(() => ({
  enqueueTask: vi.fn((input) => ({
    id: `task_${Date.now()}_mock`,
    ...input,
    status: 'pending',
    createdAt: new Date()
  }))
}))

// Mock claude service with proper event handling
const eventHandlers = new Map<string, Function[]>()

const mockClaudeService = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  on: vi.fn((event: string, handler: Function) => {
    if (!eventHandlers.has(event)) {
      eventHandlers.set(event, [])
    }
    eventHandlers.get(event)!.push(handler)
  }),
  removeListener: vi.fn((event: string, handler: Function) => {
    const handlers = eventHandlers.get(event)
    if (handlers) {
      const idx = handlers.indexOf(handler)
      if (idx !== -1) handlers.splice(idx, 1)
    }
  }),
  removeAllListeners: vi.fn(() => {
    eventHandlers.clear()
  }),
  emit: (event: string, data: unknown) => {
    const handlers = eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(h => h(data))
    }
  }
}))

vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

vi.mock('./task-queue.service', () => ({
  taskQueueService: mockTaskQueueService
}))

vi.mock('./claude.service', () => ({
  claudeService: mockClaudeService
}))

// Import after mocking
const { taskDecomposerService } = await import('./task-decomposer.service')

// Helper to trigger complete event
function triggerComplete(sessionIdPattern: string, content: string): void {
  // Small delay to allow the service to register handlers
  setTimeout(() => {
    mockClaudeService.emit('complete', {
      sessionId: sessionIdPattern,
      content
    })
  }, 5)
}

describe('TaskDecomposerService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eventHandlers.clear()
    taskDecomposerService.removeAllListeners()

    // Default mock implementation for sendMessage
    mockClaudeService.sendMessage.mockImplementation(async (opts: { sessionId: string }) => {
      // Trigger complete event after a small delay
      setTimeout(() => {
        mockClaudeService.emit('complete', {
          sessionId: opts.sessionId,
          content: ''
        })
      }, 5)
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    eventHandlers.clear()
    taskDecomposerService.removeAllListeners()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(taskDecomposerService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof taskDecomposerService.decompose).toBe('function')
      expect(typeof taskDecomposerService.suggestAgents).toBe('function')
      expect(typeof taskDecomposerService.estimateDuration).toBe('function')
    })

    it('should be an EventEmitter', () => {
      expect(typeof taskDecomposerService.on).toBe('function')
      expect(typeof taskDecomposerService.emit).toBe('function')
    })
  })

  describe('decompose', () => {
    it('should emit decomposition-started event', async () => {
      const started = vi.fn()
      taskDecomposerService.on('decomposition-started', started)

      await taskDecomposerService.decompose({
        projectId: 'proj-1',
        title: 'Build user authentication',
        description: 'Implement OAuth login',
        projectPath: '/project'
      })

      expect(started).toHaveBeenCalledWith('Build user authentication')
    })

    it('should return result without enqueuing when enqueueImmediately is false', async () => {
      mockClaudeService.sendMessage.mockImplementation(async (opts: { sessionId: string }) => {
        setTimeout(() => {
          mockClaudeService.emit('complete', {
            sessionId: opts.sessionId,
            content: `---SUBTASK---
INDEX: 0
TITLE: Set up database
DESCRIPTION: Create database tables
TASK_TYPE: code-generation
AGENT_TYPE: developer
ESTIMATED_MINUTES: 30
DEPENDS_ON: none
PRIORITY: 80
---END---`
          })
        }, 5)
      })

      const result = await taskDecomposerService.decompose({
        projectId: 'proj-1',
        title: 'Build feature',
        description: 'Description',
        projectPath: '/project',
        enqueueImmediately: false
      })

      expect(result.parentTask).toBeNull()
      expect(result.enqueuedTasks).toEqual([])
      expect(result.subtasks.length).toBeGreaterThan(0)
    })

    it('should enqueue tasks when enqueueImmediately is true', async () => {
      mockClaudeService.sendMessage.mockImplementation(async (opts: { sessionId: string }) => {
        setTimeout(() => {
          mockClaudeService.emit('complete', {
            sessionId: opts.sessionId,
            content: `---SUBTASK---
INDEX: 0
TITLE: First task
DESCRIPTION: Do first thing
TASK_TYPE: code-generation
AGENT_TYPE: developer
ESTIMATED_MINUTES: 30
DEPENDS_ON: none
PRIORITY: 80
---END---`
          })
        }, 5)
      })

      const result = await taskDecomposerService.decompose({
        projectId: 'proj-1',
        title: 'Build feature',
        description: 'Description',
        projectPath: '/project',
        enqueueImmediately: true
      })

      expect(result.parentTask).toBeDefined()
      expect(result.enqueuedTasks.length).toBeGreaterThan(0)
      expect(mockTaskQueueService.enqueueTask).toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      const errorEmitted = vi.fn()
      taskDecomposerService.on('decomposition-error', errorEmitted)

      mockClaudeService.sendMessage.mockRejectedValue(new Error('API Error'))

      await expect(
        taskDecomposerService.decompose({
          projectId: 'proj-1',
          title: 'Task',
          description: 'Desc',
          projectPath: '/project'
        })
      ).rejects.toThrow()

      expect(errorEmitted).toHaveBeenCalled()
    })
  })

  describe('suggestAgents', () => {
    it('should be a function', () => {
      expect(typeof taskDecomposerService.suggestAgents).toBe('function')
    })

    it('should return agent suggestions', async () => {
      mockClaudeService.sendMessage.mockImplementation(async (opts: { sessionId: string }) => {
        setTimeout(() => {
          mockClaudeService.emit('complete', {
            sessionId: opts.sessionId,
            content: `---AGENT---
TYPE: developer
CONFIDENCE: 90
REASON: Code generation task
---END---
---AGENT---
TYPE: tester
CONFIDENCE: 70
REASON: Needs testing
---END---`
          })
        }, 5)
      })

      const suggestions = await taskDecomposerService.suggestAgents(
        'Build login feature with OAuth',
        '/project'
      )

      expect(Array.isArray(suggestions)).toBe(true)
      // Results are sorted by confidence
      if (suggestions.length > 1) {
        expect(suggestions[0].confidence).toBeGreaterThanOrEqual(suggestions[1].confidence)
      }
    })
  })

  describe('estimateDuration', () => {
    it('should be a function', () => {
      expect(typeof taskDecomposerService.estimateDuration).toBe('function')
    })

    it('should return duration estimate', async () => {
      mockClaudeService.sendMessage.mockImplementation(async (opts: { sessionId: string }) => {
        setTimeout(() => {
          mockClaudeService.emit('complete', {
            sessionId: opts.sessionId,
            content: `ESTIMATED_MINUTES: 45
CONFIDENCE: 75
BREAKDOWN: Complex feature requiring multiple components`
          })
        }, 5)
      })

      const estimate = await taskDecomposerService.estimateDuration(
        'Build user dashboard',
        'code-generation',
        '/project'
      )

      expect(estimate).toHaveProperty('minutes')
      expect(estimate).toHaveProperty('confidence')
      expect(estimate).toHaveProperty('breakdown')
    })
  })

  describe('parsing', () => {
    it('should parse task types correctly', async () => {
      mockClaudeService.sendMessage.mockImplementation(async (opts: { sessionId: string }) => {
        setTimeout(() => {
          mockClaudeService.emit('complete', {
            sessionId: opts.sessionId,
            content: `---SUBTASK---
INDEX: 0
TITLE: Write tests
DESCRIPTION: Create unit tests
TASK_TYPE: testing
AGENT_TYPE: tester
ESTIMATED_MINUTES: 60
DEPENDS_ON: none
PRIORITY: 70
---END---`
          })
        }, 5)
      })

      const result = await taskDecomposerService.decompose({
        projectId: 'proj-1',
        title: 'Test task',
        description: 'Desc',
        projectPath: '/project',
        enqueueImmediately: false
      })

      expect(result.subtasks[0].taskType).toBe('testing')
      expect(result.subtasks[0].agentType).toBe('tester')
    })

    it('should parse dependencies correctly', async () => {
      mockClaudeService.sendMessage.mockImplementation(async (opts: { sessionId: string }) => {
        setTimeout(() => {
          mockClaudeService.emit('complete', {
            sessionId: opts.sessionId,
            content: `---SUBTASK---
INDEX: 0
TITLE: First task
DESCRIPTION: Do first
TASK_TYPE: code-generation
AGENT_TYPE: developer
ESTIMATED_MINUTES: 30
DEPENDS_ON: none
PRIORITY: 90
---END---
---SUBTASK---
INDEX: 1
TITLE: Second task
DESCRIPTION: Do second
TASK_TYPE: testing
AGENT_TYPE: tester
ESTIMATED_MINUTES: 45
DEPENDS_ON: 0
PRIORITY: 80
---END---`
          })
        }, 5)
      })

      const result = await taskDecomposerService.decompose({
        projectId: 'proj-1',
        title: 'Multi-task',
        description: 'Desc',
        projectPath: '/project',
        enqueueImmediately: false
      })

      expect(result.subtasks).toHaveLength(2)
      expect(result.subtasks[0].dependencies).toEqual([])
      expect(result.subtasks[1].dependencies).toContain(0)
    })

    it('should handle invalid task types with default', async () => {
      mockClaudeService.sendMessage.mockImplementation(async (opts: { sessionId: string }) => {
        setTimeout(() => {
          mockClaudeService.emit('complete', {
            sessionId: opts.sessionId,
            content: `---SUBTASK---
INDEX: 0
TITLE: Invalid type task
DESCRIPTION: Task with invalid type
TASK_TYPE: invalid-type
AGENT_TYPE: invalid-agent
ESTIMATED_MINUTES: 30
DEPENDS_ON: none
PRIORITY: 50
---END---`
          })
        }, 5)
      })

      const result = await taskDecomposerService.decompose({
        projectId: 'proj-1',
        title: 'Task',
        description: 'Desc',
        projectPath: '/project',
        enqueueImmediately: false
      })

      // Should fall back to defaults
      expect(result.subtasks[0].taskType).toBe('code-generation')
      expect(result.subtasks[0].agentType).toBe('developer')
    })

    it('should handle missing optional fields', async () => {
      mockClaudeService.sendMessage.mockImplementation(async (opts: { sessionId: string }) => {
        setTimeout(() => {
          mockClaudeService.emit('complete', {
            sessionId: opts.sessionId,
            content: `---SUBTASK---
TITLE: Minimal task
---END---`
          })
        }, 5)
      })

      const result = await taskDecomposerService.decompose({
        projectId: 'proj-1',
        title: 'Task',
        description: 'Desc',
        projectPath: '/project',
        enqueueImmediately: false
      })

      expect(result.subtasks).toHaveLength(1)
      expect(result.subtasks[0].title).toBe('Minimal task')
      expect(result.subtasks[0].estimatedDuration).toBe(30) // default
      expect(result.subtasks[0].priority).toBe(50) // default
    })
  })

  describe('autonomy levels', () => {
    it('should use provided autonomy level', async () => {
      mockClaudeService.sendMessage.mockImplementation(async (opts: { sessionId: string }) => {
        setTimeout(() => {
          mockClaudeService.emit('complete', {
            sessionId: opts.sessionId,
            content: `---SUBTASK---
INDEX: 0
TITLE: Task
DESCRIPTION: Desc
TASK_TYPE: code-generation
AGENT_TYPE: developer
ESTIMATED_MINUTES: 30
DEPENDS_ON: none
PRIORITY: 50
---END---`
          })
        }, 5)
      })

      await taskDecomposerService.decompose({
        projectId: 'proj-1',
        title: 'Task',
        description: 'Desc',
        projectPath: '/project',
        autonomyLevel: 'auto',
        enqueueImmediately: true
      })

      // Check that enqueueTask was called with the correct autonomy level
      expect(mockTaskQueueService.enqueueTask).toHaveBeenCalledWith(
        expect.objectContaining({
          autonomyLevel: 'auto'
        })
      )
    })

    it('should default to supervised autonomy', async () => {
      mockClaudeService.sendMessage.mockImplementation(async (opts: { sessionId: string }) => {
        setTimeout(() => {
          mockClaudeService.emit('complete', {
            sessionId: opts.sessionId,
            content: `---SUBTASK---
INDEX: 0
TITLE: Task
DESCRIPTION: Desc
TASK_TYPE: code-generation
AGENT_TYPE: developer
ESTIMATED_MINUTES: 30
DEPENDS_ON: none
PRIORITY: 50
---END---`
          })
        }, 5)
      })

      await taskDecomposerService.decompose({
        projectId: 'proj-1',
        title: 'Task',
        description: 'Desc',
        projectPath: '/project',
        enqueueImmediately: true
        // No autonomyLevel provided
      })

      expect(mockTaskQueueService.enqueueTask).toHaveBeenCalledWith(
        expect.objectContaining({
          autonomyLevel: 'supervised'
        })
      )
    })
  })

  describe('events', () => {
    it('should emit decomposition-complete event', async () => {
      const completed = vi.fn()
      taskDecomposerService.on('decomposition-complete', completed)

      await taskDecomposerService.decompose({
        projectId: 'proj-1',
        title: 'Task',
        description: 'Desc',
        projectPath: '/project'
      })

      expect(completed).toHaveBeenCalled()
    })
  })
})
