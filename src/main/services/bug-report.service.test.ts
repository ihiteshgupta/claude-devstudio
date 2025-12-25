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

// Mock claude service
const mockClaudeService = vi.hoisted(() => ({
  sendMessage: vi.fn(() => Promise.resolve(JSON.stringify({
    suggestedTitle: 'Test failure bug',
    suggestedDescription: 'Description',
    suggestedSeverity: 'high',
    possibleCause: 'Unknown',
    suggestedFix: 'Fix it',
    affectedFiles: []
  })))
}))

vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

vi.mock('./claude.service', () => ({
  claudeService: mockClaudeService
}))

// Import after mocking
const { bugReportService } = await import('./bug-report.service')

describe('BugReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    bugReportService.removeAllListeners()
  })

  afterEach(() => {
    vi.clearAllMocks()
    bugReportService.removeAllListeners()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(bugReportService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof bugReportService.createFromTestFailure).toBe('function')
      expect(typeof bugReportService.create).toBe('function')
      expect(typeof bugReportService.getById).toBe('function')
      expect(typeof bugReportService.getBugs).toBe('function')
      expect(typeof bugReportService.updateStatus).toBe('function')
      expect(typeof bugReportService.updateSeverity).toBe('function')
      expect(typeof bugReportService.addLabel).toBe('function')
      expect(typeof bugReportService.removeLabel).toBe('function')
      expect(typeof bugReportService.addRelatedBug).toBe('function')
      expect(typeof bugReportService.findSimilarBugs).toBe('function')
      expect(typeof bugReportService.getStats).toBe('function')
      expect(typeof bugReportService.createFromTestRun).toBe('function')
      expect(typeof bugReportService.autoResolveFromTestSuccess).toBe('function')
      expect(typeof bugReportService.delete).toBe('function')
    })

    it('should be an EventEmitter', () => {
      expect(typeof bugReportService.on).toBe('function')
      expect(typeof bugReportService.emit).toBe('function')
    })
  })

  describe('create', () => {
    it('should create a new bug', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({
          id: 'bug-1',
          project_id: 'proj-1',
          title: 'Test bug',
          description: 'Description',
          severity: 'high',
          status: 'open',
          source: 'manual',
          labels: '[]',
          related_bugs: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const bug = await bugReportService.create({
        projectId: 'proj-1',
        title: 'Test bug',
        description: 'Description',
        severity: 'high',
        source: 'manual'
      })

      expect(bug).toBeDefined()
      expect(bug.title).toBe('Test bug')
    })

    it('should store bug in database', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({
          id: 'bug-1',
          project_id: 'proj-1',
          title: 'Test bug',
          description: 'Description',
          severity: 'high',
          status: 'open',
          source: 'manual',
          labels: '[]',
          related_bugs: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      await bugReportService.create({
        projectId: 'proj-1',
        title: 'Test bug',
        description: 'Description',
        severity: 'medium',
        source: 'manual'
      })

      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should include optional fields', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({
          id: 'bug-1',
          project_id: 'proj-1',
          title: 'Test bug',
          description: 'Description',
          severity: 'critical',
          status: 'open',
          source: 'test_failure',
          source_id: 'test-1',
          file_path: '/src/test.ts',
          line_number: 42,
          error_message: 'Error',
          stack_trace: 'Stack',
          labels: '["bug"]',
          related_bugs: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const bug = await bugReportService.create({
        projectId: 'proj-1',
        title: 'Test bug',
        description: 'Description',
        severity: 'critical',
        source: 'test_failure',
        sourceId: 'test-1',
        filePath: '/src/test.ts',
        lineNumber: 42,
        errorMessage: 'Error',
        stackTrace: 'Stack',
        labels: ['bug']
      })

      expect(bug.filePath).toBe('/src/test.ts')
      expect(bug.lineNumber).toBe(42)
    })
  })

  describe('getById', () => {
    it('should return bug by ID', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({
          id: 'bug-1',
          project_id: 'proj-1',
          title: 'Test bug',
          description: 'Description',
          severity: 'high',
          status: 'open',
          source: 'manual',
          labels: '[]',
          related_bugs: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        run: vi.fn()
      })

      const bug = bugReportService.getById('bug-1')

      expect(bug).toBeDefined()
      expect(bug?.id).toBe('bug-1')
    })

    it('should return null for non-existent bug', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => null),
        run: vi.fn()
      })

      const bug = bugReportService.getById('non-existent')

      expect(bug).toBeNull()
    })
  })

  describe('getBugs', () => {
    it('should return bugs for a project', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          {
            id: 'bug-1',
            project_id: 'proj-1',
            title: 'Bug 1',
            description: 'Desc',
            severity: 'high',
            status: 'open',
            source: 'manual',
            labels: '[]',
            related_bugs: '[]',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'bug-2',
            project_id: 'proj-1',
            title: 'Bug 2',
            description: 'Desc',
            severity: 'low',
            status: 'closed',
            source: 'manual',
            labels: '[]',
            related_bugs: '[]',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const bugs = bugReportService.getBugs('proj-1')

      expect(bugs.length).toBe(2)
    })

    it('should filter by status', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      bugReportService.getBugs('proj-1', { status: ['open'] })

      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should filter by severity', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      bugReportService.getBugs('proj-1', { severity: ['critical', 'high'] })

      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should filter by source', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      bugReportService.getBugs('proj-1', { source: ['test_failure'] })

      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should support pagination', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      bugReportService.getBugs('proj-1', { limit: 10, offset: 20 })

      expect(mockDb.prepare).toHaveBeenCalled()
    })
  })

  describe('updateStatus', () => {
    it('should update bug status', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({
          id: 'bug-1',
          project_id: 'proj-1',
          title: 'Test bug',
          description: 'Description',
          severity: 'high',
          status: 'resolved',
          source: 'manual',
          labels: '[]',
          related_bugs: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const bug = bugReportService.updateStatus('bug-1', 'resolved')

      expect(bug?.status).toBe('resolved')
    })

    it('should set resolved_at for resolved status', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({
          id: 'bug-1',
          project_id: 'proj-1',
          title: 'Test bug',
          description: 'Description',
          severity: 'high',
          status: 'resolved',
          source: 'manual',
          labels: '[]',
          related_bugs: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          resolved_at: new Date().toISOString()
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      bugReportService.updateStatus('bug-1', 'resolved')

      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should emit bug-status-changed event', () => {
      const statusChanged = vi.fn()
      bugReportService.on('bug-status-changed', statusChanged)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({
          id: 'bug-1',
          project_id: 'proj-1',
          title: 'Test bug',
          description: 'Description',
          severity: 'high',
          status: 'in_progress',
          source: 'manual',
          labels: '[]',
          related_bugs: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      bugReportService.updateStatus('bug-1', 'in_progress')

      expect(statusChanged).toHaveBeenCalled()
    })
  })

  describe('updateSeverity', () => {
    it('should update bug severity', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({
          id: 'bug-1',
          project_id: 'proj-1',
          title: 'Test bug',
          description: 'Description',
          severity: 'critical',
          status: 'open',
          source: 'manual',
          labels: '[]',
          related_bugs: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const bug = bugReportService.updateSeverity('bug-1', 'critical')

      expect(bug?.severity).toBe('critical')
    })
  })

  describe('addLabel', () => {
    it('should add label to bug', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({
          id: 'bug-1',
          project_id: 'proj-1',
          title: 'Test bug',
          description: 'Description',
          severity: 'high',
          status: 'open',
          source: 'manual',
          labels: '["existing", "new-label"]',
          related_bugs: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const bug = bugReportService.addLabel('bug-1', 'new-label')

      expect(bug?.labels).toContain('new-label')
    })

    it('should not duplicate labels', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({
          id: 'bug-1',
          project_id: 'proj-1',
          title: 'Test bug',
          description: 'Description',
          severity: 'high',
          status: 'open',
          source: 'manual',
          labels: '["existing"]',
          related_bugs: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const bug = bugReportService.addLabel('bug-1', 'existing')

      expect(bug?.labels.filter(l => l === 'existing').length).toBe(1)
    })
  })

  describe('removeLabel', () => {
    it('should remove label from bug', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({
          id: 'bug-1',
          project_id: 'proj-1',
          title: 'Test bug',
          description: 'Description',
          severity: 'high',
          status: 'open',
          source: 'manual',
          labels: '["remaining"]',
          related_bugs: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const bug = bugReportService.removeLabel('bug-1', 'to-remove')

      expect(bug?.labels).not.toContain('to-remove')
    })
  })

  describe('addRelatedBug', () => {
    it('should link related bugs', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({
          id: 'bug-1',
          project_id: 'proj-1',
          title: 'Test bug',
          description: 'Description',
          severity: 'high',
          status: 'open',
          source: 'manual',
          labels: '[]',
          related_bugs: '["bug-2"]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const bug = bugReportService.addRelatedBug('bug-1', 'bug-2')

      expect(bug?.relatedBugs).toContain('bug-2')
    })
  })

  describe('findSimilarBugs', () => {
    it('should find bugs with similar error messages', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          {
            id: 'bug-1',
            project_id: 'proj-1',
            title: 'Similar bug',
            description: 'Description',
            severity: 'high',
            status: 'open',
            source: 'test_failure',
            error_message: 'TypeError: Cannot read property foo of undefined',
            labels: '[]',
            related_bugs: '[]',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const similar = await bugReportService.findSimilarBugs(
        'proj-1',
        'TypeError: Cannot read property bar of undefined'
      )

      expect(similar.length).toBeGreaterThan(0)
    })

    it('should return empty array for short error messages', async () => {
      const similar = await bugReportService.findSimilarBugs('proj-1', 'short')

      expect(similar).toEqual([])
    })
  })

  describe('getStats', () => {
    it('should return bug statistics', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { status: 'open', count: 5 },
          { status: 'resolved', count: 3 }
        ]),
        get: vi.fn(() => ({ count: 10 })),
        run: vi.fn()
      })

      const stats = bugReportService.getStats('proj-1')

      expect(stats.total).toBeDefined()
    })

    it('should include severity breakdown', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { severity: 'critical', count: 2 },
          { severity: 'high', count: 5 }
        ]),
        get: vi.fn(() => ({ count: 10 })),
        run: vi.fn()
      })

      const stats = bugReportService.getStats('proj-1')

      expect(stats.bySeverity).toBeDefined()
    })

    it('should include source breakdown', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { source: 'test_failure', count: 5 },
          { source: 'manual', count: 3 }
        ]),
        get: vi.fn(() => ({ count: 10 })),
        run: vi.fn()
      })

      const stats = bugReportService.getStats('proj-1')

      expect(stats.bySource).toBeDefined()
    })
  })

  describe('createFromTestFailure', () => {
    it('should create bug from test failure', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({
          id: 'bug-1',
          project_id: 'proj-1',
          title: 'Test failure bug',
          description: 'Description',
          severity: 'high',
          status: 'open',
          source: 'test_failure',
          labels: '["auto-generated", "test-failure"]',
          related_bugs: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const execution = {
        id: 'exec-1',
        testName: 'should work',
        testPath: '/tests/test.spec.ts',
        errorMessage: 'Expected true to be false',
        stackTrace: 'at test.spec.ts:10'
      } as any

      const bug = await bugReportService.createFromTestFailure('proj-1', execution, '/project')

      expect(bug).toBeDefined()
      expect(bug.source).toBe('test_failure')
    })

    it('should emit bug-analysis-started event', async () => {
      const analysisStarted = vi.fn()
      bugReportService.on('bug-analysis-started', analysisStarted)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({
          id: 'bug-1',
          project_id: 'proj-1',
          title: 'Test bug',
          description: 'Description',
          severity: 'high',
          status: 'open',
          source: 'test_failure',
          labels: '[]',
          related_bugs: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      await bugReportService.createFromTestFailure('proj-1', {
        id: 'exec-1',
        testName: 'test',
        testPath: '/test.ts'
      } as any, '/project')

      expect(analysisStarted).toHaveBeenCalled()
    })
  })

  describe('createFromTestRun', () => {
    it('should create bugs from multiple test failures', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({
          id: 'bug-1',
          project_id: 'proj-1',
          title: 'Test bug',
          description: 'Description',
          severity: 'high',
          status: 'open',
          source: 'test_failure',
          labels: '[]',
          related_bugs: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const failures = [
        { id: 'exec-1', testName: 'test1', testPath: '/test1.ts', errorMessage: 'Error 1' },
        { id: 'exec-2', testName: 'test2', testPath: '/test2.ts', errorMessage: 'Error 2' }
      ] as any[]

      const bugs = await bugReportService.createFromTestRun('proj-1', failures, '/project')

      expect(bugs.length).toBe(2)
    })

    it('should emit bugs-batch-created event', async () => {
      const batchCreated = vi.fn()
      bugReportService.on('bugs-batch-created', batchCreated)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({
          id: 'bug-1',
          project_id: 'proj-1',
          title: 'Test bug',
          description: 'Description',
          severity: 'high',
          status: 'open',
          source: 'test_failure',
          labels: '[]',
          related_bugs: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      await bugReportService.createFromTestRun('proj-1', [
        { id: 'exec-1', testName: 'test1', testPath: '/test1.ts' }
      ] as any[], '/project')

      expect(batchCreated).toHaveBeenCalled()
    })
  })

  describe('autoResolveFromTestSuccess', () => {
    it('should resolve bugs when tests pass', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          {
            id: 'bug-1',
            project_id: 'proj-1',
            title: 'Bug',
            description: 'Desc',
            severity: 'high',
            status: 'open',
            source: 'test_failure',
            labels: '[]',
            related_bugs: '[]',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]),
        get: vi.fn(() => ({
          id: 'bug-1',
          project_id: 'proj-1',
          title: 'Bug',
          description: 'Desc',
          severity: 'high',
          status: 'resolved',
          source: 'test_failure',
          labels: '["auto-resolved"]',
          related_bugs: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const resolved = await bugReportService.autoResolveFromTestSuccess('proj-1', ['test1'])

      expect(resolved).toBeGreaterThanOrEqual(0)
    })
  })

  describe('delete', () => {
    it('should delete bug and return true', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const result = bugReportService.delete('bug-1')

      expect(result).toBe(true)
    })

    it('should return false when bug not found', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 0 }))
      })

      const result = bugReportService.delete('non-existent')

      expect(result).toBe(false)
    })
  })
})
