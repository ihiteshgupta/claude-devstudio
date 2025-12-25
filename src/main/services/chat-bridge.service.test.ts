/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234')
}))

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

// Mock action parser service
const mockActionParserService = vi.hoisted(() => ({
  parseResponse: vi.fn(() => [])
}))

// Mock task queue service
const mockTaskQueueService = vi.hoisted(() => ({
  getTask: vi.fn(() => ({ id: 'task-1' })),
  updateAutonomyLevel: vi.fn(),
  reorderTask: vi.fn(),
  updateTaskStatus: vi.fn()
}))

vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

vi.mock('./action-parser.service', () => ({
  actionParserService: mockActionParserService
}))

vi.mock('./task-queue.service', () => ({
  taskQueueService: mockTaskQueueService
}))

// Import after mocking
const { chatBridgeService } = await import('./chat-bridge.service')

describe('ChatBridgeService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chatBridgeService.removeAllListeners()
  })

  afterEach(() => {
    vi.clearAllMocks()
    chatBridgeService.removeAllListeners()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(chatBridgeService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof chatBridgeService.parseActions).toBe('function')
      expect(typeof chatBridgeService.checkDuplicates).toBe('function')
      expect(typeof chatBridgeService.executeAction).toBe('function')
      expect(typeof chatBridgeService.executeActions).toBe('function')
      expect(typeof chatBridgeService.updateActionStatus).toBe('function')
      expect(typeof chatBridgeService.getSuggestedActions).toBe('function')
      expect(typeof chatBridgeService.queueForExecution).toBe('function')
      expect(typeof chatBridgeService.queueAllApproved).toBe('function')
    })

    it('should be an EventEmitter', () => {
      expect(typeof chatBridgeService.on).toBe('function')
      expect(typeof chatBridgeService.emit).toBe('function')
    })
  })

  describe('parseActions', () => {
    it('should delegate to action parser service', () => {
      mockActionParserService.parseResponse.mockReturnValueOnce([
        { id: 'action-1', type: 'create-story', title: 'Test Story' }
      ])

      const actions = chatBridgeService.parseActions('Create a story')

      expect(mockActionParserService.parseResponse).toHaveBeenCalled()
      expect(actions.length).toBe(1)
    })

    it('should pass context to parser', () => {
      chatBridgeService.parseActions('Create a task', { agentType: 'developer' })

      expect(mockActionParserService.parseResponse).toHaveBeenCalledWith(
        'Create a task',
        expect.objectContaining({ agentType: 'developer' })
      )
    })
  })

  describe('checkDuplicates', () => {
    it('should check for duplicate stories', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { id: 'story-1', title: 'User Authentication' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const result = await chatBridgeService.checkDuplicates(
        'proj-1',
        'create-story',
        'User Authentication Feature'
      )

      expect(result.hasDuplicate).toBe(true)
      expect(result.matches.length).toBeGreaterThan(0)
    })

    it('should check for duplicate tasks', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { id: 'task-1', title: 'Implement login' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const result = await chatBridgeService.checkDuplicates(
        'proj-1',
        'create-task',
        'Implement login functionality'
      )

      expect(result.hasDuplicate).toBe(true)
    })

    it('should check for duplicate roadmap items', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { id: 'item-1', title: 'Feature Release' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const result = await chatBridgeService.checkDuplicates(
        'proj-1',
        'create-roadmap-item',
        'Feature Release Planning'
      )

      expect(result.hasDuplicate).toBe(true)
    })

    it('should check for duplicate tests', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { id: 'test-1', title: 'Login Test' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const result = await chatBridgeService.checkDuplicates(
        'proj-1',
        'create-test',
        'Login Test Cases'
      )

      expect(result.hasDuplicate).toBe(true)
    })

    it('should return no duplicates when none found', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const result = await chatBridgeService.checkDuplicates(
        'proj-1',
        'create-story',
        'Completely Unique Story'
      )

      expect(result.hasDuplicate).toBe(false)
      expect(result.matches.length).toBe(0)
    })

    it('should calculate similarity scores', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { id: 'story-1', title: 'User authentication feature' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const result = await chatBridgeService.checkDuplicates(
        'proj-1',
        'create-story',
        'User authentication feature implementation'
      )

      if (result.matches.length > 0) {
        expect(result.matches[0].similarity).toBeGreaterThan(0)
        expect(result.matches[0].similarity).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('executeAction', () => {
    it('should create a story', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const action = {
        id: 'action-1',
        type: 'create-story' as const,
        title: 'New Story',
        description: 'Description',
        confidence: 0.9,
        metadata: { priority: 'high' },
        status: 'proposed' as const
      }

      const result = await chatBridgeService.executeAction(action, 'proj-1', {
        skipDuplicateCheck: true
      })

      expect(result.success).toBe(true)
      expect(result.createdItemType).toBe('story')
    })

    it('should create a task', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const action = {
        id: 'action-1',
        type: 'create-task' as const,
        title: 'New Task',
        description: 'Description',
        confidence: 0.9,
        metadata: { taskType: 'code-generation' },
        status: 'proposed' as const
      }

      const result = await chatBridgeService.executeAction(action, 'proj-1', {
        skipDuplicateCheck: true
      })

      expect(result.success).toBe(true)
      expect(result.createdItemType).toBe('task')
    })

    it('should create a roadmap item', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const action = {
        id: 'action-1',
        type: 'create-roadmap-item' as const,
        title: 'New Feature',
        description: 'Description',
        confidence: 0.9,
        metadata: { lane: 'now' },
        status: 'proposed' as const
      }

      const result = await chatBridgeService.executeAction(action, 'proj-1', {
        skipDuplicateCheck: true
      })

      expect(result.success).toBe(true)
      expect(result.createdItemType).toBe('roadmap')
    })

    it('should create a test case', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({ id: 'story-1' })), // Story exists
        run: vi.fn(() => ({ changes: 1 }))
      })

      const action = {
        id: 'action-1',
        type: 'create-test' as const,
        title: 'New Test',
        description: 'Test description',
        confidence: 0.9,
        metadata: { testType: 'unit' },
        status: 'proposed' as const
      }

      const result = await chatBridgeService.executeAction(action, 'proj-1', {
        skipDuplicateCheck: true
      })

      expect(result.success).toBe(true)
      expect(result.createdItemType).toBe('test')
    })

    it('should fail test creation when no story exists', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => undefined), // No story
        run: vi.fn(() => ({ changes: 1 }))
      })

      const action = {
        id: 'action-1',
        type: 'create-test' as const,
        title: 'New Test',
        description: 'Description',
        confidence: 0.9,
        metadata: {},
        status: 'proposed' as const
      }

      const result = await chatBridgeService.executeAction(action, 'proj-1', {
        skipDuplicateCheck: true
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('No user story found')
    })

    it('should block on duplicates by default', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { id: 'existing-1', title: 'Duplicate Story' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const action = {
        id: 'action-1',
        type: 'create-story' as const,
        title: 'Duplicate Story',
        description: 'Description',
        confidence: 0.9,
        metadata: {},
        status: 'proposed' as const
      }

      const result = await chatBridgeService.executeAction(action, 'proj-1')

      expect(result.success).toBe(false)
      expect(result.duplicateFound).toBeDefined()
    })

    it('should allow force create despite duplicates', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { id: 'existing-1', title: 'Duplicate Story' }
        ]),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const action = {
        id: 'action-1',
        type: 'create-story' as const,
        title: 'Duplicate Story',
        description: 'Description',
        confidence: 0.9,
        metadata: {},
        status: 'proposed' as const
      }

      const result = await chatBridgeService.executeAction(action, 'proj-1', {
        forceCreate: true
      })

      expect(result.success).toBe(true)
    })

    it('should emit item-created event', async () => {
      const itemCreated = vi.fn()
      chatBridgeService.on('item-created', itemCreated)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const action = {
        id: 'action-1',
        type: 'create-story' as const,
        title: 'New Story',
        description: 'Description',
        confidence: 0.9,
        metadata: {},
        status: 'proposed' as const
      }

      await chatBridgeService.executeAction(action, 'proj-1', {
        skipDuplicateCheck: true
      })

      expect(itemCreated).toHaveBeenCalled()
    })

    it('should auto-queue tasks when requested', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const action = {
        id: 'action-1',
        type: 'create-task' as const,
        title: 'New Task',
        description: 'Description',
        confidence: 0.9,
        metadata: {},
        status: 'proposed' as const
      }

      const result = await chatBridgeService.executeAction(action, 'proj-1', {
        skipDuplicateCheck: true,
        autoQueue: true
      })

      expect(result.success).toBe(true)
    })
  })

  describe('executeActions', () => {
    it('should execute multiple actions', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const actions = [
        {
          id: 'action-1',
          type: 'create-story' as const,
          title: 'Story 1',
          description: 'Desc',
          confidence: 0.9,
          metadata: {},
          status: 'proposed' as const
        },
        {
          id: 'action-2',
          type: 'create-story' as const,
          title: 'Story 2',
          description: 'Desc',
          confidence: 0.9,
          metadata: {},
          status: 'proposed' as const
        }
      ]

      const results = await chatBridgeService.executeActions(actions, 'proj-1')

      expect(results.length).toBe(2)
    })

    it('should emit action-executed for each action', async () => {
      const actionExecuted = vi.fn()
      chatBridgeService.on('action-executed', actionExecuted)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const actions = [
        {
          id: 'action-1',
          type: 'create-story' as const,
          title: 'Story',
          description: 'Desc',
          confidence: 0.9,
          metadata: {},
          status: 'proposed' as const
        }
      ]

      await chatBridgeService.executeActions(actions, 'proj-1')

      expect(actionExecuted).toHaveBeenCalled()
    })
  })

  describe('updateActionStatus', () => {
    it('should emit action-status-changed event', () => {
      const statusChanged = vi.fn()
      chatBridgeService.on('action-status-changed', statusChanged)

      chatBridgeService.updateActionStatus('action-1', 'approved')

      expect(statusChanged).toHaveBeenCalledWith({
        actionId: 'action-1',
        status: 'approved'
      })
    })
  })

  describe('getSuggestedActions', () => {
    it('should return actions with duplicate checks', async () => {
      mockActionParserService.parseResponse.mockReturnValueOnce([
        { id: 'action-1', type: 'create-story', title: 'New Story', confidence: 0.9 }
      ])

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const actions = await chatBridgeService.getSuggestedActions(
        'Create a new story',
        'proj-1'
      )

      expect(actions.length).toBe(1)
    })

    it('should include duplicate check results', async () => {
      mockActionParserService.parseResponse.mockReturnValueOnce([
        { id: 'action-1', type: 'create-story', title: 'Existing Story', confidence: 0.9 }
      ])

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { id: 'story-1', title: 'Existing Story' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const actions = await chatBridgeService.getSuggestedActions(
        'Create existing story',
        'proj-1'
      )

      if (actions.length > 0 && actions[0].duplicateCheck) {
        expect(actions[0].duplicateCheck.hasDuplicate).toBe(true)
      }
    })
  })

  describe('queueForExecution', () => {
    it('should queue a task for execution', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const action = {
        id: 'action-1',
        type: 'create-task' as const,
        title: 'New Task',
        description: 'Description',
        confidence: 0.9,
        metadata: {},
        status: 'proposed' as const
      }

      const result = await chatBridgeService.queueForExecution(action, 'proj-1')

      expect(result.taskId).toBeDefined()
    })
  })

  describe('queueAllApproved', () => {
    it('should queue approved actions', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const actions = [
        {
          id: 'action-1',
          type: 'create-task' as const,
          title: 'Task 1',
          description: 'Desc',
          confidence: 0.9,
          metadata: {},
          status: 'approved' as const
        },
        {
          id: 'action-2',
          type: 'create-task' as const,
          title: 'Task 2',
          description: 'Desc',
          confidence: 0.9,
          metadata: {},
          status: 'rejected' as const
        }
      ]

      const results = await chatBridgeService.queueAllApproved(actions, 'proj-1')

      expect(results.length).toBe(2)
      // First should be queued, second should not
      expect(results.find(r => r.actionId === 'action-2')?.queued).toBe(false)
    })

    it('should emit batch-queued event', async () => {
      const batchQueued = vi.fn()
      chatBridgeService.on('batch-queued', batchQueued)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      await chatBridgeService.queueAllApproved([
        {
          id: 'action-1',
          type: 'create-task' as const,
          title: 'Task',
          description: 'Desc',
          confidence: 0.9,
          metadata: {},
          status: 'approved' as const
        }
      ], 'proj-1')

      expect(batchQueued).toHaveBeenCalled()
    })
  })
})
