/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock simple-git
const mockSimpleGit = vi.hoisted(() => ({
  checkoutBranch: vi.fn(() => Promise.resolve()),
  checkoutLocalBranch: vi.fn(() => Promise.resolve()),
  checkout: vi.fn(() => Promise.resolve()),
  deleteLocalBranch: vi.fn(() => Promise.resolve()),
  push: vi.fn(() => Promise.resolve()),
  pushTags: vi.fn(() => Promise.resolve()),
  merge: vi.fn(() => Promise.resolve({ commit: 'abc123', result: 'Merge successful' })),
  tag: vi.fn(() => Promise.resolve()),
  tags: vi.fn(() => Promise.resolve({ all: ['v1.0.0', 'v1.1.0'] })),
  add: vi.fn(() => Promise.resolve()),
  status: vi.fn(() => Promise.resolve({ staged: ['file.ts'], current: 'main' })),
  commit: vi.fn(() => Promise.resolve({ commit: 'abc123' })),
  log: vi.fn(() => Promise.resolve({ all: [], total: 0, latest: { hash: 'abc123' } })),
  diff: vi.fn(() => Promise.resolve('file1.ts\nfile2.ts')),
  fetch: vi.fn(() => Promise.resolve()),
  rebase: vi.fn(() => Promise.resolve()),
  raw: vi.fn(() => Promise.resolve('0\t0'))
}))

vi.mock('simple-git', () => ({
  default: vi.fn(() => mockSimpleGit)
}))

// Mock git service
const mockGitService = vi.hoisted(() => ({
  getStatus: vi.fn(() => Promise.resolve({ current: 'main' }))
}))

vi.mock('./git.service', () => ({
  gitService: mockGitService
}))

// Import after mocking
const { gitAutomationService } = await import('./git-automation.service')

describe('GitAutomationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    gitAutomationService.removeAllListeners()
  })

  afterEach(() => {
    vi.clearAllMocks()
    gitAutomationService.removeAllListeners()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(gitAutomationService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof gitAutomationService.createBranch).toBe('function')
      expect(typeof gitAutomationService.createFeatureBranch).toBe('function')
      expect(typeof gitAutomationService.createReleaseBranch).toBe('function')
      expect(typeof gitAutomationService.createHotfixBranch).toBe('function')
      expect(typeof gitAutomationService.deleteBranch).toBe('function')
      expect(typeof gitAutomationService.renameBranch).toBe('function')
      expect(typeof gitAutomationService.mergeBranch).toBe('function')
      expect(typeof gitAutomationService.mergeBranchInto).toBe('function')
      expect(typeof gitAutomationService.abortMerge).toBe('function')
      expect(typeof gitAutomationService.createTag).toBe('function')
      expect(typeof gitAutomationService.createVersionTag).toBe('function')
      expect(typeof gitAutomationService.deleteTag).toBe('function')
      expect(typeof gitAutomationService.listTags).toBe('function')
      expect(typeof gitAutomationService.pushTags).toBe('function')
      expect(typeof gitAutomationService.commitAgentChanges).toBe('function')
      expect(typeof gitAutomationService.amendCommit).toBe('function')
      expect(typeof gitAutomationService.cherryPick).toBe('function')
      expect(typeof gitAutomationService.fetch).toBe('function')
      expect(typeof gitAutomationService.pushWithUpstream).toBe('function')
      expect(typeof gitAutomationService.preparePullRequest).toBe('function')
      expect(typeof gitAutomationService.isBranchUpToDate).toBe('function')
      expect(typeof gitAutomationService.rebase).toBe('function')
      expect(typeof gitAutomationService.abortRebase).toBe('function')
      expect(typeof gitAutomationService.clearCache).toBe('function')
    })

    it('should be an EventEmitter', () => {
      expect(typeof gitAutomationService.on).toBe('function')
      expect(typeof gitAutomationService.emit).toBe('function')
    })
  })

  describe('createBranch', () => {
    it('should create branch from current HEAD', async () => {
      const result = await gitAutomationService.createBranch('/project', 'new-branch')

      expect(result.success).toBe(true)
      expect(result.message).toContain('new-branch')
      expect(mockSimpleGit.checkoutLocalBranch).toHaveBeenCalledWith('new-branch')
    })

    it('should create branch from specified base', async () => {
      const result = await gitAutomationService.createBranch('/project', 'new-branch', 'develop')

      expect(result.success).toBe(true)
      expect(mockSimpleGit.checkoutBranch).toHaveBeenCalledWith('new-branch', 'develop')
    })

    it('should emit branch-created event', async () => {
      const createdHandler = vi.fn()
      gitAutomationService.on('branch-created', createdHandler)

      await gitAutomationService.createBranch('/project', 'feature-branch')

      expect(createdHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          branchName: 'feature-branch'
        })
      )
    })

    it('should handle errors gracefully', async () => {
      mockSimpleGit.checkoutLocalBranch.mockRejectedValueOnce(new Error('Branch exists'))

      const result = await gitAutomationService.createBranch('/project', 'existing-branch')

      expect(result.success).toBe(false)
      expect(result.message).toContain('Branch exists')
    })
  })

  describe('createFeatureBranch', () => {
    it('should create feature branch with naming convention', async () => {
      const result = await gitAutomationService.createFeatureBranch('/project', 'My New Feature')

      expect(result.success).toBe(true)
      expect(result.branchName).toBe('feature/my-new-feature')
    })

    it('should sanitize special characters', async () => {
      const result = await gitAutomationService.createFeatureBranch('/project', 'Test@Feature#123')

      expect(result.branchName).toBe('feature/test-feature-123')
    })

    it('should use specified base branch', async () => {
      await gitAutomationService.createFeatureBranch('/project', 'feature', 'develop')

      expect(mockSimpleGit.checkoutBranch).toHaveBeenCalledWith('feature/feature', 'develop')
    })
  })

  describe('createReleaseBranch', () => {
    it('should create release branch with version', async () => {
      const result = await gitAutomationService.createReleaseBranch('/project', '1.0.0')

      expect(result.success).toBe(true)
      expect(result.branchName).toBe('release/1.0.0')
    })
  })

  describe('createHotfixBranch', () => {
    it('should create hotfix branch', async () => {
      const result = await gitAutomationService.createHotfixBranch('/project', 'critical-fix')

      expect(result.success).toBe(true)
      expect(result.branchName).toBe('hotfix/critical-fix')
    })
  })

  describe('deleteBranch', () => {
    it('should delete local branch', async () => {
      const result = await gitAutomationService.deleteBranch('/project', 'old-branch')

      expect(result.success).toBe(true)
      expect(mockSimpleGit.deleteLocalBranch).toHaveBeenCalledWith('old-branch', true)
    })

    it('should delete remote branch when specified', async () => {
      await gitAutomationService.deleteBranch('/project', 'old-branch', true)

      expect(mockSimpleGit.push).toHaveBeenCalledWith('origin', ':old-branch')
    })

    it('should emit branch-deleted event', async () => {
      const deletedHandler = vi.fn()
      gitAutomationService.on('branch-deleted', deletedHandler)

      await gitAutomationService.deleteBranch('/project', 'branch-to-delete')

      expect(deletedHandler).toHaveBeenCalled()
    })
  })

  describe('renameBranch', () => {
    it('should rename branch', async () => {
      const result = await gitAutomationService.renameBranch('/project', 'old-name', 'new-name')

      expect(result.success).toBe(true)
      expect(mockSimpleGit.raw).toHaveBeenCalledWith(['branch', '-m', 'old-name', 'new-name'])
    })
  })

  describe('mergeBranch', () => {
    it('should merge branch into current', async () => {
      const result = await gitAutomationService.mergeBranch('/project', 'feature-branch')

      expect(result.success).toBe(true)
      expect(mockSimpleGit.merge).toHaveBeenCalledWith(['feature-branch'])
    })

    it('should support no-fast-forward option', async () => {
      await gitAutomationService.mergeBranch('/project', 'feature', { noFastForward: true })

      expect(mockSimpleGit.merge).toHaveBeenCalledWith(['--no-ff', 'feature'])
    })

    it('should support squash option', async () => {
      await gitAutomationService.mergeBranch('/project', 'feature', { squash: true })

      expect(mockSimpleGit.merge).toHaveBeenCalledWith(['--squash', 'feature'])
    })

    it('should support custom merge message', async () => {
      await gitAutomationService.mergeBranch('/project', 'feature', { message: 'Merge feature' })

      expect(mockSimpleGit.merge).toHaveBeenCalledWith(['-m', 'Merge feature', 'feature'])
    })

    it('should handle merge conflicts', async () => {
      mockSimpleGit.merge.mockRejectedValueOnce({
        git: { conflicts: ['file1.ts', 'file2.ts'] }
      })

      const result = await gitAutomationService.mergeBranch('/project', 'conflicting-branch')

      expect(result.success).toBe(false)
      expect(result.conflicts).toEqual(['file1.ts', 'file2.ts'])
    })

    it('should emit branch-merged event', async () => {
      const mergedHandler = vi.fn()
      gitAutomationService.on('branch-merged', mergedHandler)

      await gitAutomationService.mergeBranch('/project', 'feature')

      expect(mergedHandler).toHaveBeenCalled()
    })
  })

  describe('mergeBranchInto', () => {
    it('should checkout target, merge, and return to original', async () => {
      const result = await gitAutomationService.mergeBranchInto('/project', 'feature', 'main')

      expect(result.success).toBe(true)
      expect(mockSimpleGit.checkout).toHaveBeenCalledWith('main')
    })
  })

  describe('abortMerge', () => {
    it('should abort ongoing merge', async () => {
      const result = await gitAutomationService.abortMerge('/project')

      expect(result.success).toBe(true)
      expect(mockSimpleGit.merge).toHaveBeenCalledWith(['--abort'])
    })
  })

  describe('createTag', () => {
    it('should create simple tag', async () => {
      const result = await gitAutomationService.createTag('/project', 'v1.0.0')

      expect(result.success).toBe(true)
      expect(mockSimpleGit.tag).toHaveBeenCalled()
    })

    it('should create annotated tag with message', async () => {
      await gitAutomationService.createTag('/project', 'v1.0.0', {
        annotated: true,
        message: 'Release 1.0.0'
      })

      expect(mockSimpleGit.tag).toHaveBeenCalledWith(['-a', 'v1.0.0', '-m', 'Release 1.0.0'])
    })

    it('should emit tag-created event', async () => {
      const createdHandler = vi.fn()
      gitAutomationService.on('tag-created', createdHandler)

      await gitAutomationService.createTag('/project', 'v1.0.0')

      expect(createdHandler).toHaveBeenCalled()
    })
  })

  describe('createVersionTag', () => {
    it('should create version tag with v prefix', async () => {
      const result = await gitAutomationService.createVersionTag('/project', '1.0.0')

      expect(result.tagName).toBe('v1.0.0')
    })

    it('should not duplicate v prefix', async () => {
      const result = await gitAutomationService.createVersionTag('/project', 'v1.0.0')

      expect(result.tagName).toBe('v1.0.0')
    })
  })

  describe('deleteTag', () => {
    it('should delete local tag', async () => {
      const result = await gitAutomationService.deleteTag('/project', 'v1.0.0')

      expect(result.success).toBe(true)
      expect(mockSimpleGit.tag).toHaveBeenCalledWith(['-d', 'v1.0.0'])
    })

    it('should delete remote tag when specified', async () => {
      await gitAutomationService.deleteTag('/project', 'v1.0.0', true)

      expect(mockSimpleGit.push).toHaveBeenCalledWith('origin', ':refs/tags/v1.0.0')
    })
  })

  describe('listTags', () => {
    it('should return list of tags', async () => {
      mockSimpleGit.raw.mockResolvedValueOnce('abc123\nRelease 1.0\n2024-01-01')
      mockSimpleGit.raw.mockResolvedValueOnce('def456\nRelease 1.1\n2024-02-01')

      const tags = await gitAutomationService.listTags('/project')

      expect(tags.length).toBe(2)
      expect(tags[0].name).toBe('v1.0.0')
    })
  })

  describe('pushTags', () => {
    it('should push all tags', async () => {
      const result = await gitAutomationService.pushTags('/project')

      expect(result.success).toBe(true)
      expect(mockSimpleGit.pushTags).toHaveBeenCalledWith('origin')
    })

    it('should push specific tag', async () => {
      const result = await gitAutomationService.pushTags('/project', 'v1.0.0')

      expect(result.success).toBe(true)
      expect(mockSimpleGit.push).toHaveBeenCalledWith('origin', 'v1.0.0')
    })
  })

  describe('commitAgentChanges', () => {
    it('should stage and commit all changes', async () => {
      const result = await gitAutomationService.commitAgentChanges('/project', 'Agent commit')

      expect(result.success).toBe(true)
      expect(mockSimpleGit.add).toHaveBeenCalledWith('.')
      expect(mockSimpleGit.commit).toHaveBeenCalled()
    })

    it('should stage specific files', async () => {
      await gitAutomationService.commitAgentChanges('/project', 'Commit', {
        files: ['file1.ts', 'file2.ts']
      })

      expect(mockSimpleGit.add).toHaveBeenCalledWith(['file1.ts', 'file2.ts'])
    })

    it('should include task metadata in message', async () => {
      const result = await gitAutomationService.commitAgentChanges('/project', 'Commit', {
        taskId: 'task-123',
        agentType: 'developer'
      })

      expect(result.success).toBe(true)
    })

    it('should return error when no changes to commit', async () => {
      mockSimpleGit.status.mockResolvedValueOnce({ staged: [], current: 'main' })

      const result = await gitAutomationService.commitAgentChanges('/project', 'Commit')

      expect(result.success).toBe(false)
      expect(result.message).toBe('No changes to commit')
    })

    it('should emit commit-created event', async () => {
      const createdHandler = vi.fn()
      gitAutomationService.on('commit-created', createdHandler)

      await gitAutomationService.commitAgentChanges('/project', 'Commit')

      expect(createdHandler).toHaveBeenCalled()
    })
  })

  describe('amendCommit', () => {
    it('should amend last commit', async () => {
      const result = await gitAutomationService.amendCommit('/project')

      expect(result.success).toBe(true)
      expect(mockSimpleGit.commit).toHaveBeenCalled()
    })

    it('should amend with new message', async () => {
      const result = await gitAutomationService.amendCommit('/project', 'New message')

      expect(result.success).toBe(true)
    })
  })

  describe('cherryPick', () => {
    it('should cherry-pick commit', async () => {
      const result = await gitAutomationService.cherryPick('/project', 'abc123')

      expect(result.success).toBe(true)
      expect(mockSimpleGit.raw).toHaveBeenCalledWith(['cherry-pick', 'abc123'])
    })
  })

  describe('fetch', () => {
    it('should fetch from origin', async () => {
      const result = await gitAutomationService.fetch('/project')

      expect(result.success).toBe(true)
      expect(mockSimpleGit.fetch).toHaveBeenCalled()
    })

    it('should support prune option', async () => {
      await gitAutomationService.fetch('/project', { prune: true })

      expect(mockSimpleGit.fetch).toHaveBeenCalledWith('origin', undefined, ['--prune'])
    })

    it('should support tags option', async () => {
      await gitAutomationService.fetch('/project', { tags: true })

      expect(mockSimpleGit.fetch).toHaveBeenCalledWith('origin', undefined, ['--tags'])
    })
  })

  describe('pushWithUpstream', () => {
    it('should push with upstream tracking', async () => {
      const result = await gitAutomationService.pushWithUpstream('/project')

      expect(result.success).toBe(true)
      expect(mockSimpleGit.push).toHaveBeenCalledWith('origin', 'main', ['--set-upstream'])
    })

    it('should push specific branch', async () => {
      await gitAutomationService.pushWithUpstream('/project', 'feature-branch')

      expect(mockSimpleGit.push).toHaveBeenCalledWith('origin', 'feature-branch', ['--set-upstream'])
    })
  })

  describe('preparePullRequest', () => {
    it('should prepare PR info', async () => {
      const prInfo = await gitAutomationService.preparePullRequest('/project', 'feature/new-feature', 'main')

      expect(prInfo).not.toBeNull()
      expect(prInfo!.sourceBranch).toBe('feature/new-feature')
      expect(prInfo!.targetBranch).toBe('main')
    })

    it('should generate title from branch name', async () => {
      const prInfo = await gitAutomationService.preparePullRequest('/project', 'feature/add-login', 'main')

      expect(prInfo!.title).toBe('Add login')
    })
  })

  describe('isBranchUpToDate', () => {
    it('should check if branch is up to date', async () => {
      const result = await gitAutomationService.isBranchUpToDate('/project', 'feature')

      expect(result.upToDate).toBe(true)
      expect(result.behind).toBe(0)
      expect(result.ahead).toBe(0)
    })

    it('should detect branch is behind', async () => {
      mockSimpleGit.raw.mockResolvedValueOnce('5\t0')

      const result = await gitAutomationService.isBranchUpToDate('/project', 'feature')

      expect(result.upToDate).toBe(false)
      expect(result.behind).toBe(5)
    })
  })

  describe('rebase', () => {
    it('should rebase onto branch', async () => {
      const result = await gitAutomationService.rebase('/project', 'main')

      expect(result.success).toBe(true)
      expect(mockSimpleGit.rebase).toHaveBeenCalledWith(['main'])
    })
  })

  describe('abortRebase', () => {
    it('should abort ongoing rebase', async () => {
      const result = await gitAutomationService.abortRebase('/project')

      expect(result.success).toBe(true)
      expect(mockSimpleGit.rebase).toHaveBeenCalledWith(['--abort'])
    })
  })

  describe('clearCache', () => {
    it('should clear git instance cache', () => {
      gitAutomationService.clearCache('/project')
      // No error means success
      expect(true).toBe(true)
    })
  })
})
