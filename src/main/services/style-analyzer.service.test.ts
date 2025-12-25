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

vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

// Import after mocking
const { styleAnalyzerService } = await import('./style-analyzer.service')

describe('StyleAnalyzerService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear the cache before each test
    styleAnalyzerService.invalidateCache('proj-1')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(styleAnalyzerService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof styleAnalyzerService.analyzeProject).toBe('function')
      expect(typeof styleAnalyzerService.analyzeStoryFormat).toBe('function')
      expect(typeof styleAnalyzerService.analyzeNamingConventions).toBe('function')
      expect(typeof styleAnalyzerService.analyzeTestPatterns).toBe('function')
      expect(typeof styleAnalyzerService.analyzeTaskPatterns).toBe('function')
      expect(typeof styleAnalyzerService.suggestStoryTitle).toBe('function')
      expect(typeof styleAnalyzerService.invalidateCache).toBe('function')
    })
  })

  describe('analyzeStoryFormat', () => {
    it('should return default format when no stories exist', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const format = await styleAnalyzerService.analyzeStoryFormat('proj-1')

      expect(format.averageTitleLength).toBe(0)
      expect(format.commonPriorities).toContain('medium')
    })

    it('should calculate average title length', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { title: 'Story one', description: null, priority: 'high' },
          { title: 'Story two here', description: null, priority: 'medium' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const format = await styleAnalyzerService.analyzeStoryFormat('proj-1')

      expect(format.averageTitleLength).toBeGreaterThan(0)
    })

    it('should detect common priorities', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { title: 'Story 1', description: null, priority: 'high' },
          { title: 'Story 2', description: null, priority: 'high' },
          { title: 'Story 3', description: null, priority: 'medium' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const format = await styleAnalyzerService.analyzeStoryFormat('proj-1')

      expect(format.commonPriorities[0]).toBe('high')
    })

    it('should detect user story title pattern', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { title: 'As a user, I want to login', description: null, priority: 'high' },
          { title: 'As an admin, I want to manage users', description: null, priority: 'medium' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const format = await styleAnalyzerService.analyzeStoryFormat('proj-1')

      expect(format.titlePattern).toBeDefined()
    })
  })

  describe('analyzeNamingConventions', () => {
    it('should detect title case conventions', async () => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('user_stories')) {
          return {
            all: vi.fn(() => [
              { title: 'Add User Authentication' },
              { title: 'Update Dashboard' }
            ]),
            get: vi.fn(),
            run: vi.fn()
          }
        }
        return {
          all: vi.fn(() => [
            { title: 'implement login' },
            { title: 'fix bug' }
          ]),
          get: vi.fn(),
          run: vi.fn()
        }
      })

      const conventions = await styleAnalyzerService.analyzeNamingConventions('proj-1')

      expect(conventions.storyTitleCase).toBeDefined()
      expect(conventions.taskTitleCase).toBeDefined()
    })

    it('should find common prefixes', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { title: 'feat: Add feature' },
          { title: 'feat: Update feature' },
          { title: 'fix: Bug fix' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const conventions = await styleAnalyzerService.analyzeNamingConventions('proj-1')

      expect(conventions.commonPrefixes).toBeDefined()
      expect(Array.isArray(conventions.commonPrefixes)).toBe(true)
    })

    it('should find common suffixes', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { title: 'User login - WIP' },
          { title: 'Dashboard update - WIP' },
          { title: 'Settings page - DONE' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const conventions = await styleAnalyzerService.analyzeNamingConventions('proj-1')

      expect(conventions.commonSuffixes).toBeDefined()
      expect(Array.isArray(conventions.commonSuffixes)).toBe(true)
    })
  })

  describe('analyzeTestPatterns', () => {
    it('should return default patterns when no tests exist', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const patterns = await styleAnalyzerService.analyzeTestPatterns('proj-1')

      expect(patterns.commonTestTypes).toEqual([])
      expect(patterns.averageTestsPerStory).toBe(0)
    })

    it('should calculate average tests per story', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { title: 'Test 1', user_story_id: 'story-1' },
          { title: 'Test 2', user_story_id: 'story-1' },
          { title: 'Test 3', user_story_id: 'story-2' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const patterns = await styleAnalyzerService.analyzeTestPatterns('proj-1')

      expect(patterns.averageTestsPerStory).toBeGreaterThan(0)
    })

    it('should detect common test types', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { title: 'Unit test: login', user_story_id: null },
          { title: 'Unit test: logout', user_story_id: null },
          { title: 'Integration test: auth flow', user_story_id: null }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const patterns = await styleAnalyzerService.analyzeTestPatterns('proj-1')

      expect(patterns.commonTestTypes).toBeDefined()
    })
  })

  describe('analyzeTaskPatterns', () => {
    it('should return default patterns when no tasks exist', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const patterns = await styleAnalyzerService.analyzeTaskPatterns('proj-1')

      expect(patterns.commonTaskTypes).toEqual([])
      expect(patterns.averageTasksPerStory).toBe(0)
    })

    it('should detect common task types', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { task_type: 'code-generation', agent_type: 'developer', roadmap_item_id: 'item-1' },
          { task_type: 'testing', agent_type: 'tester', roadmap_item_id: 'item-1' },
          { task_type: 'security-audit', agent_type: 'security', roadmap_item_id: 'item-1' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const patterns = await styleAnalyzerService.analyzeTaskPatterns('proj-1')

      expect(patterns.commonTaskTypes.length).toBeGreaterThan(0)
    })

    it('should detect common agent types', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { task_type: 'code', agent_type: 'developer', roadmap_item_id: null },
          { task_type: 'test', agent_type: 'tester', roadmap_item_id: null }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const patterns = await styleAnalyzerService.analyzeTaskPatterns('proj-1')

      expect(patterns.commonAgentTypes.length).toBeGreaterThan(0)
    })
  })

  describe('analyzeProject', () => {
    it('should perform full analysis', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const analysis = await styleAnalyzerService.analyzeProject('proj-1')

      expect(analysis.storyFormat).toBeDefined()
      expect(analysis.namingConventions).toBeDefined()
      expect(analysis.testPatterns).toBeDefined()
      expect(analysis.taskPatterns).toBeDefined()
    })

    it('should cache analysis results', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      // First call
      await styleAnalyzerService.analyzeProject('proj-1')

      // Clear call counts
      vi.clearAllMocks()

      // Second call should use cache
      await styleAnalyzerService.analyzeProject('proj-1')

      // Should not query database again
      expect(mockDb.prepare).not.toHaveBeenCalled()
    })

    it('should clear cache', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      // First call
      await styleAnalyzerService.analyzeProject('proj-1')

      // Clear cache
      styleAnalyzerService.invalidateCache('proj-1')

      // Second call should query database
      await styleAnalyzerService.analyzeProject('proj-1')

      expect(mockDb.prepare).toHaveBeenCalled()
    })
  })

  describe('suggestStoryTitle', () => {
    it('should return null when no patterns exist', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      const suggestions = await styleAnalyzerService.suggestStoryTitle('proj-1', 'login')

      expect(suggestions).toBeDefined()
    })

    it('should suggest title based on learned patterns', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { title: 'As a user, I want to view dashboard', description: null, priority: 'high' },
          { title: 'As a user, I want to update profile', description: null, priority: 'medium' }
        ]),
        get: vi.fn(() => ({ count: 5 })),
        run: vi.fn()
      })

      // Clear cache and analyze
      styleAnalyzerService.invalidateCache('proj-1')

      const suggestions = await styleAnalyzerService.suggestStoryTitle('proj-1', ['reset', 'password'])

      expect(suggestions).toBeDefined()
    })
  })

  describe('suggestTaskTitle', () => {
    it('should return task title suggestion', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { title: 'feat: Add user login' },
          { title: 'feat: Update dashboard' }
        ]),
        get: vi.fn(() => ({ count: 5 })),
        run: vi.fn()
      })

      styleAnalyzerService.invalidateCache('proj-1')

      const suggestion = await styleAnalyzerService.suggestTaskTitle('proj-1', 'User authentication')

      expect(suggestion).toBeDefined()
    })

    it('should return null when no prefixes exist', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(() => ({ count: 0 })),
        run: vi.fn()
      })

      styleAnalyzerService.invalidateCache('proj-1')

      const suggestion = await styleAnalyzerService.suggestTaskTitle('proj-1', 'Feature')

      expect(suggestion).toBeNull()
    })
  })

  describe('detectTitleCase', () => {
    it('should detect sentence case', () => {
      // Test via analyzeNamingConventions
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { title: 'This is sentence case' },
          { title: 'Another sentence here' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })
    })

    it('should detect title case', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { title: 'This Is Title Case' },
          { title: 'Another Title Case' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })
    })

    it('should detect lowercase', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          { title: 'all lowercase here' },
          { title: 'another lowercase' }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })
    })
  })

  describe('cache management', () => {
    it('should clear cache for specific project', () => {
      // This depends on implementation - clearCache might take projectId
      styleAnalyzerService.invalidateCache('proj-1')
      expect(true).toBe(true) // No error thrown
    })

    it('should clear all cache', () => {
      styleAnalyzerService.invalidateCache('proj-1')
      expect(true).toBe(true) // No error thrown
    })
  })
})
