/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock uuid
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
const { learningService } = await import('./learning.service')

describe('LearningService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    learningService.removeAllListeners()
  })

  afterEach(() => {
    vi.clearAllMocks()
    learningService.removeAllListeners()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(learningService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof learningService.learnFromApproval).toBe('function')
      expect(typeof learningService.learnFromRejection).toBe('function')
      expect(typeof learningService.learnFromEdit).toBe('function')
      expect(typeof learningService.getPatterns).toBe('function')
      expect(typeof learningService.getTopPatterns).toBe('function')
      expect(typeof learningService.shouldAutoApprove).toBe('function')
      expect(typeof learningService.getSuggestedFormat).toBe('function')
      expect(typeof learningService.updatePatternConfidence).toBe('function')
      expect(typeof learningService.cleanupLowConfidencePatterns).toBe('function')
      expect(typeof learningService.extractKeywords).toBe('function')
      expect(typeof learningService.getProjectStats).toBe('function')
    })

    it('should be an EventEmitter', () => {
      expect(typeof learningService.on).toBe('function')
      expect(typeof learningService.emit).toBe('function')
    })
  })

  describe('extractKeywords', () => {
    it('should extract keywords from text', () => {
      const keywords = learningService.extractKeywords('User authentication login feature')

      expect(keywords).toContain('authentication')
      expect(keywords).toContain('login')
      expect(keywords).toContain('feature')
    })

    it('should filter out common words', () => {
      const keywords = learningService.extractKeywords('the user can login to the system')

      expect(keywords).not.toContain('the')
      expect(keywords).not.toContain('can')
      expect(keywords).not.toContain('to')
      expect(keywords).toContain('login')
      expect(keywords).toContain('system')
    })

    it('should filter out short words', () => {
      const keywords = learningService.extractKeywords('a b c login feature')

      expect(keywords).not.toContain('a')
      expect(keywords).not.toContain('b')
      expect(keywords).not.toContain('c')
    })

    it('should limit to 10 keywords', () => {
      const longText = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12'
      const keywords = learningService.extractKeywords(longText)

      expect(keywords.length).toBeLessThanOrEqual(10)
    })

    it('should handle punctuation', () => {
      const keywords = learningService.extractKeywords('login, password! username:test')

      expect(keywords).toContain('login')
      expect(keywords).toContain('password')
      expect(keywords).toContain('username')
      expect(keywords).toContain('test')
    })
  })

  describe('learnFromApproval', () => {
    it('should emit learning-event on approval', () => {
      const learningEvent = vi.fn()
      learningService.on('learning-event', learningEvent)

      // Mock no existing patterns
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      learningService.learnFromApproval('proj-1', 'story', 'User login feature')

      expect(learningEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'approval',
          projectId: 'proj-1'
        })
      )
    })

    it('should emit pattern-learned when creating new pattern', () => {
      const patternLearned = vi.fn()
      learningService.on('pattern-learned', patternLearned)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      learningService.learnFromApproval('proj-1', 'story', 'New feature request')

      expect(patternLearned).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'approval',
          projectId: 'proj-1',
          itemType: 'story'
        })
      )
    })

    it('should update existing pattern if found', () => {
      const patternUpdated = vi.fn()
      learningService.on('pattern-updated', patternUpdated)

      // Mock existing pattern
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('SELECT')) {
          return {
            all: vi.fn(() => [{
              id: 'pattern-1',
              project_id: 'proj-1',
              pattern_type: 'approval_pattern',
              pattern_data: JSON.stringify({ keywords: ['feature'] }),
              confidence: 0.6,
              usage_count: 2,
              success_count: 2,
              failure_count: 0,
              created_at: '2024-01-01',
              updated_at: '2024-01-01'
            }]),
            get: vi.fn(() => ({
              confidence: 0.6,
              usage_count: 2,
              success_count: 2,
              failure_count: 0
            })),
            run: vi.fn(() => ({ changes: 1 }))
          }
        }
        return {
          all: vi.fn(() => []),
          get: vi.fn(),
          run: vi.fn(() => ({ changes: 1 }))
        }
      })

      learningService.learnFromApproval('proj-1', 'story', 'New feature task')

      expect(patternUpdated).toHaveBeenCalled()
    })
  })

  describe('learnFromRejection', () => {
    it('should emit learning-event on rejection', () => {
      const learningEvent = vi.fn()
      learningService.on('learning-event', learningEvent)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      learningService.learnFromRejection('proj-1', 'story', 'Bad feature', 'Not relevant')

      expect(learningEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rejection',
          projectId: 'proj-1'
        })
      )
    })

    it('should emit pattern-learned for rejection pattern', () => {
      const patternLearned = vi.fn()
      learningService.on('pattern-learned', patternLearned)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      learningService.learnFromRejection('proj-1', 'task', 'Rejected task')

      expect(patternLearned).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rejection'
        })
      )
    })
  })

  describe('learnFromEdit', () => {
    it('should emit learning-event on edit', () => {
      const learningEvent = vi.fn()
      learningService.on('learning-event', learningEvent)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      learningService.learnFromEdit('proj-1', 'story', 'Original title', 'Corrected title')

      expect(learningEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'edit',
          projectId: 'proj-1'
        })
      )
    })

    it('should create edit correction pattern', () => {
      const patternLearned = vi.fn()
      learningService.on('pattern-learned', patternLearned)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      learningService.learnFromEdit('proj-1', 'story', 'Original', 'Corrected')

      expect(patternLearned).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'edit'
        })
      )
    })

    it('should detect format pattern from user story template', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      learningService.learnFromEdit(
        'proj-1',
        'story',
        'Login feature',
        'As a user I want to login so that I can access my account'
      )

      expect(mockDb.prepare).toHaveBeenCalled()
    })
  })

  describe('getPatterns', () => {
    it('should return patterns for a project', () => {
      const mockPatterns = [
        {
          id: 'pattern-1',
          project_id: 'proj-1',
          pattern_type: 'approval_pattern',
          pattern_data: JSON.stringify({ keywords: ['login'] }),
          confidence: 0.8,
          usage_count: 5,
          success_count: 4,
          failure_count: 1,
          last_used: '2024-01-01',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockPatterns),
        get: vi.fn(),
        run: vi.fn()
      })

      const patterns = learningService.getPatterns('proj-1')

      expect(patterns.length).toBe(1)
      expect(patterns[0].id).toBe('pattern-1')
      expect(patterns[0].confidence).toBe(0.8)
    })

    it('should filter by pattern type', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      learningService.getPatterns('proj-1', 'rejection_pattern')

      expect(mockDb.prepare).toHaveBeenCalled()
    })
  })

  describe('getTopPatterns', () => {
    it('should return patterns sorted by confidence', () => {
      const mockPatterns = [
        {
          id: 'pattern-1',
          project_id: 'proj-1',
          pattern_type: 'approval_pattern',
          pattern_data: JSON.stringify({}),
          confidence: 0.9,
          usage_count: 10,
          success_count: 9,
          failure_count: 1,
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockPatterns),
        get: vi.fn(),
        run: vi.fn()
      })

      const patterns = learningService.getTopPatterns('proj-1', 5)

      expect(patterns.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('shouldAutoApprove', () => {
    it('should return false when no patterns exist', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const result = learningService.shouldAutoApprove('proj-1', 'story', 'New feature')

      expect(result.autoApprove).toBe(false)
      expect(result.confidence).toBe(0)
    })

    it('should return false when rejection pattern has high confidence', () => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('pattern_type')) {
          return {
            all: vi.fn(() => [{
              id: 'reject-1',
              project_id: 'proj-1',
              pattern_type: 'rejection_pattern',
              pattern_data: JSON.stringify({ keywords: ['feature'] }),
              confidence: 0.9,
              usage_count: 5,
              success_count: 5,
              failure_count: 0,
              created_at: '2024-01-01',
              updated_at: '2024-01-01'
            }]),
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

      const result = learningService.shouldAutoApprove('proj-1', 'story', 'Feature request')

      expect(result.autoApprove).toBe(false)
    })

    it('should return true for high confidence approval pattern with sufficient usage', () => {
      const autoApproveTriggered = vi.fn()
      learningService.on('auto-approve-triggered', autoApproveTriggered)

      // Mock needs to check the parameters passed to .all(), not the query string
      mockDb.prepare.mockReturnValue({
        all: vi.fn((...params: unknown[]) => {
          // Check if rejection_pattern is in the params
          if (params.includes('rejection_pattern')) {
            return [] // No rejection patterns
          }
          // Return approval pattern for approval_pattern query
          return [{
            id: 'approval-1',
            project_id: 'proj-1',
            pattern_type: 'approval_pattern',
            pattern_data: JSON.stringify({ keywords: ['login', 'feature'] }),
            confidence: 0.9,
            usage_count: 5,
            success_count: 5,
            failure_count: 0,
            created_at: '2024-01-01',
            updated_at: '2024-01-01'
          }]
        }),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const result = learningService.shouldAutoApprove('proj-1', 'story', 'Login feature')

      expect(result.autoApprove).toBe(true)
      expect(result.confidence).toBe(0.9)
      expect(autoApproveTriggered).toHaveBeenCalled()
    })
  })

  describe('getSuggestedFormat', () => {
    it('should return null when no format patterns exist', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const format = learningService.getSuggestedFormat('proj-1', 'story')

      expect(format).toBeNull()
    })

    it('should return null when confidence is too low', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [{
          pattern_data: JSON.stringify({ corrected: 'Format template' }),
          confidence: 0.3
        }]),
        get: vi.fn(),
        run: vi.fn()
      })

      const format = learningService.getSuggestedFormat('proj-1', 'story')

      expect(format).toBeNull()
    })

    it('should return format when confidence is high', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [{
          pattern_data: JSON.stringify({ corrected: 'As a user I want...' }),
          confidence: 0.8
        }]),
        get: vi.fn(),
        run: vi.fn()
      })

      const format = learningService.getSuggestedFormat('proj-1', 'story')

      expect(format).toBe('As a user I want...')
    })
  })

  describe('updatePatternConfidence', () => {
    it('should increase confidence on success', () => {
      const patternUpdated = vi.fn()
      learningService.on('pattern-updated', patternUpdated)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => ({
          confidence: 0.5,
          usage_count: 2,
          success_count: 2,
          failure_count: 0
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      learningService.updatePatternConfidence('pattern-1', true)

      expect(patternUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          patternId: 'pattern-1',
          success: true
        })
      )
    })

    it('should decrease confidence on failure', () => {
      const patternUpdated = vi.fn()
      learningService.on('pattern-updated', patternUpdated)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => ({
          confidence: 0.5,
          usage_count: 2,
          success_count: 2,
          failure_count: 0
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      learningService.updatePatternConfidence('pattern-1', false)

      expect(patternUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      )
    })

    it('should handle non-existent pattern gracefully', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => undefined),
        run: vi.fn()
      })

      // Should not throw
      expect(() => learningService.updatePatternConfidence('nonexistent', true)).not.toThrow()
    })
  })

  describe('cleanupLowConfidencePatterns', () => {
    it('should delete low confidence patterns', () => {
      const patternsCleaned = vi.fn()
      learningService.on('patterns-cleaned', patternsCleaned)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 5 }))
      })

      const deleted = learningService.cleanupLowConfidencePatterns('proj-1')

      expect(deleted).toBe(5)
      expect(patternsCleaned).toHaveBeenCalledWith({
        projectId: 'proj-1',
        deletedCount: 5,
        threshold: expect.any(Number)
      })
    })

    it('should accept custom threshold', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 0 }))
      })

      learningService.cleanupLowConfidencePatterns('proj-1', 0.5)

      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should not emit event when nothing deleted', () => {
      const patternsCleaned = vi.fn()
      learningService.on('patterns-cleaned', patternsCleaned)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(),
        run: vi.fn(() => ({ changes: 0 }))
      })

      learningService.cleanupLowConfidencePatterns('proj-1')

      expect(patternsCleaned).not.toHaveBeenCalled()
    })
  })

  describe('getProjectStats', () => {
    it('should return project statistics', () => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('AVG')) {
          return {
            all: vi.fn(),
            get: vi.fn(() => ({ avg: 0.65 })),
            run: vi.fn()
          }
        }
        if (query.includes('GROUP BY')) {
          return {
            all: vi.fn(() => [
              { pattern_type: 'approval_pattern', count: 10 },
              { pattern_type: 'rejection_pattern', count: 3 }
            ]),
            get: vi.fn(),
            run: vi.fn()
          }
        }
        return {
          all: vi.fn(),
          get: vi.fn(() => ({ count: 15 })),
          run: vi.fn()
        }
      })

      const stats = learningService.getProjectStats('proj-1')

      expect(stats.totalPatterns).toBeDefined()
      expect(stats.averageConfidence).toBeDefined()
      expect(stats.patternsByType).toBeDefined()
    })

    it('should handle empty project', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({ count: 0, avg: null })),
        run: vi.fn()
      })

      const stats = learningService.getProjectStats('empty-proj')

      expect(stats.totalPatterns).toBe(0)
      expect(stats.averageConfidence).toBe(0)
    })
  })
})
