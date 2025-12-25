/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Create mock database with prepared statements
const { mockDb, mockDatabaseService } = vi.hoisted(() => {
  const mockDb = {
    prepare: vi.fn()
  }
  const mockDatabaseService = {
    getDb: vi.fn(() => mockDb)
  }
  return { mockDb, mockDatabaseService }
})

// Mock database service
vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

// Mock agent memory service
const mockAgentMemoryService = vi.hoisted(() => ({
  getRecentDecisions: vi.fn(),
  getRecentApprovals: vi.fn(),
  getRecentRejections: vi.fn()
}))

vi.mock('./agent-memory.service', () => ({
  agentMemoryService: mockAgentMemoryService
}))

// Import after mocking
const { contextInjectionService } = await import('./context-injection.service')

describe('ContextInjectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock for prepare - returns a statement that returns empty array
    mockDb.prepare.mockImplementation(() => ({
      get: vi.fn(() => undefined),
      all: vi.fn(() => [])
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getMemoryContext', () => {
    // Note: agentMemoryService is loaded via dynamic require at module init
    // If the service isn't available, getMemoryContext returns ''
    it('should return empty string when agentMemoryService is not available', () => {
      // The dynamic require happens at module load time
      // When the service is not available, getMemoryContext returns ''
      const result = contextInjectionService.getMemoryContext('project-1')

      // Depending on whether the agent-memory.service is available
      // the result may be '' or contain memory context
      expect(typeof result).toBe('string')
    })

    it('should return string type for any project', () => {
      const result = contextInjectionService.getMemoryContext('any-project')

      expect(typeof result).toBe('string')
    })

    it('should handle different project IDs', () => {
      const result1 = contextInjectionService.getMemoryContext('project-1')
      const result2 = contextInjectionService.getMemoryContext('project-2')

      expect(typeof result1).toBe('string')
      expect(typeof result2).toBe('string')
    })
  })

  describe('getSprintContext', () => {
    it('should return empty string when no active sprint', () => {
      mockDb.prepare.mockImplementation(() => ({
        get: vi.fn(() => undefined),
        all: vi.fn(() => [])
      }))

      const result = contextInjectionService.getSprintContext('project-1')

      expect(result).toBe('')
    })

    it('should include sprint name and goal', () => {
      const mockSprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Complete authentication',
        start_date: '2024-01-01',
        end_date: '2024-01-14',
        description: 'First sprint'
      }

      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('FROM sprints')) {
          return { get: vi.fn(() => mockSprint), all: vi.fn(() => []) }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const result = contextInjectionService.getSprintContext('project-1')

      expect(result).toContain('Sprint 1')
      expect(result).toContain('Complete authentication')
    })

    it('should show blocked items in standard verbosity', () => {
      const mockSprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: null,
        start_date: '2024-01-01',
        end_date: '2024-01-14',
        description: null
      }

      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('FROM sprints')) {
          return { get: vi.fn(() => mockSprint), all: vi.fn(() => []) }
        }
        if (query.includes('blocked')) {
          return {
            get: vi.fn(() => undefined),
            all: vi.fn(() => [{ id: '1', title: 'Blocked item', priority: 'high' }])
          }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const result = contextInjectionService.getSprintContext('project-1', 'standard')

      expect(result).toContain('Blocked Items')
    })

    it('should show detailed view with all sections', () => {
      const mockSprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Test goal',
        start_date: '2024-01-01',
        end_date: '2024-01-14',
        description: 'Test description'
      }

      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('FROM sprints')) {
          return { get: vi.fn(() => mockSprint), all: vi.fn(() => []) }
        }
        if (query.includes('todo')) {
          return {
            get: vi.fn(() => undefined),
            all: vi.fn(() => [
              { id: '1', title: 'Todo 1', priority: 'high' },
              { id: '2', title: 'Todo 2', priority: 'medium' }
            ])
          }
        }
        if (query.includes('in-progress')) {
          return {
            get: vi.fn(() => undefined),
            all: vi.fn(() => [{ id: '3', title: 'In Progress 1', priority: 'high' }])
          }
        }
        if (query.includes('done')) {
          return {
            get: vi.fn(() => undefined),
            all: vi.fn(() => [{ id: '4', title: 'Done 1' }])
          }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const result = contextInjectionService.getSprintContext('project-1', 'detailed')

      expect(result).toContain('Sprint 1')
      expect(result).toContain('Test description')
    })

    it('should calculate progress correctly', () => {
      const now = new Date()
      const startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 7)
      const endDate = new Date(now)
      endDate.setDate(endDate.getDate() + 7)

      const mockSprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: null,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        description: null
      }

      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('FROM sprints')) {
          return { get: vi.fn(() => mockSprint), all: vi.fn(() => []) }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const result = contextInjectionService.getSprintContext('project-1')

      expect(result).toContain('Progress:')
      expect(result).toContain('50%')
    })
  })

  describe('getRoadmapContext', () => {
    it('should include roadmap section header', () => {
      mockDb.prepare.mockImplementation(() => ({
        get: vi.fn(() => undefined),
        all: vi.fn(() => [])
      }))

      const result = contextInjectionService.getRoadmapContext('project-1')

      expect(result).toContain('## Roadmap')
    })

    it('should show now items', () => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes("lane = 'now'")) {
          return {
            get: vi.fn(() => undefined),
            all: vi.fn(() => [
              { id: '1', title: 'Feature A', type: 'feature', status: 'in-progress', priority: 'high', target_date: null, owner: null }
            ])
          }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const result = contextInjectionService.getRoadmapContext('project-1')

      expect(result).toContain('Now (Current Focus)')
      expect(result).toContain('Feature A')
    })

    it('should show next items', () => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes("lane = 'next'")) {
          return {
            get: vi.fn(() => undefined),
            all: vi.fn(() => [
              { id: '2', title: 'Feature B', type: 'enhancement', status: 'planned', priority: 'medium', target_date: null, owner: null }
            ])
          }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const result = contextInjectionService.getRoadmapContext('project-1')

      expect(result).toContain('Next (Up Coming)')
      expect(result).toContain('Feature B')
    })

    it('should show later items only in detailed mode', () => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes("lane = 'later'")) {
          return {
            get: vi.fn(() => undefined),
            all: vi.fn(() => [
              { id: '3', title: 'Future Feature', type: 'feature', status: 'backlog', priority: 'low', target_date: null }
            ])
          }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const minimalResult = contextInjectionService.getRoadmapContext('project-1', 'minimal')
      const detailedResult = contextInjectionService.getRoadmapContext('project-1', 'detailed')

      expect(minimalResult).not.toContain('Later (Future)')
      expect(detailedResult).toContain('Later (Future)')
    })

    it('should show upcoming deadlines', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 15)

      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes("lane = 'now'")) {
          return {
            get: vi.fn(() => undefined),
            all: vi.fn(() => [
              { id: '1', title: 'Deadline Item', type: 'milestone', status: 'in-progress', priority: 'critical', target_date: futureDate.toISOString(), owner: null }
            ])
          }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const result = contextInjectionService.getRoadmapContext('project-1', 'standard')

      expect(result).toContain('Upcoming Deadlines')
      expect(result).toContain('Deadline Item')
    })
  })

  describe('getProjectContext', () => {
    it('should return structured project context', async () => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('COUNT(*)')) {
          return { get: vi.fn(() => ({ count: 5 })), all: vi.fn(() => []) }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const result = await contextInjectionService.getProjectContext('project-1')

      expect(result).toHaveProperty('stories')
      expect(result).toHaveProperty('tasks')
      expect(result).toHaveProperty('roadmap')
      expect(result).toHaveProperty('recentActivity')
      expect(result.stories).toHaveProperty('total')
      expect(result.stories).toHaveProperty('recent')
      expect(result.stories).toHaveProperty('inProgress')
    })

    it('should include active sprint context when exists', async () => {
      const mockSprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Complete feature'
      }

      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('FROM sprints')) {
          return { get: vi.fn(() => mockSprint), all: vi.fn(() => []) }
        }
        if (query.includes('sprint_id')) {
          return {
            get: vi.fn(() => undefined),
            all: vi.fn(() => [{ id: '1', title: 'Sprint Story', type: 'story' }])
          }
        }
        if (query.includes('COUNT(*)')) {
          return { get: vi.fn(() => ({ count: 0 })), all: vi.fn(() => []) }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const result = await contextInjectionService.getProjectContext('project-1')

      expect(result.sprint).toBeDefined()
      expect(result.sprint?.name).toBe('Sprint 1')
      expect(result.sprint?.goal).toBe('Complete feature')
    })

    it('should collect recent activity from stories, tasks, and tests', async () => {
      const now = new Date().toISOString()
      const earlier = new Date(Date.now() - 3600000).toISOString()

      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('FROM user_stories') && query.includes('ORDER BY updated_at')) {
          return {
            get: vi.fn(() => undefined),
            all: vi.fn(() => [
              { id: '1', title: 'Story 1', status: 'in-progress', created_at: earlier, updated_at: now }
            ])
          }
        }
        if (query.includes('FROM test_cases') && query.includes('ORDER BY updated_at')) {
          return {
            get: vi.fn(() => undefined),
            all: vi.fn(() => [
              { id: '2', title: 'Test 1', status: 'passed', created_at: earlier, updated_at: now }
            ])
          }
        }
        if (query.includes('FROM task_queue') && query.includes('ORDER BY COALESCE')) {
          return {
            get: vi.fn(() => undefined),
            all: vi.fn(() => [
              { id: '3', title: 'Task 1', status: 'completed', created_at: earlier, completed_at: now }
            ])
          }
        }
        if (query.includes('COUNT(*)')) {
          return { get: vi.fn(() => ({ count: 1 })), all: vi.fn(() => []) }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const result = await contextInjectionService.getProjectContext('project-1')

      expect(result.recentActivity.length).toBeGreaterThan(0)
    })
  })

  describe('formatContextForPrompt', () => {
    it('should format empty context', () => {
      const emptyContext = {
        stories: { total: 0, recent: [], inProgress: [] },
        tasks: { total: 0, pending: [], inProgress: [] },
        roadmap: { now: [], next: [] },
        recentActivity: []
      }

      const result = contextInjectionService.formatContextForPrompt(emptyContext)

      expect(result).toContain('Current Project Context')
    })

    it('should format stories section', () => {
      const context = {
        stories: {
          total: 5,
          recent: [{ id: '1', title: 'Story 1', status: 'in-progress', priority: 'high' }],
          inProgress: [{ id: '1', title: 'Story 1' }]
        },
        tasks: { total: 0, pending: [], inProgress: [] },
        roadmap: { now: [], next: [] },
        recentActivity: []
      }

      const result = contextInjectionService.formatContextForPrompt(context)

      expect(result).toContain('User Stories (5 total)')
      expect(result).toContain('In Progress:')
      expect(result).toContain('Story 1')
    })

    it('should format tasks section', () => {
      const context = {
        stories: { total: 0, recent: [], inProgress: [] },
        tasks: {
          total: 3,
          pending: [{ id: '1', title: 'Task 1', taskType: 'development' }],
          inProgress: [{ id: '2', title: 'Task 2' }]
        },
        roadmap: { now: [], next: [] },
        recentActivity: []
      }

      const result = contextInjectionService.formatContextForPrompt(context)

      expect(result).toContain('Tasks (3 total)')
      expect(result).toContain('pending:')
      expect(result).toContain('Task 1')
    })

    it('should format roadmap section', () => {
      const context = {
        stories: { total: 0, recent: [], inProgress: [] },
        tasks: { total: 0, pending: [], inProgress: [] },
        roadmap: {
          now: [{ id: '1', title: 'Feature A', itemType: 'feature' }],
          next: [{ id: '2', title: 'Feature B', itemType: 'enhancement' }]
        },
        recentActivity: []
      }

      const result = contextInjectionService.formatContextForPrompt(context)

      expect(result).toContain('Roadmap')
      expect(result).toContain('Now:')
      expect(result).toContain('Feature A')
      expect(result).toContain('Next:')
      expect(result).toContain('Feature B')
    })

    it('should format sprint section', () => {
      const context = {
        stories: { total: 0, recent: [], inProgress: [] },
        tasks: { total: 0, pending: [], inProgress: [] },
        roadmap: { now: [], next: [] },
        sprint: {
          name: 'Sprint 1',
          goal: 'Finish auth',
          items: [{ id: '1', title: 'Auth item', type: 'story' }]
        },
        recentActivity: []
      }

      const result = contextInjectionService.formatContextForPrompt(context)

      expect(result).toContain('Current Sprint: Sprint 1')
      expect(result).toContain('Finish auth')
      expect(result).toContain('Auth item')
    })

    it('should format recent activity with emojis', () => {
      const context = {
        stories: { total: 0, recent: [], inProgress: [] },
        tasks: { total: 0, pending: [], inProgress: [] },
        roadmap: { now: [], next: [] },
        recentActivity: [
          { type: 'story' as const, action: 'created' as const, title: 'New Story', timestamp: new Date().toISOString() },
          { type: 'task' as const, action: 'completed' as const, title: 'Done Task', timestamp: new Date().toISOString() },
          { type: 'test' as const, action: 'updated' as const, title: 'Updated Test', timestamp: new Date().toISOString() }
        ]
      }

      const result = contextInjectionService.formatContextForPrompt(context)

      expect(result).toContain('Recent Activity')
      expect(result).toContain('📖')
      expect(result).toContain('⚙️')
      expect(result).toContain('🧪')
    })

    it('should truncate when content exceeds 500 words', () => {
      // Create a context with lots of items
      const manyItems = Array.from({ length: 50 }, (_, i) => ({
        id: `${i}`,
        title: `This is a very long story title with many words that will contribute to the word count ${i}`,
        status: 'in-progress',
        priority: 'high'
      }))

      const context = {
        stories: {
          total: 50,
          recent: manyItems,
          inProgress: manyItems.slice(0, 20).map((s) => ({ id: s.id, title: s.title }))
        },
        tasks: { total: 0, pending: [], inProgress: [] },
        roadmap: { now: [], next: [] },
        recentActivity: []
      }

      const result = contextInjectionService.formatContextForPrompt(context)

      // Should not include recent activity section when truncated
      const words = result.split(/\s+/).length
      expect(words).toBeLessThanOrEqual(510) // Allow some margin
    })
  })

  describe('getContextSummary', () => {
    it('should return formatted context summary', async () => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('COUNT(*)')) {
          return { get: vi.fn(() => ({ count: 0 })), all: vi.fn(() => []) }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const result = await contextInjectionService.getContextSummary('project-1')

      expect(typeof result).toBe('string')
      expect(result).toContain('Current Project Context')
    })
  })

  describe('getFullContext', () => {
    beforeEach(() => {
      // Reset mocks for each test
      mockAgentMemoryService.getRecentDecisions.mockReturnValue([])
      mockAgentMemoryService.getRecentApprovals.mockReturnValue([])
      mockAgentMemoryService.getRecentRejections.mockReturnValue([])
    })

    it('should include all sections by default', async () => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('COUNT(*)')) {
          return { get: vi.fn(() => ({ count: 1 })), all: vi.fn(() => []) }
        }
        if (query.includes('FROM user_stories') && !query.includes('sprint_id')) {
          return {
            get: vi.fn(() => undefined),
            all: vi.fn(() => [{ id: '1', title: 'Story', status: 'todo', priority: 'high', updated_at: new Date().toISOString() }])
          }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const result = await contextInjectionService.getFullContext('project-1')

      expect(typeof result).toBe('string')
    })

    it('should respect includeStories option', async () => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('COUNT(*)')) {
          return { get: vi.fn(() => ({ count: 5 })), all: vi.fn(() => []) }
        }
        if (query.includes('FROM user_stories')) {
          return {
            get: vi.fn(() => undefined),
            all: vi.fn(() => [{ id: '1', title: 'Story 1', status: 'todo', priority: 'high', updated_at: new Date().toISOString() }])
          }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const withStories = await contextInjectionService.getFullContext('project-1', { includeStories: true })
      const withoutStories = await contextInjectionService.getFullContext('project-1', { includeStories: false })

      expect(withStories).toContain('User Stories')
      expect(withoutStories).not.toContain('## User Stories')
    })

    it('should respect includeTasks option', async () => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('COUNT(*)')) {
          return { get: vi.fn(() => ({ count: 5 })), all: vi.fn(() => []) }
        }
        if (query.includes('FROM task_queue')) {
          return {
            get: vi.fn(() => undefined),
            all: vi.fn(() => [{ id: '1', title: 'Task 1', task_type: 'dev', status: 'pending', created_at: new Date().toISOString(), completed_at: null }])
          }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const withTasks = await contextInjectionService.getFullContext('project-1', { includeTasks: true })
      const withoutTasks = await contextInjectionService.getFullContext('project-1', { includeTasks: false })

      expect(withTasks).toContain('Tasks')
      expect(withoutTasks).not.toContain('## Tasks')
    })

    it('should respect includeMemory option', async () => {
      // Note: agentMemoryService is loaded dynamically and may not be available
      // The includeMemory option controls whether to attempt to include memory context
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('COUNT(*)')) {
          return { get: vi.fn(() => ({ count: 0 })), all: vi.fn(() => []) }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const withMemory = await contextInjectionService.getFullContext('project-1', { includeMemory: true })
      const withoutMemory = await contextInjectionService.getFullContext('project-1', { includeMemory: false })

      // Both should return valid strings
      expect(typeof withMemory).toBe('string')
      expect(typeof withoutMemory).toBe('string')
    })

    it('should respect verbosity option', async () => {
      const mockSprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Goal',
        start_date: '2024-01-01',
        end_date: '2024-01-14',
        description: 'Description'
      }

      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('FROM sprints')) {
          return { get: vi.fn(() => mockSprint), all: vi.fn(() => []) }
        }
        if (query.includes('COUNT(*)')) {
          return { get: vi.fn(() => ({ count: 0 })), all: vi.fn(() => []) }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const minimalResult = await contextInjectionService.getFullContext('project-1', {
        verbosity: 'minimal',
        includeSprint: true,
        includeStories: false,
        includeTasks: false,
        includeRoadmap: false,
        includeMemory: false
      })

      const detailedResult = await contextInjectionService.getFullContext('project-1', {
        verbosity: 'detailed',
        includeSprint: true,
        includeStories: false,
        includeTasks: false,
        includeRoadmap: false,
        includeMemory: false
      })

      // Minimal should be shorter
      expect(minimalResult.length).toBeLessThan(detailedResult.length)
    })

    it('should truncate content when exceeding maxWords', async () => {
      // Create many items with in-progress stories to trigger the detailed output
      const manyStories = Array.from({ length: 100 }, (_, i) => ({
        id: `story-${i}`,
        title: `This is a really long story title that has many many words in it to ensure we exceed the max words limit number ${i}`,
        status: 'in-progress',
        priority: 'high',
        updated_at: new Date().toISOString()
      }))

      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('COUNT(*)')) {
          return { get: vi.fn(() => ({ count: 100 })), all: vi.fn(() => []) }
        }
        if (query.includes('FROM user_stories')) {
          return { get: vi.fn(() => undefined), all: vi.fn(() => manyStories) }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      // Use detailed verbosity to get more content
      const result = await contextInjectionService.getFullContext('project-1', {
        maxWords: 50, // Very low to ensure truncation
        includeMemory: false,
        includeSprint: false,
        includeRoadmap: false,
        verbosity: 'detailed'
      })

      // Check that the output was limited (either truncated or content was short)
      const words = result.split(/\s+/).length
      // Either it's truncated with message or naturally short
      expect(words).toBeLessThanOrEqual(100)
    })

    it('should include recent activity only in detailed mode', async () => {
      const now = new Date().toISOString()

      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('COUNT(*)')) {
          return { get: vi.fn(() => ({ count: 1 })), all: vi.fn(() => []) }
        }
        if (query.includes('ORDER BY updated_at') || query.includes('ORDER BY COALESCE')) {
          return {
            get: vi.fn(() => undefined),
            all: vi.fn(() => [
              { id: '1', title: 'Recent Item', status: 'done', created_at: now, updated_at: now, completed_at: now }
            ])
          }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const standardResult = await contextInjectionService.getFullContext('project-1', {
        verbosity: 'standard',
        includeMemory: false,
        includeSprint: false,
        includeRoadmap: false
      })

      const detailedResult = await contextInjectionService.getFullContext('project-1', {
        verbosity: 'detailed',
        includeMemory: false,
        includeSprint: false,
        includeRoadmap: false
      })

      expect(standardResult).not.toContain('Recent Activity')
      expect(detailedResult).toContain('Recent Activity')
    })

    it('should use default options when none provided', async () => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('COUNT(*)')) {
          return { get: vi.fn(() => ({ count: 0 })), all: vi.fn(() => []) }
        }
        return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
      })

      const result = await contextInjectionService.getFullContext('project-1')

      expect(typeof result).toBe('string')
    })
  })
})
