/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock simple-git
const mockGit = vi.hoisted(() => ({
  status: vi.fn(),
  log: vi.fn(),
  branch: vi.fn(),
  checkout: vi.fn(),
  add: vi.fn(),
  reset: vi.fn(),
  commit: vi.fn(),
  diff: vi.fn(),
  pull: vi.fn(),
  push: vi.fn()
}))

const mockSimpleGit = vi.hoisted(() => vi.fn(() => mockGit))

vi.mock('simple-git', () => ({
  default: mockSimpleGit
}))

// Import after mocking
const { gitService } = await import('./git.service')

describe('GitService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    gitService.clearCache('/test/project')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(gitService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof gitService.getStatus).toBe('function')
      expect(typeof gitService.getLog).toBe('function')
      expect(typeof gitService.getBranches).toBe('function')
      expect(typeof gitService.checkout).toBe('function')
      expect(typeof gitService.stage).toBe('function')
      expect(typeof gitService.unstage).toBe('function')
      expect(typeof gitService.commit).toBe('function')
      expect(typeof gitService.getDiff).toBe('function')
      expect(typeof gitService.pull).toBe('function')
      expect(typeof gitService.push).toBe('function')
      expect(typeof gitService.clearCache).toBe('function')
    })
  })

  describe('getStatus', () => {
    it('should return repo status when git repo exists', async () => {
      mockGit.status.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        ahead: 2,
        behind: 1,
        staged: ['file1.ts'],
        renamed: [],
        modified: ['file2.ts'],
        deleted: [],
        not_added: ['file3.ts'],
        files: []
      })

      const status = await gitService.getStatus('/test/project')

      expect(status.isRepo).toBe(true)
      expect(status.current).toBe('main')
      expect(status.tracking).toBe('origin/main')
      expect(status.ahead).toBe(2)
      expect(status.behind).toBe(1)
    })

    it('should return non-repo status when directory is not a git repo', async () => {
      mockGit.status.mockRejectedValue(new Error('not a git repository'))

      const status = await gitService.getStatus('/not/a/repo')

      expect(status.isRepo).toBe(false)
      expect(status.current).toBeNull()
      expect(status.tracking).toBeNull()
      expect(status.ahead).toBe(0)
      expect(status.behind).toBe(0)
    })

    it('should parse staged files correctly', async () => {
      mockGit.status.mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        staged: ['added.ts'],
        renamed: [],
        modified: [],
        deleted: [],
        not_added: [],
        files: [
          { path: 'modified.ts', index: 'M', working_dir: ' ' },
          { path: 'deleted.ts', index: 'D', working_dir: ' ' },
          { path: 'new.ts', index: 'A', working_dir: ' ' }
        ]
      })

      const status = await gitService.getStatus('/test/project')

      expect(status.staged).toContainEqual({ path: 'added.ts', status: 'added' })
      expect(status.staged).toContainEqual({ path: 'modified.ts', status: 'modified' })
      expect(status.staged).toContainEqual({ path: 'deleted.ts', status: 'deleted' })
      expect(status.staged).toContainEqual({ path: 'new.ts', status: 'added' })
    })

    it('should parse renamed files correctly', async () => {
      mockGit.status.mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        staged: ['new-name.ts'],
        renamed: [{ from: 'old-name.ts', to: 'new-name.ts' }],
        modified: [],
        deleted: [],
        not_added: [],
        files: []
      })

      const status = await gitService.getStatus('/test/project')

      expect(status.staged).toContainEqual({
        path: 'old-name.ts → new-name.ts',
        status: 'renamed'
      })
    })

    it('should parse unstaged modified files', async () => {
      mockGit.status.mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        staged: [],
        renamed: [],
        modified: ['changed.ts'],
        deleted: [],
        not_added: [],
        files: []
      })

      const status = await gitService.getStatus('/test/project')

      expect(status.unstaged).toContainEqual({
        path: 'changed.ts',
        status: 'modified'
      })
    })

    it('should parse unstaged deleted files', async () => {
      mockGit.status.mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        staged: [],
        renamed: [],
        modified: [],
        deleted: ['removed.ts'],
        not_added: [],
        files: []
      })

      const status = await gitService.getStatus('/test/project')

      expect(status.unstaged).toContainEqual({
        path: 'removed.ts',
        status: 'deleted'
      })
    })

    it('should parse untracked files', async () => {
      mockGit.status.mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        staged: [],
        renamed: [],
        modified: [],
        deleted: [],
        not_added: ['new-file.ts', 'another.ts'],
        files: []
      })

      const status = await gitService.getStatus('/test/project')

      expect(status.untracked).toContain('new-file.ts')
      expect(status.untracked).toContain('another.ts')
    })
  })

  describe('getLog', () => {
    it('should return commit history', async () => {
      mockGit.log.mockResolvedValue({
        all: [
          {
            hash: 'abc123def456',
            date: '2024-01-01T12:00:00Z',
            message: 'Initial commit',
            author_name: 'John Doe',
            author_email: 'john@example.com',
            body: 'Detailed description'
          },
          {
            hash: '789xyz000111',
            date: '2024-01-02T12:00:00Z',
            message: 'Add feature',
            author_name: 'Jane Doe',
            author_email: 'jane@example.com',
            body: ''
          }
        ]
      })

      const log = await gitService.getLog('/test/project')

      expect(log).toHaveLength(2)
      expect(log[0].hash).toBe('abc123def456')
      expect(log[0].hashShort).toBe('abc123d')
      expect(log[0].message).toBe('Initial commit')
      expect(log[0].authorName).toBe('John Doe')
      expect(log[0].body).toBe('Detailed description')
    })

    it('should respect limit parameter', async () => {
      mockGit.log.mockResolvedValue({ all: [] })

      await gitService.getLog('/test/project', 25)

      expect(mockGit.log).toHaveBeenCalledWith({ maxCount: 25 })
    })

    it('should use default limit of 50', async () => {
      mockGit.log.mockResolvedValue({ all: [] })

      await gitService.getLog('/test/project')

      expect(mockGit.log).toHaveBeenCalledWith({ maxCount: 50 })
    })

    it('should return empty array on error', async () => {
      mockGit.log.mockRejectedValue(new Error('Git error'))

      const log = await gitService.getLog('/test/project')

      expect(log).toEqual([])
    })

    it('should handle commits without body', async () => {
      mockGit.log.mockResolvedValue({
        all: [
          {
            hash: 'abc123def456',
            date: '2024-01-01',
            message: 'Commit',
            author_name: 'Author',
            author_email: 'author@test.com',
            body: null
          }
        ]
      })

      const log = await gitService.getLog('/test/project')

      expect(log[0].body).toBeUndefined()
    })
  })

  describe('getBranches', () => {
    it('should return all branches', async () => {
      mockGit.branch.mockResolvedValue({
        branches: {
          main: { current: true, commit: 'abc123', linkedWorkTree: null },
          'feature/test': { current: false, commit: 'def456', linkedWorkTree: null },
          'remotes/origin/main': { current: false, commit: 'abc123', linkedWorkTree: null }
        }
      })

      const branches = await gitService.getBranches('/test/project')

      expect(branches).toHaveLength(3)
      expect(branches.find(b => b.name === 'main')?.current).toBe(true)
      expect(branches.find(b => b.name === 'feature/test')?.current).toBe(false)
    })

    it('should strip remotes/ prefix from branch names', async () => {
      mockGit.branch.mockResolvedValue({
        branches: {
          'remotes/origin/main': { current: false, commit: 'abc123', linkedWorkTree: null }
        }
      })

      const branches = await gitService.getBranches('/test/project')

      expect(branches[0].name).toBe('origin/main')
    })

    it('should include commit hash', async () => {
      mockGit.branch.mockResolvedValue({
        branches: {
          main: { current: true, commit: 'abc123def', linkedWorkTree: null }
        }
      })

      const branches = await gitService.getBranches('/test/project')

      expect(branches[0].commit).toBe('abc123def')
    })

    it('should return empty array on error', async () => {
      mockGit.branch.mockRejectedValue(new Error('Git error'))

      const branches = await gitService.getBranches('/test/project')

      expect(branches).toEqual([])
    })

    it('should call branch with correct flags', async () => {
      mockGit.branch.mockResolvedValue({ branches: {} })

      await gitService.getBranches('/test/project')

      expect(mockGit.branch).toHaveBeenCalledWith(['-a', '-v'])
    })
  })

  describe('checkout', () => {
    it('should checkout branch successfully', async () => {
      mockGit.checkout.mockResolvedValue(undefined)

      const result = await gitService.checkout('/test/project', 'feature/new')

      expect(result).toBe(true)
      expect(mockGit.checkout).toHaveBeenCalledWith('feature/new')
    })

    it('should return false on error', async () => {
      mockGit.checkout.mockRejectedValue(new Error('Branch not found'))

      const result = await gitService.checkout('/test/project', 'nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('stage', () => {
    it('should stage files successfully', async () => {
      mockGit.add.mockResolvedValue(undefined)

      const result = await gitService.stage('/test/project', ['file1.ts', 'file2.ts'])

      expect(result).toBe(true)
      expect(mockGit.add).toHaveBeenCalledWith(['file1.ts', 'file2.ts'])
    })

    it('should return false on error', async () => {
      mockGit.add.mockRejectedValue(new Error('Stage failed'))

      const result = await gitService.stage('/test/project', ['bad-file.ts'])

      expect(result).toBe(false)
    })
  })

  describe('unstage', () => {
    it('should unstage files successfully', async () => {
      mockGit.reset.mockResolvedValue(undefined)

      const result = await gitService.unstage('/test/project', ['file1.ts', 'file2.ts'])

      expect(result).toBe(true)
      expect(mockGit.reset).toHaveBeenCalledWith(['HEAD', '--', 'file1.ts', 'file2.ts'])
    })

    it('should return false on error', async () => {
      mockGit.reset.mockRejectedValue(new Error('Unstage failed'))

      const result = await gitService.unstage('/test/project', ['bad-file.ts'])

      expect(result).toBe(false)
    })
  })

  describe('commit', () => {
    it('should create commit successfully', async () => {
      mockGit.commit.mockResolvedValue(undefined)

      const result = await gitService.commit('/test/project', 'Add new feature')

      expect(result).toBe(true)
      expect(mockGit.commit).toHaveBeenCalledWith('Add new feature')
    })

    it('should return false on error', async () => {
      mockGit.commit.mockRejectedValue(new Error('Nothing to commit'))

      const result = await gitService.commit('/test/project', 'Empty commit')

      expect(result).toBe(false)
    })
  })

  describe('getDiff', () => {
    it('should return diff for specific file', async () => {
      mockGit.diff.mockResolvedValue('- old line\n+ new line')

      const diff = await gitService.getDiff('/test/project', 'changed.ts')

      expect(diff).toContain('- old line')
      expect(diff).toContain('+ new line')
      expect(mockGit.diff).toHaveBeenCalledWith(['changed.ts'])
    })

    it('should return diff for all changes when no file specified', async () => {
      mockGit.diff.mockResolvedValue('all diffs')

      const diff = await gitService.getDiff('/test/project')

      expect(diff).toBe('all diffs')
      expect(mockGit.diff).toHaveBeenCalledWith()
    })

    it('should return empty string on error', async () => {
      mockGit.diff.mockRejectedValue(new Error('Git error'))

      const diff = await gitService.getDiff('/test/project')

      expect(diff).toBe('')
    })
  })

  describe('pull', () => {
    it('should pull successfully with changes', async () => {
      mockGit.pull.mockResolvedValue({
        summary: {
          changes: 5,
          insertions: 10,
          deletions: 3
        }
      })

      const result = await gitService.pull('/test/project')

      expect(result.success).toBe(true)
      expect(result.summary).toBe('5 changes, 10 insertions, 3 deletions')
    })

    it('should return "Already up to date" when no changes', async () => {
      mockGit.pull.mockResolvedValue({})

      const result = await gitService.pull('/test/project')

      expect(result.success).toBe(true)
      expect(result.summary).toBe('Already up to date')
    })

    it('should return error on failure', async () => {
      mockGit.pull.mockRejectedValue(new Error('Merge conflict'))

      const result = await gitService.pull('/test/project')

      expect(result.success).toBe(false)
      expect(result.summary).toContain('Merge conflict')
    })
  })

  describe('push', () => {
    it('should push successfully', async () => {
      mockGit.push.mockResolvedValue(undefined)

      const result = await gitService.push('/test/project')

      expect(result.success).toBe(true)
      expect(result.summary).toBe('Pushed successfully')
    })

    it('should return error on failure', async () => {
      mockGit.push.mockRejectedValue(new Error('Remote rejected'))

      const result = await gitService.push('/test/project')

      expect(result.success).toBe(false)
      expect(result.summary).toContain('Remote rejected')
    })
  })

  describe('clearCache', () => {
    it('should clear cached git instance', async () => {
      // First call creates instance
      mockGit.status.mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        staged: [],
        renamed: [],
        modified: [],
        deleted: [],
        not_added: [],
        files: []
      })

      await gitService.getStatus('/test/project')

      // Clear cache
      gitService.clearCache('/test/project')

      // Should create new instance on next call
      await gitService.getStatus('/test/project')

      // simpleGit should be called twice (once before cache, once after clear)
      expect(mockSimpleGit).toHaveBeenCalled()
    })

    it('should not throw when clearing non-existent cache', () => {
      expect(() => gitService.clearCache('/nonexistent')).not.toThrow()
    })
  })

  describe('instance caching', () => {
    it('should reuse git instance for same project', async () => {
      mockGit.status.mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        staged: [],
        renamed: [],
        modified: [],
        deleted: [],
        not_added: [],
        files: []
      })

      const callCountBefore = mockSimpleGit.mock.calls.length

      await gitService.getStatus('/same/project')
      await gitService.getStatus('/same/project')
      await gitService.getStatus('/same/project')

      const callCountAfter = mockSimpleGit.mock.calls.length

      // Should only create one new instance
      expect(callCountAfter - callCountBefore).toBe(1)
    })

    it('should create separate instances for different projects', async () => {
      mockGit.status.mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        staged: [],
        renamed: [],
        modified: [],
        deleted: [],
        not_added: [],
        files: []
      })

      const callCountBefore = mockSimpleGit.mock.calls.length

      await gitService.getStatus('/project-a')
      await gitService.getStatus('/project-b')

      const callCountAfter = mockSimpleGit.mock.calls.length

      // Should create two instances
      expect(callCountAfter - callCountBefore).toBe(2)
    })
  })
})
