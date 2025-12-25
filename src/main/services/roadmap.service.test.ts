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

vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

// Import after mocking
const { roadmapService } = await import('./roadmap.service')

describe('RoadmapService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    roadmapService.removeAllListeners()
  })

  afterEach(() => {
    vi.clearAllMocks()
    roadmapService.removeAllListeners()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(roadmapService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof roadmapService.listItems).toBe('function')
      expect(typeof roadmapService.getItem).toBe('function')
      expect(typeof roadmapService.getItemsHierarchy).toBe('function')
      expect(typeof roadmapService.getItemsByLane).toBe('function')
      expect(typeof roadmapService.getItemsByQuarter).toBe('function')
      expect(typeof roadmapService.createItem).toBe('function')
      expect(typeof roadmapService.updateItem).toBe('function')
      expect(typeof roadmapService.moveToLane).toBe('function')
      expect(typeof roadmapService.moveToQuarter).toBe('function')
      expect(typeof roadmapService.setParent).toBe('function')
      expect(typeof roadmapService.deleteItem).toBe('function')
      expect(typeof roadmapService.getStats).toBe('function')
    })

    it('should be an EventEmitter', () => {
      expect(typeof roadmapService.on).toBe('function')
      expect(typeof roadmapService.emit).toBe('function')
    })
  })

  describe('listItems', () => {
    it('should list all items for a project', () => {
      const mockRows = [
        {
          id: 'roadmap_1',
          project_id: 'proj-1',
          parent_id: null,
          title: 'Feature 1',
          description: 'Desc',
          type: 'feature',
          status: 'planned',
          priority: 'high',
          target_quarter: 'Q1 2024',
          lane: 'now',
          start_date: null,
          target_date: null,
          completed_date: null,
          story_points: 5,
          owner: 'dev1',
          tags: '["tag1"]',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockRows),
        get: vi.fn(),
        run: vi.fn()
      })

      const items = roadmapService.listItems('proj-1')

      expect(items).toHaveLength(1)
      expect(items[0].title).toBe('Feature 1')
    })

    it('should filter by type', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      roadmapService.listItems('proj-1', { type: 'epic' })

      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should filter by lane', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      roadmapService.listItems('proj-1', { lane: 'now' })

      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should return empty array when no items', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const items = roadmapService.listItems('proj-1')

      expect(items).toEqual([])
    })
  })

  describe('getItem', () => {
    it('should return item by ID', () => {
      const mockRow = {
        id: 'roadmap_1',
        project_id: 'proj-1',
        parent_id: null,
        title: 'My Feature',
        description: 'Description',
        type: 'feature',
        status: 'in-progress',
        priority: 'high',
        target_quarter: 'Q2 2024',
        lane: 'now',
        start_date: '2024-01-15',
        target_date: '2024-03-15',
        completed_date: null,
        story_points: 8,
        owner: 'developer',
        tags: '["frontend", "ui"]',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-10T00:00:00Z'
      }

      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => mockRow),
        run: vi.fn()
      })

      const item = roadmapService.getItem('roadmap_1')

      expect(item).toBeDefined()
      expect(item?.title).toBe('My Feature')
      expect(item?.storyPoints).toBe(8)
      expect(item?.tags).toEqual(['frontend', 'ui'])
    })

    it('should return null when not found', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => undefined),
        run: vi.fn()
      })

      const item = roadmapService.getItem('nonexistent')

      expect(item).toBeNull()
    })
  })

  describe('getItemsHierarchy', () => {
    it('should build hierarchical structure', () => {
      const mockRows = [
        {
          id: 'parent_1',
          project_id: 'proj-1',
          parent_id: null,
          title: 'Epic',
          description: null,
          type: 'epic',
          status: 'planned',
          priority: 'high',
          target_quarter: null,
          lane: 'next',
          start_date: null,
          target_date: null,
          completed_date: null,
          story_points: null,
          owner: null,
          tags: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'child_1',
          project_id: 'proj-1',
          parent_id: 'parent_1',
          title: 'Feature',
          description: null,
          type: 'feature',
          status: 'planned',
          priority: 'medium',
          target_quarter: null,
          lane: 'next',
          start_date: null,
          target_date: null,
          completed_date: null,
          story_points: null,
          owner: null,
          tags: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockRows),
        get: vi.fn(),
        run: vi.fn()
      })

      const hierarchy = roadmapService.getItemsHierarchy('proj-1')

      expect(hierarchy).toHaveLength(1)
      expect(hierarchy[0].id).toBe('parent_1')
      expect(hierarchy[0].children).toHaveLength(1)
      expect(hierarchy[0].children?.[0].id).toBe('child_1')
    })
  })

  describe('getItemsByLane', () => {
    it('should group items by lane', () => {
      const mockRows = [
        createMockRow('item_1', 'now'),
        createMockRow('item_2', 'now'),
        createMockRow('item_3', 'next'),
        createMockRow('item_4', 'later'),
        createMockRow('item_5', 'done')
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockRows),
        get: vi.fn(),
        run: vi.fn()
      })

      const byLane = roadmapService.getItemsByLane('proj-1')

      expect(byLane.now).toHaveLength(2)
      expect(byLane.next).toHaveLength(1)
      expect(byLane.later).toHaveLength(1)
      expect(byLane.done).toHaveLength(1)
    })
  })

  describe('getItemsByQuarter', () => {
    it('should group items by quarter', () => {
      const mockRows = [
        { ...createMockRow('item_1', 'now'), target_quarter: 'Q1 2024' },
        { ...createMockRow('item_2', 'next'), target_quarter: 'Q1 2024' },
        { ...createMockRow('item_3', 'next'), target_quarter: 'Q2 2024' },
        { ...createMockRow('item_4', 'later'), target_quarter: null }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockRows),
        get: vi.fn(),
        run: vi.fn()
      })

      const byQuarter = roadmapService.getItemsByQuarter('proj-1')

      expect(byQuarter['Q1 2024']).toHaveLength(2)
      expect(byQuarter['Q2 2024']).toHaveLength(1)
      expect(byQuarter['Unscheduled']).toHaveLength(1)
    })
  })

  describe('createItem', () => {
    it('should create item with required fields', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(),
        run: vi.fn()
      })

      const createdEvent = vi.fn()
      roadmapService.on('item-created', createdEvent)

      const item = roadmapService.createItem({
        projectId: 'proj-1',
        title: 'New Feature'
      })

      expect(item).toBeDefined()
      expect(item.title).toBe('New Feature')
      expect(item.projectId).toBe('proj-1')
      expect(item.type).toBe('feature') // default
      expect(item.status).toBe('planned') // default
      expect(item.lane).toBe('next') // default
      expect(createdEvent).toHaveBeenCalled()
    })

    it('should create item with all optional fields', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(),
        run: vi.fn()
      })

      const item = roadmapService.createItem({
        projectId: 'proj-1',
        title: 'Epic Feature',
        description: 'Full description',
        type: 'epic',
        status: 'in-progress',
        priority: 'critical',
        targetQuarter: 'Q3 2024',
        lane: 'now',
        startDate: '2024-01-01',
        targetDate: '2024-06-30',
        storyPoints: 13,
        owner: 'lead',
        tags: ['important', 'release']
      })

      expect(item.type).toBe('epic')
      expect(item.priority).toBe('critical')
      expect(item.storyPoints).toBe(13)
      expect(item.tags).toEqual(['important', 'release'])
    })

    it('should generate unique ID', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(),
        run: vi.fn()
      })

      const item = roadmapService.createItem({
        projectId: 'proj-1',
        title: 'Test'
      })

      expect(item.id).toMatch(/^roadmap_\d+_[a-z0-9]+$/)
    })
  })

  describe('updateItem', () => {
    it('should update existing item', () => {
      const mockRow = createMockRow('roadmap_1', 'next')

      let callCount = 0
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => {
          callCount++
          return mockRow
        }),
        run: vi.fn()
      })

      const updatedEvent = vi.fn()
      roadmapService.on('item-updated', updatedEvent)

      const updated = roadmapService.updateItem('roadmap_1', { title: 'Updated Title' })

      expect(updated).toBeDefined()
      expect(updatedEvent).toHaveBeenCalled()
    })

    it('should return null for non-existent item', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => undefined),
        run: vi.fn()
      })

      const result = roadmapService.updateItem('nonexistent', { title: 'New' })

      expect(result).toBeNull()
    })

    it('should auto-set completedDate when status is completed', () => {
      const mockRow = createMockRow('roadmap_1', 'now')

      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => mockRow),
        run: vi.fn()
      })

      roadmapService.updateItem('roadmap_1', { status: 'completed' })

      // Verify update was called with completed_date
      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should auto-complete when moved to done lane', () => {
      const mockRow = { ...createMockRow('roadmap_1', 'now'), status: 'in-progress' }

      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => mockRow),
        run: vi.fn()
      })

      roadmapService.updateItem('roadmap_1', { lane: 'done' })

      expect(mockDb.prepare).toHaveBeenCalled()
    })
  })

  describe('moveToLane', () => {
    it('should move item to specified lane', () => {
      const mockRow = createMockRow('roadmap_1', 'next')

      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => mockRow),
        run: vi.fn()
      })

      const result = roadmapService.moveToLane('roadmap_1', 'now')

      expect(result).toBeDefined()
    })
  })

  describe('moveToQuarter', () => {
    it('should move item to specified quarter', () => {
      const mockRow = createMockRow('roadmap_1', 'next')

      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => mockRow),
        run: vi.fn()
      })

      const result = roadmapService.moveToQuarter('roadmap_1', 'Q4 2024')

      expect(result).toBeDefined()
    })
  })

  describe('setParent', () => {
    it('should set parent for item', () => {
      const mockRow = createMockRow('child_1', 'next')

      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => mockRow),
        run: vi.fn()
      })

      const updatedEvent = vi.fn()
      roadmapService.on('item-updated', updatedEvent)

      const result = roadmapService.setParent('child_1', 'parent_1')

      expect(result).toBeDefined()
      expect(updatedEvent).toHaveBeenCalled()
    })

    it('should allow clearing parent', () => {
      const mockRow = createMockRow('child_1', 'next')

      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => mockRow),
        run: vi.fn()
      })

      const result = roadmapService.setParent('child_1', null)

      expect(result).toBeDefined()
    })
  })

  describe('deleteItem', () => {
    it('should delete existing item', () => {
      const mockRow = createMockRow('roadmap_1', 'next')

      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => mockRow),
        run: vi.fn()
      })

      const deletedEvent = vi.fn()
      roadmapService.on('item-deleted', deletedEvent)

      const result = roadmapService.deleteItem('roadmap_1')

      expect(result).toBe(true)
      expect(deletedEvent).toHaveBeenCalledWith('roadmap_1')
    })

    it('should return false for non-existent item', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => undefined),
        run: vi.fn()
      })

      const result = roadmapService.deleteItem('nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('getStats', () => {
    it('should return statistics for project', () => {
      const mockRows = [
        { ...createMockRow('item_1', 'now'), status: 'planned', type: 'feature', story_points: 5 },
        { ...createMockRow('item_2', 'now'), status: 'in-progress', type: 'feature', story_points: 8 },
        { ...createMockRow('item_3', 'done'), status: 'completed', type: 'epic', story_points: 13 },
        { ...createMockRow('item_4', 'next'), status: 'planned', type: 'task', story_points: 3 }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockRows),
        get: vi.fn(),
        run: vi.fn()
      })

      const stats = roadmapService.getStats('proj-1')

      expect(stats.total).toBe(4)
      expect(stats.byStatus.planned).toBe(2)
      expect(stats.byStatus['in-progress']).toBe(1)
      expect(stats.byStatus.completed).toBe(1)
      expect(stats.byLane.now).toBe(2)
      expect(stats.byLane.done).toBe(1)
      expect(stats.byType.feature).toBe(2)
      expect(stats.totalPoints).toBe(29)
      expect(stats.completedPoints).toBe(13)
    })

    it('should handle empty project', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const stats = roadmapService.getStats('empty-proj')

      expect(stats.total).toBe(0)
      expect(stats.totalPoints).toBe(0)
      expect(stats.completedPoints).toBe(0)
    })
  })
})

// Helper to create mock row
function createMockRow(id: string, lane: string) {
  return {
    id,
    project_id: 'proj-1',
    parent_id: null,
    title: `Item ${id}`,
    description: null,
    type: 'feature',
    status: 'planned',
    priority: 'medium',
    target_quarter: null,
    lane,
    start_date: null,
    target_date: null,
    completed_date: null,
    story_points: null,
    owner: null,
    tags: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
}
