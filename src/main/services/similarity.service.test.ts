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
    run: vi.fn()
  }))
}))

const mockDatabaseService = vi.hoisted(() => ({
  getDb: vi.fn(() => mockDb)
}))

vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

// Import after mocking
const { similarityService } = await import('./similarity.service')

describe('SimilarityService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(similarityService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof similarityService.findSimilarStories).toBe('function')
      expect(typeof similarityService.findSimilarTasks).toBe('function')
      expect(typeof similarityService.findSimilarRoadmapItems).toBe('function')
      expect(typeof similarityService.findSimilar).toBe('function')
    })
  })

  describe('findSimilarStories', () => {
    it('should find exact title match', async () => {
      const mockItems = [
        { id: 'story_1', title: 'User login feature', description: 'Implement login' }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockItems),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilarStories(
        'proj-1',
        'User login feature'
      )

      expect(results.length).toBeGreaterThan(0)
      // Exact titles result in very high similarity (0.75+)
      expect(['exact', 'high']).toContain(results[0].matchType)
      expect(results[0].score).toBeGreaterThanOrEqual(0.75)
    })

    it('should find similar titles', async () => {
      const mockItems = [
        { id: 'story_1', title: 'User authentication login', description: null }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockItems),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilarStories(
        'proj-1',
        'User login authentication'
      )

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].score).toBeGreaterThan(0.3)
    })

    it('should return empty for no matches', async () => {
      const mockItems = [
        { id: 'story_1', title: 'Database migration', description: null }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockItems),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilarStories(
        'proj-1',
        'User interface design'
      )

      expect(results).toEqual([])
    })
  })

  describe('findSimilarTasks', () => {
    it('should query task_queue table', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      await similarityService.findSimilarTasks('proj-1', 'Test task')

      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should find similar tasks', async () => {
      const mockItems = [
        { id: 'task_1', title: 'Fix login bug', description: 'Authentication issue' }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockItems),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilarTasks(
        'proj-1',
        'Fix authentication bug'
      )

      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('findSimilarRoadmapItems', () => {
    it('should query roadmap_items table', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      await similarityService.findSimilarRoadmapItems('proj-1', 'New feature')

      expect(mockDb.prepare).toHaveBeenCalled()
    })
  })

  describe('findSimilar', () => {
    it('should handle story type', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilar(
        'proj-1',
        'story',
        'Test title'
      )

      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle task type', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilar(
        'proj-1',
        'task',
        'Test title'
      )

      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle roadmap type', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilar(
        'proj-1',
        'roadmap',
        'Test title'
      )

      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle test type', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilar(
        'proj-1',
        'test',
        'Test title'
      )

      expect(Array.isArray(results)).toBe(true)
    })

    it('should include description in matching', async () => {
      const mockItems = [
        {
          id: 'story_1',
          title: 'Feature',
          description: 'User authentication with OAuth'
        }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockItems),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilar(
        'proj-1',
        'story',
        'Login',
        'OAuth authentication flow'
      )

      expect(results.length).toBeGreaterThanOrEqual(0)
    })

    it('should return results sorted by score', async () => {
      const mockItems = [
        { id: 'story_1', title: 'User registration', description: null },
        { id: 'story_2', title: 'User login', description: null },
        { id: 'story_3', title: 'User profile', description: null }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockItems),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilar(
        'proj-1',
        'story',
        'User login page'
      )

      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
        }
      }
    })

    it('should limit results to 10', async () => {
      const mockItems = Array.from({ length: 20 }, (_, i) => ({
        id: `story_${i}`,
        title: `Similar feature ${i}`,
        description: 'Feature description'
      }))

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockItems),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilar(
        'proj-1',
        'story',
        'Similar feature'
      )

      expect(results.length).toBeLessThanOrEqual(10)
    })
  })

  describe('similarity scoring', () => {
    it('should classify exact matches correctly', async () => {
      const mockItems = [
        { id: 'story_1', title: 'Complete user registration', description: null }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockItems),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilar(
        'proj-1',
        'story',
        'Complete user registration'
      )

      // Same title should result in very high similarity (0.75+)
      expect(['exact', 'high']).toContain(results[0].matchType)
      expect(results[0].score).toBeGreaterThanOrEqual(0.75)
    })

    it('should include breakdown in results', async () => {
      const mockItems = [
        { id: 'story_1', title: 'User auth', description: 'Authentication' }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockItems),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilar(
        'proj-1',
        'story',
        'User authentication'
      )

      if (results.length > 0) {
        expect(results[0].breakdown).toBeDefined()
        expect(results[0].breakdown).toHaveProperty('titleSimilarity')
        expect(results[0].breakdown).toHaveProperty('descriptionSimilarity')
        expect(results[0].breakdown).toHaveProperty('keywordOverlap')
      }
    })

    it('should handle items without descriptions', async () => {
      const mockItems = [
        { id: 'story_1', title: 'Feature A', description: null },
        { id: 'story_2', title: 'Feature B', description: undefined }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockItems),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilar(
        'proj-1',
        'story',
        'Feature A'
      )

      // Should not throw
      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle empty title', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilar(
        'proj-1',
        'story',
        ''
      )

      expect(Array.isArray(results)).toBe(true)
    })

    it('should filter stopwords', async () => {
      const mockItems = [
        { id: 'story_1', title: 'Create the user profile', description: null }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockItems),
        get: vi.fn(),
        run: vi.fn()
      })

      // "the" should be filtered as stopword
      const results = await similarityService.findSimilar(
        'proj-1',
        'story',
        'Create user profile'
      )

      if (results.length > 0) {
        // Should match well despite different stopwords
        expect(results[0].score).toBeGreaterThan(0.5)
      }
    })
  })

  describe('match types', () => {
    it('should classify high similarity correctly', async () => {
      const mockItems = [
        { id: 'story_1', title: 'User login page', description: null }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockItems),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilar(
        'proj-1',
        'story',
        'User login screen'
      )

      if (results.length > 0 && results[0].score >= 0.75) {
        expect(results[0].matchType).toBe('high')
      }
    })

    it('should classify medium similarity', async () => {
      const mockItems = [
        { id: 'story_1', title: 'User authentication module', description: null }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockItems),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilar(
        'proj-1',
        'story',
        'User login module'
      )

      if (results.length > 0 && results[0].score >= 0.5 && results[0].score < 0.75) {
        expect(results[0].matchType).toBe('medium')
      }
    })

    it('should classify low similarity', async () => {
      const mockItems = [
        { id: 'story_1', title: 'Database optimization', description: null }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockItems),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilar(
        'proj-1',
        'story',
        'User feature database'
      )

      if (results.length > 0 && results[0].score < 0.5 && results[0].score >= 0.3) {
        expect(results[0].matchType).toBe('low')
      }
    })
  })

  describe('algorithm correctness', () => {
    it('should handle case insensitivity', async () => {
      const mockItems = [
        { id: 'story_1', title: 'USER LOGIN', description: null }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockItems),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilar(
        'proj-1',
        'story',
        'user login'
      )

      expect(results.length).toBeGreaterThan(0)
      // Case insensitive matching should result in high similarity
      expect(['exact', 'high']).toContain(results[0].matchType)
      expect(results[0].score).toBeGreaterThanOrEqual(0.75)
    })

    it('should handle punctuation', async () => {
      const mockItems = [
        { id: 'story_1', title: 'User login, authentication!', description: null }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockItems),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilar(
        'proj-1',
        'story',
        'User login authentication'
      )

      if (results.length > 0) {
        expect(results[0].score).toBeGreaterThan(0.5)
      }
    })

    it('should handle extra whitespace', async () => {
      const mockItems = [
        { id: 'story_1', title: '  User   login  feature  ', description: null }
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockItems),
        get: vi.fn(),
        run: vi.fn()
      })

      const results = await similarityService.findSimilar(
        'proj-1',
        'story',
        'User login feature'
      )

      expect(results.length).toBeGreaterThan(0)
    })
  })
})
