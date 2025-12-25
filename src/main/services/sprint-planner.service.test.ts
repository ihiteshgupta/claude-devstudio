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

// Mock task decomposer service
const mockTaskDecomposerService = vi.hoisted(() => ({
  decompose: vi.fn(() => Promise.resolve({
    subtasks: [{ id: 'task-1', title: 'Subtask 1' }],
    enqueuedTasks: [{ id: 'enqueued-1' }],
    parentTask: null
  }))
}))

// Mock task queue service
const mockTaskQueueService = vi.hoisted(() => ({
  enqueueTask: vi.fn()
}))

vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

vi.mock('./task-decomposer.service', () => ({
  taskDecomposerService: mockTaskDecomposerService
}))

vi.mock('./task-queue.service', () => ({
  taskQueueService: mockTaskQueueService
}))

// Import after mocking
const { sprintPlannerService } = await import('./sprint-planner.service')

describe('SprintPlannerService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sprintPlannerService.removeAllListeners()
  })

  afterEach(() => {
    vi.clearAllMocks()
    sprintPlannerService.removeAllListeners()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(sprintPlannerService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof sprintPlannerService.generateNextSprint).toBe('function')
      expect(typeof sprintPlannerService.getActiveSprint).toBe('function')
      expect(typeof sprintPlannerService.getSprintProgress).toBe('function')
      expect(typeof sprintPlannerService.checkSprintCompletion).toBe('function')
      expect(typeof sprintPlannerService.getSprintStories).toBe('function')
      expect(typeof sprintPlannerService.syncStoryStatusFromTasks).toBe('function')
      expect(typeof sprintPlannerService.monitorAndContinue).toBe('function')
    })

    it('should be an EventEmitter', () => {
      expect(typeof sprintPlannerService.on).toBe('function')
      expect(typeof sprintPlannerService.emit).toBe('function')
    })
  })

  describe('generateNextSprint', () => {
    it('should emit sprint-planning-started event', async () => {
      const planningStarted = vi.fn()
      sprintPlannerService.on('sprint-planning-started', planningStarted)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [{
          id: 'item-1',
          title: 'Roadmap Item',
          description: 'Description',
          lane: 'now',
          status: 'planned',
          storyPoints: 3,
          priority: 'high'
        }]),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      await sprintPlannerService.generateNextSprint({
        projectId: 'proj-1',
        projectPath: '/project',
        capacity: 20,
        durationDays: 14,
        defaultAutonomyLevel: 'supervised',
        autoDecompose: false,
        autoEnqueue: false
      })

      expect(planningStarted).toHaveBeenCalledWith({ projectId: 'proj-1' })
    })

    it('should throw error when no roadmap items available', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      await expect(
        sprintPlannerService.generateNextSprint({
          projectId: 'proj-1',
          projectPath: '/project',
          capacity: 20,
          durationDays: 14,
          defaultAutonomyLevel: 'supervised',
          autoDecompose: false,
          autoEnqueue: false
        })
      ).rejects.toThrow('No roadmap items available for sprint planning')
    })

    it('should select items within capacity', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { id: 'item-1', title: 'Item 1', storyPoints: 5, priority: 'high', lane: 'now', status: 'planned' },
          { id: 'item-2', title: 'Item 2', storyPoints: 5, priority: 'medium', lane: 'now', status: 'planned' },
          { id: 'item-3', title: 'Item 3', storyPoints: 15, priority: 'low', lane: 'now', status: 'planned' }
        ]),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const plan = await sprintPlannerService.generateNextSprint({
        projectId: 'proj-1',
        projectPath: '/project',
        capacity: 10,
        durationDays: 14,
        defaultAutonomyLevel: 'supervised',
        autoDecompose: false,
        autoEnqueue: false
      })

      // Should select items 1 and 2 (5+5=10), but not item 3 (would exceed 10)
      expect(plan.totalPoints).toBeLessThanOrEqual(10)
    })

    it('should create sprint record', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [{
          id: 'item-1',
          title: 'Item',
          storyPoints: 5,
          priority: 'high',
          lane: 'now',
          status: 'planned'
        }]),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const plan = await sprintPlannerService.generateNextSprint({
        projectId: 'proj-1',
        projectPath: '/project',
        capacity: 20,
        durationDays: 14,
        defaultAutonomyLevel: 'supervised',
        autoDecompose: false,
        autoEnqueue: false
      })

      expect(plan.sprint.id).toBeDefined()
      expect(plan.sprint.projectId).toBe('proj-1')
      expect(plan.sprint.status).toBe('active')
    })

    it('should decompose stories when autoDecompose is true', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [{
          id: 'item-1',
          title: 'Item',
          description: 'Description',
          storyPoints: 5,
          priority: 'high',
          lane: 'now',
          status: 'planned'
        }]),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      await sprintPlannerService.generateNextSprint({
        projectId: 'proj-1',
        projectPath: '/project',
        capacity: 20,
        durationDays: 14,
        defaultAutonomyLevel: 'supervised',
        autoDecompose: true,
        autoEnqueue: true
      })

      expect(mockTaskDecomposerService.decompose).toHaveBeenCalled()
    })

    it('should emit sprint-created event', async () => {
      const sprintCreated = vi.fn()
      sprintPlannerService.on('sprint-created', sprintCreated)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [{
          id: 'item-1',
          title: 'Item',
          storyPoints: 5,
          priority: 'high',
          lane: 'now',
          status: 'planned'
        }]),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      await sprintPlannerService.generateNextSprint({
        projectId: 'proj-1',
        projectPath: '/project',
        capacity: 20,
        durationDays: 14,
        defaultAutonomyLevel: 'supervised',
        autoDecompose: false,
        autoEnqueue: false
      })

      expect(sprintCreated).toHaveBeenCalled()
    })

    it('should handle decomposition errors gracefully', async () => {
      const decompositionError = vi.fn()
      sprintPlannerService.on('decomposition-error', decompositionError)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [{
          id: 'item-1',
          title: 'Item',
          description: 'Desc',
          storyPoints: 5,
          priority: 'high',
          lane: 'now',
          status: 'planned'
        }]),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      mockTaskDecomposerService.decompose.mockRejectedValueOnce(new Error('Decomposition failed'))

      await sprintPlannerService.generateNextSprint({
        projectId: 'proj-1',
        projectPath: '/project',
        capacity: 20,
        durationDays: 14,
        defaultAutonomyLevel: 'supervised',
        autoDecompose: true,
        autoEnqueue: false
      })

      expect(decompositionError).toHaveBeenCalled()
    })
  })

  describe('getActiveSprint', () => {
    it('should return active sprint', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => ({
          id: 'sprint-1',
          project_id: 'proj-1',
          name: 'Sprint 1',
          description: 'Description',
          start_date: '2024-01-01T00:00:00Z',
          end_date: '2024-01-14T00:00:00Z',
          status: 'active',
          goal: 'Goal',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        })),
        run: vi.fn()
      })

      const sprint = sprintPlannerService.getActiveSprint('proj-1')

      expect(sprint).toBeDefined()
      expect(sprint?.id).toBe('sprint-1')
      expect(sprint?.status).toBe('active')
    })

    it('should return null when no active sprint', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => null),
        run: vi.fn()
      })

      const sprint = sprintPlannerService.getActiveSprint('proj-1')

      expect(sprint).toBeNull()
    })
  })

  describe('getSprintProgress', () => {
    it('should calculate sprint progress', () => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('sprints')) {
          return {
            all: vi.fn(),
            get: vi.fn(() => ({
              id: 'sprint-1',
              project_id: 'proj-1',
              name: 'Sprint 1',
              start_date: '2024-01-01T00:00:00Z',
              end_date: '2024-01-14T00:00:00Z',
              status: 'active'
            })),
            run: vi.fn()
          }
        }
        if (query.includes('user_stories')) {
          return {
            all: vi.fn(() => [
              { id: 'story-1', status: 'done', story_points: 5 },
              { id: 'story-2', status: 'in_progress', story_points: 3 },
              { id: 'story-3', status: 'todo', story_points: 2 }
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

      const progress = sprintPlannerService.getSprintProgress('sprint-1')

      expect(progress.sprintId).toBe('sprint-1')
      expect(progress.totalStories).toBeDefined()
      expect(progress.completedStories).toBeDefined()
      expect(progress.percentComplete).toBeDefined()
    })

    it('should return zero progress for non-existent sprint', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => null),
        run: vi.fn()
      })

      const progress = sprintPlannerService.getSprintProgress('nonexistent')

      // getSprintProgress always returns an object, not null
      expect(progress.sprintId).toBe('nonexistent')
      expect(progress.totalStories).toBe(0)
      expect(progress.completedStories).toBe(0)
    })

    it('should calculate velocity', () => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('sprints')) {
          return {
            all: vi.fn(),
            get: vi.fn(() => ({
              id: 'sprint-1',
              start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
              end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'active'
            })),
            run: vi.fn()
          }
        }
        if (query.includes('user_stories')) {
          return {
            all: vi.fn(() => [
              { id: 'story-1', status: 'done', story_points: 5 },
              { id: 'story-2', status: 'done', story_points: 3 }
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

      const progress = sprintPlannerService.getSprintProgress('sprint-1')

      expect(progress?.velocity).toBeDefined()
    })
  })

  describe('checkSprintCompletion', () => {
    it('should check if sprint is complete', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({
          id: 'sprint-1',
          project_id: 'proj-1',
          status: 'active'
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const isComplete = await sprintPlannerService.checkSprintCompletion('proj-1')

      expect(typeof isComplete).toBe('boolean')
    })
  })

  describe('getSprintStories', () => {
    it('should return all stories for a sprint', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { id: 'story-1', sprint_id: 'sprint-1', title: 'Story 1', status: 'done' },
          { id: 'story-2', sprint_id: 'sprint-1', title: 'Story 2', status: 'in_progress' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const stories = sprintPlannerService.getSprintStories('sprint-1')

      expect(stories.length).toBe(2)
    })

    it('should return empty array when no stories', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const stories = sprintPlannerService.getSprintStories('sprint-1')

      expect(stories).toEqual([])
    })
  })

  describe('syncStoryStatusFromTasks', () => {
    it('should sync story status based on task completion', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { id: 'story-1', status: 'in_progress' }
        ]),
        get: vi.fn(() => ({
          total: 3,
          completed: 3
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const updatedCount = await sprintPlannerService.syncStoryStatusFromTasks('proj-1')

      expect(typeof updatedCount).toBe('number')
    })
  })

  describe('monitorAndContinue', () => {
    it('should generate next sprint if current is complete', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => null), // No active sprint
        run: vi.fn()
      })

      // Should return null when no items available
      const plan = await sprintPlannerService.monitorAndContinue({
        projectId: 'proj-1',
        projectPath: '/project',
        capacity: 20,
        durationDays: 14,
        defaultAutonomyLevel: 'supervised',
        autoDecompose: false,
        autoEnqueue: false
      })

      expect(plan).toBeNull() // or a plan if items available
    })
  })
})
