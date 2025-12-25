/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock uuid with unique values using hoisted counter
// Counter is placed first so it appears in the first 8 characters (UUID gets substring(0,8) in service)
const uuidMock = vi.hoisted(() => {
  let counter = 0
  return {
    v4: vi.fn(() => `${String(++counter).padStart(4, '0')}-mock-uuid`)
  }
})

vi.mock('uuid', () => uuidMock)

// Mock database service
const mockDb = vi.hoisted(() => ({
  exec: vi.fn(),
  prepare: vi.fn(() => ({
    all: vi.fn(() => []),
    get: vi.fn(),
    run: vi.fn(() => ({ changes: 1 }))
  }))
}))

const mockDatabaseService = vi.hoisted(() => ({
  getDb: vi.fn(() => mockDb),
  withWriteLock: vi.fn((fn) => fn()),
  withWriteLockRetry: vi.fn((fn) => fn())
}))

vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

// Import after mocking
const { agentMemoryService } = await import('./agent-memory.service')

describe('AgentMemoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    agentMemoryService.removeAllListeners()
  })

  afterEach(() => {
    vi.clearAllMocks()
    agentMemoryService.removeAllListeners()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(agentMemoryService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof agentMemoryService.startSession).toBe('function')
      expect(typeof agentMemoryService.endSession).toBe('function')
      expect(typeof agentMemoryService.getSession).toBe('function')
      expect(typeof agentMemoryService.getProjectMemory).toBe('function')
      expect(typeof agentMemoryService.recordDecision).toBe('function')
      expect(typeof agentMemoryService.recordCreatedItem).toBe('function')
      expect(typeof agentMemoryService.recordRejection).toBe('function')
      expect(typeof agentMemoryService.recordStoryDiscussion).toBe('function')
      expect(typeof agentMemoryService.getRecentDecisions).toBe('function')
      expect(typeof agentMemoryService.getRecentlyCreatedItems).toBe('function')
      expect(typeof agentMemoryService.clearSessionMemory).toBe('function')
      expect(typeof agentMemoryService.clearProjectMemory).toBe('function')
      expect(typeof agentMemoryService.cleanupExpiredMemory).toBe('function')
      expect(typeof agentMemoryService.getProjectStats).toBe('function')
    })

    it('should be an EventEmitter', () => {
      expect(typeof agentMemoryService.on).toBe('function')
      expect(typeof agentMemoryService.emit).toBe('function')
    })
  })

  describe('startSession', () => {
    it('should create a new session', () => {
      const sessionStarted = vi.fn()
      agentMemoryService.on('session-started', sessionStarted)

      const sessionId = agentMemoryService.startSession('proj-1', 'developer')

      expect(sessionId).toBeDefined()
      expect(sessionId).toMatch(/^agent_session_/)
      expect(sessionStarted).toHaveBeenCalledWith({
        sessionId,
        projectId: 'proj-1',
        agentType: 'developer'
      })
    })

    it('should generate unique session IDs', () => {
      const session1 = agentMemoryService.startSession('proj-1', 'developer')
      const session2 = agentMemoryService.startSession('proj-1', 'tester')

      expect(session1).not.toBe(session2)
    })
  })

  describe('getSession', () => {
    it('should return in-memory session', () => {
      const sessionId = agentMemoryService.startSession('proj-1', 'developer')

      const session = agentMemoryService.getSession(sessionId)

      expect(session).toBeDefined()
      expect(session?.projectId).toBe('proj-1')
      expect(session?.agentType).toBe('developer')
    })

    it('should load session from database', () => {
      const mockRecords = [
        {
          id: 'rec_1',
          session_id: 'db_session',
          project_id: 'proj-1',
          agent_type: 'tester',
          memory_type: 'decision',
          content: JSON.stringify({
            id: 'dec_1',
            type: 'approved',
            itemType: 'story',
            itemTitle: 'Test Story',
            timestamp: '2024-01-01T00:00:00Z'
          }),
          created_at: '2024-01-01T00:00:00Z',
          expires_at: null
        }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockRecords),
        get: vi.fn(),
        run: vi.fn()
      })

      const session = agentMemoryService.getSession('db_session')

      expect(session).toBeDefined()
      expect(session?.projectId).toBe('proj-1')
      expect(session?.agentType).toBe('tester')
      expect(session?.recentDecisions).toHaveLength(1)
    })

    it('should return null for non-existent session', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const session = agentMemoryService.getSession('nonexistent')

      expect(session).toBeNull()
    })
  })

  describe('endSession', () => {
    it('should end an existing session', () => {
      const sessionEnded = vi.fn()
      agentMemoryService.on('session-ended', sessionEnded)

      const sessionId = agentMemoryService.startSession('proj-1', 'developer')
      agentMemoryService.endSession(sessionId)

      expect(sessionEnded).toHaveBeenCalledWith({ sessionId })
    })

    it('should handle non-existent session gracefully', () => {
      // Should not throw
      expect(() => agentMemoryService.endSession('nonexistent')).not.toThrow()
    })
  })

  describe('recordDecision', () => {
    it('should record a decision', () => {
      const decisionRecorded = vi.fn()
      agentMemoryService.on('decision-recorded', decisionRecorded)

      const sessionId = agentMemoryService.startSession('proj-1', 'developer')
      agentMemoryService.recordDecision(sessionId, {
        type: 'approved',
        itemType: 'story',
        itemTitle: 'User Login Feature',
        reason: 'Good requirements'
      })

      expect(decisionRecorded).toHaveBeenCalled()

      const session = agentMemoryService.getSession(sessionId)
      expect(session?.recentDecisions).toHaveLength(1)
      expect(session?.recentDecisions[0].itemTitle).toBe('User Login Feature')
    })

    it('should persist decision to database', () => {
      const sessionId = agentMemoryService.startSession('proj-1', 'developer')
      agentMemoryService.recordDecision(sessionId, {
        type: 'rejected',
        itemType: 'task',
        itemTitle: 'Complex Task'
      })

      expect(mockDatabaseService.withWriteLockRetry).toHaveBeenCalled()
    })
  })

  describe('recordCreatedItem', () => {
    it('should record a created item', () => {
      const itemCreated = vi.fn()
      agentMemoryService.on('item-created', itemCreated)

      const sessionId = agentMemoryService.startSession('proj-1', 'developer')
      agentMemoryService.recordCreatedItem(sessionId, {
        id: 'story_1',
        type: 'story',
        title: 'New Story'
      })

      expect(itemCreated).toHaveBeenCalled()

      const session = agentMemoryService.getSession(sessionId)
      expect(session?.createdItems).toHaveLength(1)
      expect(session?.createdItems[0].title).toBe('New Story')
    })
  })

  describe('recordRejection', () => {
    it('should record a rejected suggestion', () => {
      const rejectionRecorded = vi.fn()
      agentMemoryService.on('rejection-recorded', rejectionRecorded)

      const sessionId = agentMemoryService.startSession('proj-1', 'developer')
      agentMemoryService.recordRejection(sessionId, 'Use MongoDB instead')

      expect(rejectionRecorded).toHaveBeenCalled()

      const session = agentMemoryService.getSession(sessionId)
      expect(session?.rejectedSuggestions).toContain('Use MongoDB instead')
    })
  })

  describe('recordStoryDiscussion', () => {
    it('should record a story discussion', () => {
      const storyDiscussed = vi.fn()
      agentMemoryService.on('story-discussed', storyDiscussed)

      const sessionId = agentMemoryService.startSession('proj-1', 'developer')
      agentMemoryService.recordStoryDiscussion(sessionId, 'story_123')

      expect(storyDiscussed).toHaveBeenCalled()

      const session = agentMemoryService.getSession(sessionId)
      expect(session?.recentStories).toContain('story_123')
    })

    it('should not duplicate story IDs', () => {
      const sessionId = agentMemoryService.startSession('proj-1', 'developer')

      agentMemoryService.recordStoryDiscussion(sessionId, 'story_123')
      agentMemoryService.recordStoryDiscussion(sessionId, 'story_123')

      const session = agentMemoryService.getSession(sessionId)
      const count = session?.recentStories.filter(s => s === 'story_123').length
      expect(count).toBe(1)
    })

    it('should limit recent stories to 10', () => {
      const sessionId = agentMemoryService.startSession('proj-1', 'developer')

      for (let i = 0; i < 15; i++) {
        agentMemoryService.recordStoryDiscussion(sessionId, `story_${i}`)
      }

      const session = agentMemoryService.getSession(sessionId)
      expect(session?.recentStories.length).toBeLessThanOrEqual(10)
    })
  })

  describe('getRecentDecisions', () => {
    it('should return recent decisions for a project', () => {
      const mockRecords = [
        {
          content: JSON.stringify({
            id: 'dec_1',
            type: 'approved',
            itemType: 'story',
            itemTitle: 'Story 1',
            timestamp: '2024-01-02T00:00:00Z'
          }),
          created_at: '2024-01-02T00:00:00Z'
        }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockRecords),
        get: vi.fn(),
        run: vi.fn()
      })

      const decisions = agentMemoryService.getRecentDecisions('proj-1', 10)

      expect(decisions).toHaveLength(1)
      expect(decisions[0].itemTitle).toBe('Story 1')
    })

    it('should handle invalid JSON gracefully', () => {
      const mockRecords = [
        { content: 'invalid json', created_at: '2024-01-01T00:00:00Z' }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockRecords),
        get: vi.fn(),
        run: vi.fn()
      })

      const decisions = agentMemoryService.getRecentDecisions('proj-1')

      expect(decisions).toEqual([])
    })
  })

  describe('getRecentlyCreatedItems', () => {
    it('should return recently created items', () => {
      const mockRecords = [
        {
          content: JSON.stringify({
            id: 'item_1',
            type: 'story',
            title: 'New Story',
            createdAt: '2024-01-01T00:00:00Z'
          }),
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockRecords),
        get: vi.fn(),
        run: vi.fn()
      })

      const items = agentMemoryService.getRecentlyCreatedItems('proj-1')

      expect(items).toHaveLength(1)
      expect(items[0].title).toBe('New Story')
    })
  })

  describe('clearSessionMemory', () => {
    it('should clear session memory', () => {
      const sessionCleared = vi.fn()
      agentMemoryService.on('session-cleared', sessionCleared)

      const sessionId = agentMemoryService.startSession('proj-1', 'developer')
      agentMemoryService.clearSessionMemory(sessionId)

      expect(sessionCleared).toHaveBeenCalledWith({ sessionId })
      expect(mockDatabaseService.withWriteLock).toHaveBeenCalled()
    })
  })

  describe('clearProjectMemory', () => {
    it('should clear all project memory', () => {
      const projectMemoryCleared = vi.fn()
      agentMemoryService.on('project-memory-cleared', projectMemoryCleared)

      agentMemoryService.clearProjectMemory('proj-1')

      expect(projectMemoryCleared).toHaveBeenCalledWith({ projectId: 'proj-1' })
      expect(mockDatabaseService.withWriteLock).toHaveBeenCalled()
    })
  })

  describe('cleanupExpiredMemory', () => {
    it('should delete expired records', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 5 }))
      })

      const memoryCleaned = vi.fn()
      agentMemoryService.on('memory-cleaned', memoryCleaned)

      const deleted = agentMemoryService.cleanupExpiredMemory()

      expect(deleted).toBe(5)
      expect(memoryCleaned).toHaveBeenCalledWith({ deletedCount: 5 })
    })

    it('should not emit event when nothing deleted', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 0 }))
      })

      const memoryCleaned = vi.fn()
      agentMemoryService.on('memory-cleaned', memoryCleaned)

      const deleted = agentMemoryService.cleanupExpiredMemory()

      expect(deleted).toBe(0)
      expect(memoryCleaned).not.toHaveBeenCalled()
    })
  })

  describe('getProjectStats', () => {
    it('should return project statistics', () => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('COUNT(DISTINCT session_id)')) {
          return {
            all: vi.fn(),
            get: vi.fn(() => ({ count: 3 })),
            run: vi.fn()
          }
        }
        if (query.includes('GROUP BY memory_type')) {
          return {
            all: vi.fn(() => [
              { memory_type: 'decision', count: 10 },
              { memory_type: 'created_item', count: 5 },
              { memory_type: 'rejection', count: 2 },
              { memory_type: 'story_discussion', count: 8 }
            ]),
            get: vi.fn(),
            run: vi.fn()
          }
        }
        return {
          all: vi.fn(() => []),
          get: vi.fn(),
          run: vi.fn()
        }
      })

      const stats = agentMemoryService.getProjectStats('proj-1')

      expect(stats.totalSessions).toBe(3)
      expect(stats.totalDecisions).toBe(10)
      expect(stats.totalCreatedItems).toBe(5)
      expect(stats.totalRejections).toBe(2)
      expect(stats.totalStoryDiscussions).toBe(8)
    })
  })

  describe('getProjectMemory', () => {
    it('should return all sessions for a project', () => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('SELECT DISTINCT session_id')) {
          return {
            all: vi.fn(() => [
              { session_id: 'session_1', agent_type: 'developer' },
              { session_id: 'session_2', agent_type: 'tester' }
            ]),
            get: vi.fn(),
            run: vi.fn()
          }
        }
        if (query.includes('WHERE session_id =')) {
          return {
            all: vi.fn(() => [
              {
                id: 'rec_1',
                session_id: 'session_1',
                project_id: 'proj-1',
                agent_type: 'developer',
                memory_type: 'decision',
                content: JSON.stringify({
                  id: 'dec_1',
                  type: 'approved',
                  itemType: 'story',
                  itemTitle: 'Test',
                  timestamp: '2024-01-01T00:00:00Z'
                }),
                created_at: '2024-01-01T00:00:00Z',
                expires_at: null
              }
            ]),
            get: vi.fn(),
            run: vi.fn()
          }
        }
        return {
          all: vi.fn(() => []),
          get: vi.fn(),
          run: vi.fn()
        }
      })

      const memories = agentMemoryService.getProjectMemory('proj-1')

      expect(memories.length).toBeGreaterThan(0)
    })
  })
})
